import { World } from "../../src/objects";
import { RedisConnection } from "../../src/redis";

// The mock will be a room for integration sake, but not override anything that doesn't need to be mocked

export class MockWorld extends World {
    constructor(opts: {
        redisConnection: RedisConnection
    }) {
        super(opts);
    }

    public get redis() {
        return this.opts.redisConnection;
    }
}
