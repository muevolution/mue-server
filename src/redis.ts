import * as Bluebird from "bluebird";
import * as redis from "redis";

Bluebird.promisifyAll(redis.RedisClient.prototype);
Bluebird.promisifyAll(redis.Multi.prototype);


export class RedisConnection {
    public static connect(opts: redis.ClientOpts) {
        return new RedisConnection(redis.createClient(opts));
    }

    public client: AsyncRedisClient;

    constructor(private clientSync: redis.RedisClient) {
        this.client = clientSync as AsyncRedisClient;
    }
}

export interface AsyncRedisClient extends redis.RedisClient {
    duplicate(): AsyncRedisClient;
    multi(): AsyncRedisMulti;

    getAsync(key: string): Promise<string>;
    setAsync(key: string, value: string): Promise<"OK">;

    lrangeAsync(key: string, start: number, end: number): Promise<string[]>;
    lremAsync(key: string, value: string): Promise<number>;
    rpushAsync(key: string, value: string): Promise<number>;

    hgetAsync(key: string, field: string): Promise<string>;
    hgetallAsync(key: string): Promise<{[key: string]: string}>;
    hmsetAsync(key: string, value: {[key: string]: string}): Promise<boolean>;
    hsetAsync(key: string, field: string, value: string): Promise<number>;

    pubsubAsync(command: "channels", pattern?: string): Promise<string[]>;
    subscribeAsync(channel: string | string[]): Promise<string>;
    unsubscribeAsync(channel: string | string[]): Promise<string>;
    publishAsync(channel: string, value: string): Promise<number>;

    flushdbAsync(): Promise<string>;
}

export interface AsyncRedisMulti extends redis.Multi {
    execAsync(): Promise<boolean>;
}
