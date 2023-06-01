import { json } from "@remix-run/server-runtime";
import client from "~/redis.server";

export async function loader({ params }) {
  const messageId = params.messageId;
  if (!messageId) {
    throw json({ message: "Missing messageId parameter" }, { status: 400 });
  }

  const value = await client.get(
    `guilded_authlink_verify_code_short_${messageId}`
  );

  if (!value) {
    throw json({ message: "No such record" }, { status: 404 });
  }
  const data = JSON.parse(value);
  return {
    status: data.status,
  };
}
