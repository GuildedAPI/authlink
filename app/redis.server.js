import { createClient } from "redis";

const client = createClient({ url: process.env.REDIS_URI });
client.connect();

export default client;
