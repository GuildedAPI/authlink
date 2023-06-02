import { useState, useEffect } from "react";
import { useLoaderData, useSubmit } from "@remix-run/react";
import { redirect, json } from "@remix-run/server-runtime";

import client from "~/redis.server";
import pool from "~/psql.server";
import { getSession, commitSession } from "~/sessions.server";
import { getUser, getUserPost, getUserPosts } from "~/common/guilded";
import { randomString, randomDigits } from "~/common/random";
import { Button, ErrorBlock } from "~/common/components";
import { fetchServerMember, sendVerificationMessage } from "../bot.server";

const findUsableServer = async (userId, preferServerId) => {
  const connection = await pool.acquire();
  let result = null;
  try {
    const statement = await connection.prepare(
      `
      SELECT
        servers.id,
        servers.name,
        servers.avatar,
        servers_config.auth_channel_id
      FROM
        servers,
        servers_config,
        members
      WHERE
        members.user_id = $1
        AND servers.id = members.server_id
        AND servers_config.server_id = members.server_id
        AND servers_config.auth_channel_id IS NOT NULL
      `
    );
    result = await statement.execute({ params: [userId] });
  } finally {
    await connection.close();
  }

  if (result?.rows.length) {
    const row =
      (preferServerId
        ? result.rows.find((r) => r[0] === preferServerId)
        : undefined) ?? result.rows[0];
    return {
      id: row[0],
      name: row[1],
      avatar: row[2],
      authChannelId: row[3],
    };
  }

  return null;
};

export async function loader({ request }) {
  const url = new URL(request.url);
  if (!url.searchParams.get("id")) {
    throw redirect("/start");
  }
  const data = await getUser(url.searchParams.get("id"));
  if (!data.user) {
    throw json({ ...data, from_guilded: true }, { status: 400 });
  }

  let authQuery = null;
  const vanityCode = url.searchParams.get("a"),
    clientId = url.searchParams.get("client_id"),
    scope = url.searchParams.get("scope"),
    redirectUri = url.searchParams.get("redirect_uri");
  // Required parameters for successful flow completion
  if ((clientId && scope && redirectUri) || vanityCode) {
    authQuery = String(url.searchParams);
  }

  const messageAuthServer = await findUsableServer(url.searchParams.get("id"), url.searchParams.get("preferServerId"));
  if (messageAuthServer) {
    // Make sure the member is still in the server
    const member = await fetchServerMember(
      messageAuthServer.id,
      url.searchParams.get("id"),
    );
    if (member) {
      // We can use our more secure method
      const authStrings = [randomDigits(3), randomDigits(3), randomDigits(3)];
      const correctString =
        authStrings[Math.floor(Math.random() * authStrings.length)];
      const code = randomString(32);

      // This is a bad failure point if the selected server sets up permissions incorrectly
      const message = await sendVerificationMessage(
        messageAuthServer.authChannelId,
        member.id,
        authStrings
      );
      if (message) {
        await client.set(
          `guilded_authlink_verify_code_short_${message.id}`,
          JSON.stringify({
            authStrings,
            correctString,
            code,
            userId: member.id,
            status: "pending",
          }),
          { EX: 600 }
        );

        // TODO: fetch server & channel info to show where to look for the message
        return {
          flow: "message",
          user: {
            id: member.id,
            name: member.user.name,
          },
          messageUrl: `https://www.guilded.gg/teams/${message.serverId}/groups/${message.raw.groupId}/channels/${message.channelId}/chat?messageId=${message.id}`,
          correctString,
          code,
          authQuery,
        };
      }
    }
  }

  const authString = `authlink-${randomString(23)}`;
  const code = randomString(32);
  await client.set(
    `guilded_authlink_verify_code_${data.user.id}`,
    JSON.stringify({ authString, code }),
    { EX: 600 }
  );

  return {
    flow: "profile",
    user: {
      id: data.user.id,
      name: data.user.name,
    },
    authString,
    code,
    authQuery,
  };
}

