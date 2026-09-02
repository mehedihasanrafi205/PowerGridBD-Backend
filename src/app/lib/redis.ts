import { createClient } from "redis";
import config from "../config";

export const redisClient = createClient({
  username: config.redis_user,
  password: config.redis_password,
  socket: {
    host: config.redis_host,
    port: Number(config.redis_port),
  },
});

redisClient.on("error", (err) => {
  if (config.node_env === "development") {
    console.error("❌ Redis Client Error:", err.message);
  } else {
    console.error("Redis Error Encountered");
  }
});

export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log("✔ Redis Client Connected Successfully");
    }
  } catch (error) {
    console.error("❌ Failed to connect to Redis:", error);
  }
};
