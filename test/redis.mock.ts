import * as Redis from "ioredis";
import { config } from "../src/config";
import { RedisConnection } from "../src/redis";

export class MockRedisConnection extends RedisConnection {
    public static connect() {
        return new MockRedisConnection(new Redis(config.redis));
    }

    private timer: NodeJS.Timer;

    constructor(client: Redis.Redis) {
        super(client);
        this.client.on("connect", () => {
            this.timer = setTimeout(() => {
                console.log("connection has been open longer than 15 seconds");
            }, 15000);
        });
        this.client.on("close", () => {
            clearTimeout(this.timer);
        });
    }

    duplicate() {
        return new MockRedisConnection(this.client.duplicate());
    }
}
