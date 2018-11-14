import * as Redis from "ioredis";
import * as _ from "lodash";

import { config } from "./config";
import { Logger } from "./logging";


export class RedisConnection {
    public static connect() {
        return new RedisConnection(new Redis(config.redis));
    }

    constructor(public client: Redis.Redis) {
        this.client.on("error", (err) => {
            Logger.error("Redis error", err);
        });
    }

    duplicate() {
        return new RedisConnection(this.client.duplicate());
    }

    async numsub(...channels: string[]): Promise<{[channel: string]: number}> {
        // ioredis seems to be missing types for this
        const results = (await (this.client as any).pubsub("numsub", ...channels)) as Array<string | number>;
        const channelNames = _.filter(results, (v, i) => i % 2 === 0) as string[];
        const channelCount = _.filter(results, (v, i) => i % 2 !== 0) as number[];
        return _.fromPairs(_.zip(channelNames, channelCount));
    }

    async channels(query: string): Promise<string[]> {
        // ioredis seems to be missing types for this
        return (this.client as any).pubsub("channels", query);
    }

    async multiWrap(cb: (multi: Redis.Pipeline) => Promise<any> | any): Promise<any[]> {
        const multi = this.client.multi();
        await cb(multi);
        return multi.exec();
    }
}
