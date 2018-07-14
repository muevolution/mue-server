import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { initLogger, Logger } from "../../src/logging";
import { Item, World } from "../../src/objects";
import { RedisConnection } from "../../src/redis";

initLogger();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

type MonitorExpectFunc = (args: string[], raw?: string) => boolean;
type MonitorExpectation = string | MonitorExpectFunc;

describe("World", function() {
    this.timeout(10000);

    async function createWorld(): Promise<World> {
        const redis = RedisConnection.connect();

        // Enable monitor mode for these tests
        await redis.client.monitorAsync();

        return new World({ "redisConnection": redis });
    }

    async function createWorldAndInit(): Promise<World> {
        const world = await createWorld();
        await world.init();
        return world;
    }

    function createMonitor(world: World, expected: MonitorExpectation) {
        return new Promise<void>((resolve, reject) => {
            const listener = (time: string, args: string[], raw_reply: string) => {
                Logger.debug("Redis Monitor", time, args, raw_reply);
                if (
                    (typeof expected === "string" && raw_reply.indexOf(expected) > -1) ||
                    (typeof expected === "function" && expected(args, raw_reply))
                ) {
                    Logger.debug(`Matched [${expected}] for [${args}]`);
                    resolve();
                    world.redis.client.removeListener("monitor", listener);
                }
            };

            world.redis.client.on("monitor", listener);
        });
    }

    function createEndPromise(redis: RedisConnection) {
        return new Promise((resolve, reject) => {
            redis.client.on("end", () => {
                resolve();
            });
        });
    }

    before(async () => {
        // Start from scratch
        const redis = RedisConnection.connect();
        await redis.client.flushdbAsync();
        await redis.client.quitAsync();
    });

    // Actual methods

    describe("#init()", () => {
        it("should init successfully", async () => {
            const world = await createWorld();
            const p = createMonitor(world, "joined");

            await expect(world.init()).to.eventually.be.fulfilled;
            await expect(p).to.eventually.be.fulfilled;
            await world.shutdown();
        });
    });

    describe("#shutdown()", () => {
        it("should shutdown successfully", async () => {
            const world = await createWorldAndInit();

            const p = createEndPromise(world.redis);
            await expect(world.shutdown()).to.eventually.be.fulfilled;
            await expect(p).to.eventually.be.fulfilled;
        });
    });

    describe("#storage", () => {
        it("should create a storage client", async () => {
            const world = await createWorldAndInit();
            expect(world).to.have.property("storage").and.be.a("Storage");
            await world.shutdown();
        });
    });

    describe("#publishMessage", () => {
        let world: World;

        beforeEach(async () => {
            world = await createWorldAndInit();
        });

        afterEach(async () => {
            await world.shutdown();
        });

        it("should publish a plain message to the world", async () => {
            const p = createMonitor(world, "Hello world");

            const actual = world.publishMessage("Hello world");
            await expect(actual).to.eventually.be.true;
            await expect(p).to.fulfilled;
        });

        xit("should publish a plain message to a target", async () => {
            const item = await Item.create(world, "test", null, null);
            const p = createMonitor(world, "Hello item");

            const actual = world.publishMessage("Hello item", item);
            await expect(actual).to.eventually.be.true;
            await expect(p).to.fulfilled;
        });

        xit("should publish an interior message to the world", () => {});

        xit("should publish an interior message to a target", () => {});
    });

    xdescribe("#command", () => {});
    xdescribe("#getPlayerById", () => {});
    xdescribe("#getPlayerName", () => {});
    xdescribe("#getRoomById", () => {});
    xdescribe("#getRootRoom", () => {});
    xdescribe("#getItemById", () => {});
    xdescribe("#getScriptById", () => {});
    xdescribe("#getActionById", () => {});
    xdescribe("#getObjectById", () => {});
    xdescribe("#getObjectsByIds", () => {});
    xdescribe("#getActiveServers", () => {});
    xdescribe("#getActiveRoomIds", () => {});
    xdescribe("#getConnectedPlayerIds", () => {});
    xdescribe("#find", () => {});
    xdescribe("#invalidateScriptCache", () => {});
});