export async function action({ request }) {
  const data = await request.formData();
  let authorizedUser;

  if (data.get("post_id") && data.get("user_id") && data.get("code")) {
    const key = `guilded_authlink_verify_code_${data.get("user_id")}`;
    let authData = await client.get(key);
    if (!authData) {
      throw json(
        {
          message:
            "No auth string is cached for this user. Refresh and try again.",
        },
        { status: 400 }
      );
    }
    try {
      authData = JSON.parse(authData);
    } catch (e) {
      throw json(
        { message: "Invalid data is cached. Refresh and try again." },
        { status: 500 }
      );
    }
    const { authString, code } = authData;
    if (code !== data.get("code")) {
      throw json(
        {
          message:
            "This error should not happen unless you are attempting to hijack somebody's account. Knock it off.",
        },
        { status: 400 }
      );
    }

    const post = await getUserPost(data.get("user_id"), data.get("post_id"));
    if (!post.title) {
      throw json({ message: "This post does not exist." }, { status: 404 });
    } else if (post.title !== authString) {
      throw json(
        { message: "Auth string does not match provided post title." },
        { status: 400 }
      );
    }
    const userData = await getUser(data.get("user_id"));
    if (!userData.user) {
      throw json(
        { message: userData.message, from_guilded: true },
        { status: 400 }
      );
    }
    await client.del(key);
    authorizedUser = userData.user;
  } else if (data.get("message_id")) {
    const key = `guilded_authlink_verify_code_short_${data.get("message_id")}`;
    let authData = await client.get(key);
    if (!authData) {
      throw json(
        {
          message:
            "No auth data is cached for this user. Refresh and try again.",
        },
        { status: 400 }
      );
    }
    try {
      authData = JSON.parse(authData);
    } catch (e) {
      throw json(
        { message: "Invalid data is cached. Refresh and try again." },
        { status: 500 }
      );
    }
    const { userId, status, code } = authData;
    if (code !== data.get("code")) {
      throw json(
        {
          message:
            "This error should not happen unless you are attempting to hijack somebody's account. Knock it off.",
        },
        { status: 400 }
      );
    }

    if (status !== "verified") {
      throw json(
        { message: "This authorization attempt has not been verified." },
        { status: 400 }
      );
    }

    const userData = await getUser(userId);
    if (!userData.user) {
      throw json(
        { message: userData.message, from_guilded: true },
        { status: 400 }
      );
    }
    // await client.del(key);
    authorizedUser = userData.user;
  }

  if (authorizedUser) {
    const session = await getSession(request.headers.get("Cookie"));
    session.set("guilded", { user: authorizedUser });
    const headers = {
      "Set-Cookie": await commitSession(session),
    };
    const authQuery = data.get("authQuery");
    if (authQuery && authQuery !== "null") {
      const params = new URLSearchParams(authQuery);
      params.forEach((_, key) => {
        // This is a weird workaround to an inconsequential issue where the `id` param would be passed through the flow.
        if (
          ![
            "client_id",
            "scope",
            "redirect_uri",
            "state",
            "prompt",
            "a",
          ].includes(key)
        ) {
          params.delete(key);
        }
      });
      const vanityCode = params.get("a");
      if (vanityCode) {
        params.delete("a");
        return redirect(`/a/${vanityCode}?${params}`, { headers });
      } else {
        return redirect(`/auth?${params}`, { headers });
      }
    }
    return redirect("/me", { headers });
  }
  throw redirect("/start");
}

export default function Verify() {
  const { flow, user, authString, code, correctString, messageUrl, authQuery } =
    useLoaderData();
  const submit = useSubmit();

  const [verifyStatus, setVerifyStatus] = useState(undefined);
  useEffect(() => {
    if (flow === "message") {
      const messageId = new URL(messageUrl).searchParams.get("messageId");
      const interval = setInterval(() => {
        fetch(`/data/verifications/${messageId}`).then((r) =>
          r.json().then((d) => {
            if (!d.status) {
              setVerifyStatus("expired");
            } else if (d.status === "verified") {
              submit(
                {
                  message_id: messageId,
                  code,
                  authQuery,
                },
                {
                  method: "post",
                  replace: true,
                }
              );
            } else {
              setVerifyStatus(d.status);
            }
          })
        );
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [flow]);

  return (
    <div className="max-w-3xl mx-auto">
      <ErrorBlock />
      <h1 className="text-3xl font-bold">
        Are you <span className="italic">really</span> {user.name}?
      </h1>
      {flow === "message" ? (
        <div>
          <p>
            You just received{" "}
            <a href={messageUrl} target="_blank" className="text-guilded-link">
              a ping message
            </a>{" "}
            from the{" "}
            <img
              src="/images/authlink-pad.png"
              className="rounded-full h-4 inline"
            />{" "}
            <span className="font-bold">Authlink</span> bot. Click on the
            reaction that matches this number:
          </p>
          <p className="text-6xl text-center font-bold tracking-widest mb-2">
            {!verifyStatus || verifyStatus === "pending"
              ? correctString
              : "womp womp"}
          </p>
          {verifyStatus === "verified" ? (
            <p>Nice job! Redirecting you now...</p>
          ) : verifyStatus === "failed" ? (
            <p>
              You selected the wrong number. Reload this page to send another
              request.
            </p>
          ) : verifyStatus === "denied" ? (
            <p>
              As it turns out, you aren't {user.name}. Try picking on someone
              with your own name next time.
            </p>
          ) : (
            verifyStatus === "expired" && (
              <p>The request expired. Reload this page to send another one.</p>
            )
          )}
        </div>
      ) : (
        <>
          <p>
            Here comes the verification process. Don't worry; It's quick, easy,
            and usually painless.
          </p>
          <ol className="list-decimal mt-2">
            <li>
              Head over to{" "}
              <a
                href={`https://www.guilded.gg/profile/${user.id}`}
                target="_blank"
                className="text-guilded-link"
              >
                your profile
              </a>
              .
            </li>
            <li>
              Click on "<b>Write a Post</b>" (make sure you're signed in to the
              right account first!).
            </li>
            <li>
              Make the title "<b>{authString}</b>" (without quotes). You can
              make the content anything you want (go crazy!).
            </li>
          </ol>
          <Button
            className="mt-2"
            onClick={async () => {
              const errorElement = document.getElementById("error");
              errorElement.innerText = "";

              const posts = await getUserPosts(user.id, 10);
              let foundPost = null;
              for (const post of posts) {
                if (post.title == authString && post.createdBy == user.id) {
                  foundPost = post;
                  break;
                }
              }

              if (!foundPost) {
                errorElement.innerText =
                  "Couldn't find a matching post. Make sure it's in the last 10 posts on your profile and that you didn't include anything before or after the bolded string from step 3.";
                return;
              }
              submit(
                {
                  post_id: foundPost.id,
                  user_id: user.id,
                  authQuery,
                  code,
                },
                {
                  method: "post",
                  replace: true,
                }
              );
            }}
          >
            Check
          </Button>
        </>
      )}
    </div>
  );
}
