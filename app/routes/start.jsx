import { useLoaderData, useSubmit, useTransition } from "@remix-run/react";

import { useState } from "react";

import { getSession } from "~/sessions.server";
import { Button } from "~/common/components";
import { search, getUser, getSubdomain } from "~/common/guilded";

const searchCache = {};
const userCache = {};

async function searchUsers(query) {
  const data = await search(query, "user", 20);
  return data.results.users;
}

export async function loader({ request }) {
  const data = {};
  const url = new URL(request.url);
  const vanityCode = url.searchParams.get("a"),
    clientId = url.searchParams.get("client_id"),
    scope = url.searchParams.get("scope"),
    redirectUri = url.searchParams.get("redirect_uri");

  // Required parameters for successful flow completion
  if ((clientId && scope && redirectUri) || vanityCode) {
    data.authQuery = String(url.searchParams);
  }
  const session = await getSession(request.headers.get("Cookie"));
  if (session.has("guilded")) {
    data.user = session.get("guilded").user;
  }
  return data;
}

const profileIdRegex =
  /^(?:https?:\/\/(?:www\.)?guilded\.gg\/profile\/)?([a-zA-Z0-9]{8,10})$/;
const profileVanityRegex =
  /^(?:https?:\/\/(?:www\.)?guilded\.gg\/u\/)?([a-zA-Z0-9-]{3,32})$/;
const profileRegex = new RegExp(
  profileIdRegex.source + "|" + profileVanityRegex.source
);

export default function Start() {
  const [searchState, setSearchState] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const loaderData = useLoaderData();
  const transition = useTransition();
  const submit = useSubmit();

  let authQuery = loaderData.authQuery;
  if (authQuery === "undefined") authQuery = undefined;
  const authQueryParams = authQuery ? new URLSearchParams(authQuery) : null;

  return (
    <div className="max-w-3xl mx-auto">
      {authQuery && (
        <div className="mb-4 bg-[#3e3f4a] p-3 rounded border border-white/10 w-full">
          <h1 className="font-bold text-2xl">Why am I here?</h1>
          <p>
            You were about to authorize an application, but you are not signed
            in. Complete the below process and you will be sent back to
            authorize the application.
          </p>
        </div>
      )}
      <h1 className="text-3xl font-bold">Get Started</h1>
      <p>Find your Guilded account by searching for it below:</p>
      <div className="w-full mt-4 p-3 rounded text-lg bg-guilded-slate">
        <label className="flex">
          <i
            className={`ci-search text-2xl ${
              transition.state === "submitting" ? "animate-pulse" : ""
            }`}
          />
          <input
            className="w-full bg-transparent ml-2"
            placeholder="Search your username"
            onInput={async (event) => {
              const query = event.target.value;
              if (!query) {
                setSearchState([]);
                return;
              }

              // TODO: Delay searching while the user is still typing
              let results = searchCache[query];
              if (!results) {
                results = await searchUsers(query);
                searchCache[query] = results;
              }
              setSearchState(results);
            }}
          />
        </label>
      </div>
      {selectedUser && (
        <div className="bg-guilded-slate w-full mt-2 rounded p-3">
          <h2 className="font-bold text-2xl flex">
            <img
              src={selectedUser.profilePicture}
              className="h-12 rounded-full mr-3"
              alt={"Selected user's profile picture"}
            />
            <span className="my-auto">{selectedUser.name}</span>
            <span className="opacity-20 text-sm ml-auto hover:opacity-100 transition-opacity">
              ID: {selectedUser.id}
            </span>
          </h2>
          <div className="text-center mt-4">
            <Button
              className="mr-3"
              onClick={() => {
                const authData = {};
                if (authQueryParams)
                  authQueryParams.forEach((val, key) => {
                    authData[key] = val;
                  });
                submit(
                  { id: selectedUser.id, ...authData },
                  { method: "get", action: `/start/verify` }
                );
              }}
            >
              This is me
            </Button>
            <button
              className="font-bold text-guilded-subtitle hover:text-white transition-colors"
              onClick={() => {
                setSelectedUser(null);
              }}
            >
              I've never met this man in my life
            </button>
          </div>
        </div>
      )}
      {searchState && (
        <div className="bg-guilded-slate w-full mt-2 rounded max-h-96 overflow-auto">
          {searchState.map((user) => {
            let profilePicture =
              "https://img.guildedcdn.com/asset/DefaultUserAvatars/profile_1.png";
            if (user.profilePicture) {
              profilePicture = user.profilePicture.replace("Large", "Small");
            }
            user.profilePicture = profilePicture;

            return (
              <div
                key={user.id}
                tabIndex={0}
                className="flex p-3 hover:bg-[#3d3f48] transition-colors rounded cursor-pointer"
                onClick={() => {
                  setSelectedUser(user);
                }}
              >
                <img
                  src={profilePicture}
                  className="h-12 rounded-full mr-3"
                  alt="User profile picture"
                />
                <div className="my-auto">
                  <h3>{user.name}</h3>
                  {user.aboutInfo && user.aboutInfo.tagLine && (
                    // This overflows with long unbroken taglines
                    <p className="text-guilded-subtitle text-sm">
                      {user.aboutInfo.tagLine}
                    </p>
                  )}
                </div>
                <a
                  href={`https://www.guilded.gg/profile/${user.id}`}
                  target="_blank"
                  className="my-auto ml-auto text-xl"
                >
                  <i className="ci-external_link" title="View Profile" />
                </a>
              </div>
              // TODO: Separator here? The unbroken padding looks excessive.
            );
          })}
        </div>
      )}
      <h3 className="mt-2 text-xl font-bold text-guilded-subtitle">
        Can't find yourself?
      </h3>
      <p className="text-guilded-subtitle">
        Enter your profile URL to continue manually:
      </p>
      <div className="w-full mt-1 px-3 py-2 rounded bg-guilded-slate">
        <label className="flex">
          <i
            className={`ci-link_02 text-xl ${
              transition.state === "submitting" ? "animate-pulse" : ""
            }`}
          />
          <input
            className="w-full bg-transparent ml-2 peer"
            pattern={profileRegex.source}
            placeholder="https://www.guilded.gg/u/shay"
            onChange={async (event) => {
              setSelectedUser(null);
              const value = event.target.value;
              const match = value.match(profileRegex);
              if (!match) return;

              let id = match[1];
              const vanityCode = match[2];
              if (vanityCode && !id) {
                const data = await getSubdomain(vanityCode);
                if (data.userId) {
                  id = data.userId;
                }
              }

              if (id) {
                let user = userCache[id];
                if (!user) {
                  const data = await getUser(id);
                  user = data.user;
                  if (!user) {
                    // TODO: Show error
                    return;
                  }
                  userCache[id] = user;
                }
                setSearchState([]);
                setSelectedUser(user);
              }
            }}
          />
        </label>
      </div>
      {loaderData.user && (
        <p className="mt-2">
          <a
            href="https://www.youtube.com/watch?v=1Xfdjqa5dfY"
            target="_blank"
            className="font-bold text-rose-400 hover:underline"
          >
            Wait a minute!
          </a>{" "}
          You're already authorized as{" "}
          <a
            href={`https://www.guilded.gg/profile/${loaderData.user.id}`}
            target="_blank"
            className="font-bold hover:underline"
          >
            {loaderData.user.name}
          </a>
          . Do you really want to give that away?
        </p>
      )}
    </div>
  );
}
