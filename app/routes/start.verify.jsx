import { useLoaderData, useSubmit } from "@remix-run/react";
import { redirect, json } from "@remix-run/server-runtime";

import client from "~/redis.server";
import { getSession, commitSession } from "~/sessions.server";
import { getUser, getUserPost, getUserPosts } from "~/common/guilded";
import { randomString } from "~/common/random";
import { Button, ErrorBlock } from "~/common/components";

export async function loader({ request }) {
  const url = new URL(request.url);
  if (!url.searchParams.get("id")) {
    throw redirect("/start");
  }
  const data = await getUser(url.searchParams.get("id"));
  if (!data.user) {
    throw json({ ...data, from_guilded: true }, { status: 400 });
  }

  const key = `guilded_authlink_verify_code_${data.user.id}`;
  const authString = `authlink-${randomString(23)}`;
  const code = randomString(32);
  await client.set(key, JSON.stringify({ authString, code }), { EX: 600 });

  let authQuery = null;
  const clientId = url.searchParams.get("client_id");
  const scope = url.searchParams.get("scope");
  const redirectUri = url.searchParams.get("redirect_uri");
  // Required parameters for successful flow completion
  if (clientId && scope && redirectUri) {
    authQuery = String(url.searchParams);
  }

  return {
    user: data.user,
    authString,
    code,
    authQuery,
  };
}

export async function action({ request }) {
  const data = await request.formData();
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
    const session = await getSession(request.headers.get("Cookie"));
    session.set("guilded", { user: userData.user });
    const headers = {
      "Set-Cookie": await commitSession(session),
    };

    const authQuery = data.get("authQuery");
    if (authQuery && authQuery != "null") {
      const params = new URLSearchParams(authQuery);
      params.forEach((_, key) => {
        // This is a weird workaround to an inconsequential issue where the `id` param would be passed through the flow.
        if (
          !["client_id", "scope", "redirect_uri", "state", "prompt"].includes(
            key
          )
        ) {
          params.delete(key);
        }
      });
      return redirect(`/auth?${params}`, { headers });
    }
    return redirect("/me", { headers });
  }
  throw redirect("/start");
}

export default function Verify() {
  const loaderData = useLoaderData();
  const submit = useSubmit();

  const user = loaderData.user;
  const authString = loaderData.authString;
  const authQuery = loaderData.authQuery;

  return (
    <div className="max-w-4xl mx-auto">
      <ErrorBlock />
      <h1 className="text-3xl font-bold">
        Are you <em>really</em> {user.name}?
      </h1>
      <p>
        Here comes the verification process. Don't worry; It's quick, easy, and
        usually painless.
      </p>
      <ol className="list-decimal ml-4 mt-2">
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
          Make the title "<b>{authString}</b>" (without quotes). You can make
          the content anything you want (go crazy!).
        </li>
        {/*<li>Press the "<b>Check</b>" button below this list.</li>*/}
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
              code: loaderData.code,
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
    </div>
  );
}
