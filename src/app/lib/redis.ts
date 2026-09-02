import { createClient } from "redis";
import config from "../config";

const redisUrl = config.redis_host
	? `redis://${config.redis_user ?? "default"}:${config.redis_password ?? ""}@${config.redis_host}:${config.redis_port ?? 6379}`
	: "";

export const redis = redisUrl && config.redis_host ? createClient({ url: redisUrl }) : null;

if (redis) {
	if (config.node_env !== "test") {
		redis.on("error", (err: Error) => console.error("Redis client error:", err.message));
	}

	(async () => {
		try {
			await redis.connect();
		} catch (err) {
			console.error("Failed to connect to Redis:", (err as Error).message);
		}
	})();
}
