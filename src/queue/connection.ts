import { Redis } from "ioredis";
import { appConfig } from "../config.js";

export function createRedisOptions() {
  return {
    host: appConfig.redis.host,
    port: appConfig.redis.port,
    maxRetriesPerRequest: null
  };
}

export function createRedisConnection() {
  return new Redis(createRedisOptions());
}
