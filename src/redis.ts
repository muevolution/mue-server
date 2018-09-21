import * as bluebird from "bluebird";
import * as _ from "lodash";
import * as redis from "redis";

import { config } from "./config";

bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);


export class RedisConnection {
    public static connect() {
        return new RedisConnection(redis.createClient(config.redis));
    }

    public client: AsyncRedisClient;

    constructor(clientSync: redis.RedisClient) {
        this.client = clientSync as AsyncRedisClient;
    }

    async numsub(...channels: string[]): Promise<{[channel: string]: number}> {
        const results = await this.client.pubsubAsync("numsub", ...channels);
        const channelNames = _.filter(results, (v, i) => i % 2 === 0) as string[];
        const channelCount = _.filter(results, (v, i) => i % 2 !== 0) as number[];
        return _.fromPairs(_.zip(channelNames, channelCount));
    }

    async multiWrap(cb: (multi: redis.Multi) => Promise<any> | any): Promise<any[]> {
        const multi = this.client.multi();
        await cb(multi);
        return multi.execAsync();
    }
}

export interface AsyncRedisClient extends redis.RedisClient {
    duplicate(): AsyncRedisClient;
    multi(): AsyncRedisMulti;

    getAsync(key: string): Promise<string>;
    setAsync(key: string, value: string): Promise<"OK">;
    existsAsync(key: string): Promise<number>;

    hgetAsync(key: string, field: string): Promise<string>;
    hgetallAsync(key: string): Promise<{[key: string]: string}>;
    hmsetAsync(key: string, value: {[key: string]: string}): Promise<boolean>;
    hsetAsync(key: string, field: string, value: string): Promise<number>;
    hdelAsync(key: string, field: string): Promise<number>;
    hexistsAsync(key: string, field: string): Promise<number>;

    smembersAsync(key: string): Promise<string[]>;
    sismemberAsync(key: string, member: string): Promise<number>;

    pubsubAsync(command: "channels", pattern?: string): Promise<string[]>;
    pubsubAsync(command: "numsub", ...channels: string[]): Promise<Array<string|number>>;
    subscribeAsync(channel: string | string[]): Promise<string>;
    psubscribeAsync(pattern: string | string[]): Promise<string>;
    unsubscribeAsync(channel: string | string[]): Promise<string>;
    publishAsync(channel: string, value: string): Promise<number>;

    monitorAsync(): Promise<"OK">;
    quitAsync(): Promise<"OK">;
    flushdbAsync(): Promise<string>;
}

export interface AsyncRedisMulti extends redis.Multi {
    execAsync(): Promise<any[]>;
}
