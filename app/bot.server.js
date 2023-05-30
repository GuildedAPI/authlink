import { Client } from "guilded.js";

const client = new Client({ token: process.env.BOT_TOKEN });
export const AUTHLINK_SERVER_ID = process.env.BOT_SERVER_ID;

export const fetchServerMember = async (serverId, userId) => {
  try {
    return await client.members.fetch(serverId, userId);
  } catch {
    // Try the Authlink server as a fallback
    if (serverId !== AUTHLINK_SERVER_ID) {
      try {
        return await client.members.fetch(AUTHLINK_SERVER_ID, userId);
      } catch {}
    }
  }
  return null;
};

export const sendVerificationMessage = async (
  channelId,
  userId,
  authStrings
) => {
  let message;
  try {
    message = await client.messages.send(channelId, {
      embeds: [
        {
          title: `Verification for <@${userId}>`,
          description: `Please react with the number corresponding to the \
          code that you see on the login page. If you did not expect this \
          message, react with :x:.

          :one: \`${authStrings[0]}\`
          :two: \`${authStrings[1]}\`
          :three: \`${authStrings[2]}\`
        `
            .split("\n")
            .map((l) => l.trim())
            .join("\n"),
          footer: {
            icon_url: "https://authlink.app/images/authlink.png",
            // Embed timestamps don't show enough precision for this
            text: "This message expires 10 minutes after it was sent.",
          },
        },
      ],
      isPrivate: true,
    });
  } catch {}

  if (message) {
    // 1
    message.addReaction(90002199).then(() => {
      // 2
      message.addReaction(90002200).then(() => {
        // 3
        message.addReaction(90002201).then(() => {
          // 4
          message.addReaction(90002175);
        });
      });
    });
    return message;
  }

  return null;
};
