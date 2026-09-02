import { randomInt } from "crypto";
import { redis } from "../lib/redis";

const TTL_SECONDS = 5 * 60;

const memoryStore = new Map<string, { otp: string; expiresAt: number }>();

const isRedisUp = async () => {
	if (!redis) return false;
	try {
		return (await redis.ping()) === "PONG";
	} catch {
		return false;
	}
};

export const generateOtp = () => randomInt(100000, 1000000).toString();

export const storeOtp = async (key: string, otp: string) => {
	if (await isRedisUp()) {
		await redis!.set(`otp:${key}`, otp, { EX: TTL_SECONDS });
	} else {
		memoryStore.set(key, { otp, expiresAt: Date.now() + TTL_SECONDS * 1000 });
	}
};

export const verifyOtp = async (key: string, otp: string) => {
	if (await isRedisUp()) {
		const stored = await redis!.get(`otp:${key}`);
		if (stored === otp) {
			await redis!.del(`otp:${key}`);
			return true;
		}
		return false;
	}

	const entry = memoryStore.get(key);
	if (!entry) return false;
	if (entry.otp !== otp || entry.expiresAt < Date.now()) {
		memoryStore.delete(key);
		return false;
	}
	memoryStore.delete(key);
	return true;
};

const dataStore = new Map<string, { data: unknown; expiresAt: number }>();

export const storeJson = async (key: string, data: unknown) => {
	if (await isRedisUp()) {
		await redis!.set(`data:${key}`, JSON.stringify(data), { EX: TTL_SECONDS });
	} else {
		dataStore.set(key, { data, expiresAt: Date.now() + TTL_SECONDS * 1000 });
	}
};

export const takeJson = async <T>(key: string): Promise<T | null> => {
	if (await isRedisUp()) {
		const raw = await redis!.get(`data:${key}`);
		if (!raw) return null;
		await redis!.del(`data:${key}`);
		return JSON.parse(raw) as T;
	}

	const entry = dataStore.get(key);
	if (!entry) return null;
	dataStore.delete(key);
	if (entry.expiresAt < Date.now()) return null;
	return entry.data as T;
};
