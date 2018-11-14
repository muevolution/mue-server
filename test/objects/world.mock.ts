import { World } from "../../src/objects";
import { MockRedisConnection } from "../redis.mock";

// The mock will be a room for integration sake, but not override anything that doesn't need to be mocked

export class MockWorld extends World {
    constructor(protected opts: {
        redisConnection: MockRedisConnection
    }) {
        super(opts);
    }

    public get redis() {
        return this.opts.redisConnection;
    }
}
