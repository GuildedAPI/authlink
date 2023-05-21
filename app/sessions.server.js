import { redirect } from "@remix-run/server-runtime";
import { createCookie, createFileSessionStorage } from "@remix-run/node";

const cookie = createCookie("authlink_session", {
  maxAge: 1209600, // 2 weeks
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secrets: [process.env.COOKIE_SECRET],
});

const { getSession, commitSession, destroySession } = createFileSessionStorage({
  dir: process.env.SESSION_STORAGE_PATH,
  cookie: cookie,
});

export { getSession, commitSession, destroySession };

export async function boilerplateLoader({ request }) {
  const session = await getSession(request.headers.get("Cookie"));
  if (!session.has("guilded")) throw redirect("/start");
  return session.get("guilded");
}
