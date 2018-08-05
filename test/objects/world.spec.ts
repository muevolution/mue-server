import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { GameObjectIdDoesNotExist, WorldNotInitError, WorldShutdownError } from "../../src/errors";
import { initLogger, Logger } from "../../src/logging";
import { InteriorMessage } from "../../src/netmodels";
import { Action, GameObjectTypes, Item, Player, Room, Script } from "../../src/objects";
import { RedisConnection } from "../../src/redis";
import { beforeTestGroup, objectCreator } from "../common";
import { MockWorld } from "./world.mock";

initLogger();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

type MonitorExpectFunc = (args: string[], raw?: string) => boolean;
type MonitorExpectation = string | MonitorExpectFunc;

describe("World", function() {
    this.timeout(10000);

    async function createWorld(): Promise<MockWorld> {
        const redis = RedisConnection.connect();

        return new MockWorld({ "redisConnection": redis });
    }

    async function createWorldAndInit(): Promise<MockWorld> {
        const world = await createWorld();
        await world.init();
        return world;
    }

    async function createMonitor(world: MockWorld, expected: MonitorExpectation) {
        // Enable monitor mode for these tests
        const result = await world.redis.client.monitorAsync();
        if (result !== "OK") {
            throw new Error("Unable to create monitor: " + result);
        }

        return {
            "monitor": new Promise<string[]>((resolve, reject) => {
                Logger.debug("createMonitor", expected);
                const listener = (time: string, args: string[], raw_reply: string) => {
                    Logger.debug("Redis Monitor", time, args, raw_reply);
                    if (
                        (typeof expected === "string" && raw_reply.indexOf(expected) > -1) ||
                        (typeof expected === "function" && expected(args, raw_reply))
                    ) {
                        Logger.debug(`Matched [${expected}] for [${args}]`);
                        resolve(args);
                        world.redis.client.removeListener("monitor", listener);
                    }
                };

                world.redis.client.on("monitor", listener);
            })
        };
    }

    function createEndPromise(redis: RedisConnection) {
        return new Promise((resolve, reject) => {
            redis.client.on("end", () => {
                resolve();
            });
        });
    }

    async function makeCreator(world: MockWorld) {
        const { rootPlayer, rootRoom, playerRoom } = await beforeTestGroup(world.redis, world);
        const creator = () => objectCreator(world, rootRoom, rootPlayer, playerRoom);
        return creator;
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
        // Full test cases should be in storage

        it("should create a storage client", async () => {
            const world = await createWorldAndInit();
            expect(world).to.have.property("storage").and.be.a("Storage");
            await world.shutdown();
        });

        it("should fail if server has not been initialized", async () => {
            const world = await createWorld();
            expect(() => world.storage).to.throw(WorldNotInitError);
            await world.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world = await createWorldAndInit();
            await world.shutdown();
            expect(() => world.storage).to.throw(WorldShutdownError);
        });
    });

    describe("#publishMessage", () => {
        let world: MockWorld;

        beforeEach(async () => {
            world = await createWorldAndInit();
        });

        afterEach(async () => {
            await world.shutdown();
        });

        it("should publish a plain message to the world", async () => {
            const { monitor } = await createMonitor(world, "Hello world");

            const actual = world.publishMessage("Hello world");
            await expect(actual).to.eventually.be.true;
            await expect(monitor).to.fulfilled;
        });

        it("should publish a plain message to a target", async () => {
            const creator = await makeCreator(world);
            const item = await creator().createTestItem("TestyItem");
            const { monitor } = await createMonitor(world, "Hello item");

            const actual = world.publishMessage("Hello item", item);
            await expect(actual).to.eventually.be.true;
            await expect(monitor).to.fulfilled;
        });

        it("should publish an interior message to the world", async () => {
            const { monitor } = await createMonitor(world, "Hello interior");

            const actual = world.publishMessage({
                "message": "Hello interior",
                "meta": {
                    "a": "b",
                    "c": 2
                }
            } as InteriorMessage);
            await expect(actual).to.eventually.be.true;
            await expect(monitor).to.fulfilled;
        });

        it("should publish an interior message to a target", async () => {
            const creator = await makeCreator(world);
            const item = await creator().createTestItem("TestyItem");
            const { monitor } = await createMonitor(world, "Hello interior item");

            const actual = world.publishMessage({
                "message": "Hello interior item",
                "meta": {
                    "a": "b",
                    "c": 2
                }
            } as InteriorMessage, item);
            await expect(actual).to.eventually.be.true;
            await expect(monitor).to.fulfilled;
        });

        it("should fail if server has not been initialized", async () => {
            const world2 = await createWorld();

            const actual = world2.publishMessage("Hello world");
            await expect(actual).to.be.rejectedWith(WorldNotInitError);

            await world2.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world2 = await createWorldAndInit();
            await world2.shutdown();

            const actual = world2.publishMessage("Hello world");
            await expect(actual).to.be.rejectedWith(WorldShutdownError);
        });
    });

    describe("#command", () => {
        let world: MockWorld;
        let testPlayer: Player;

        before(async () => {
            world = await createWorldAndInit();
            const creator = await makeCreator(world);
            testPlayer = await creator().createTestPlayer("TestPlayer");
        });

        after(async () => {
            await world.shutdown();
        });

        // Full test cases should be in commandproc

        it("should process a command", async () => {
            const actual = await world.command(testPlayer, {"line": "$echo test"});
            expect(actual).to.be.true;
        });

        it("should fail if server has not been initialized", async () => {
            const world2 = await createWorld();

            const actual = world2.command(testPlayer, {"line": "$echo test"});
            await expect(actual).to.be.rejectedWith(WorldNotInitError);

            await world2.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world2 = await createWorldAndInit();
            await world2.shutdown();

            const actual = world2.command(testPlayer, {"line": "$echo test"});
            await expect(actual).to.be.rejectedWith(WorldShutdownError);
        });
    });

    describe("#getPlayerById", () => {
        let world: MockWorld;
        let testPlayer: Player;

        before(async () => {
            world = await createWorldAndInit();
            const creator = await makeCreator(world);
            testPlayer = await creator().createTestPlayer("TestPlayer");
        });

        after(async () => {
            await world.shutdown();
        });

        it("should find a player by ID", async () => {
            const actual = await world.getPlayerById(testPlayer.id);
            expect(actual).to.exist.and.have.property("id").equal(testPlayer.id);
        });

        it("should not find a player that doesn't exist", async () => {
            const actual = world.getPlayerById("p:invalid");
            expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });

        it("should fail if server has not been initialized", async () => {
            const world2 = await createWorld();

            const actual = world2.getPlayerById("p:invalid");
            await expect(actual).to.be.rejectedWith(WorldNotInitError);

            await world2.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world2 = await createWorldAndInit();
            await world2.shutdown();

            const actual = world2.getPlayerById("p:invalid");
            await expect(actual).to.be.rejectedWith(WorldShutdownError);
        });
    });

    describe("#getPlayerByName", () => {
        let world: MockWorld;
        let testPlayer: Player;

        before(async () => {
            world = await createWorldAndInit();
            const creator = await makeCreator(world);
            testPlayer = await creator().createTestPlayer("TestPlayer");
        });

        after(async () => {
            await world.shutdown();
        });

        it("should find a player by name", async () => {
            const actual = await world.getPlayerByName("Test player - TestPlayer");
            expect(actual).to.exist.and.have.property("id").equal(testPlayer.id);
        });

        it("should not find a player that doesn't exist", async () => {
            const actual = world.getPlayerByName("invalid");
            expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });

        it("should fail if server has not been initialized", async () => {
            const world2 = await createWorld();

            const actual = world2.getPlayerByName("invalid");
            await expect(actual).to.be.rejectedWith(WorldNotInitError);

            await world2.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world2 = await createWorldAndInit();
            await world2.shutdown();

            const actual = world2.getPlayerByName("invalid");
            await expect(actual).to.be.rejectedWith(WorldShutdownError);
        });
    });

    describe("#getRoomById", () => {
        let world: MockWorld;
        let testRoom: Room;

        before(async () => {
            world = await createWorldAndInit();
            const creator = await makeCreator(world);
            testRoom = await creator().createTestRoom("TestRoom");
        });

        after(async () => {
            await world.shutdown();
        });

        it("should find a room by ID", async () => {
            const actual = await world.getRoomById(testRoom.id);
            expect(actual).to.exist.and.have.property("id").equal(testRoom.id);
        });

        it("should not find a room that doesn't exist", async () => {
            const actual = world.getRoomById("r:invalid");
            expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });

        it("should fail if server has not been initialized", async () => {
            const world2 = await createWorld();

            const actual = world2.getRoomById("r:invalid");
            await expect(actual).to.be.rejectedWith(WorldNotInitError);

            await world2.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world2 = await createWorldAndInit();
            await world2.shutdown();

            const actual = world2.getRoomById("r:invalid");
            await expect(actual).to.be.rejectedWith(WorldShutdownError);
        });
    });

    describe("#getRootRoom", () => {
        it("should return the root room", async () => {
            const world = await createWorldAndInit();
            const creator = (await makeCreator(world))();

            const actual = await world.getRootRoom();
            expect(actual).to.exist.and.have.property("id").equal(creator.rootRoom.id);

            await world.shutdown();
        });

        it("should fail if server has not been initialized", async () => {
            const world = await createWorld();

            const actual = world.getRootRoom();
            await expect(actual).to.be.rejectedWith(WorldNotInitError);

            await world.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world = await createWorldAndInit();
            await world.shutdown();

            const actual = world.getRootRoom();
            await expect(actual).to.be.rejectedWith(WorldShutdownError);
        });
    });

    describe("#getItemById", () => {
        let world: MockWorld;
        let testItem: Item;

        before(async () => {
            world = await createWorldAndInit();
            const creator = await makeCreator(world);
            testItem = await creator().createTestItem("TestItem");
        });

        after(async () => {
            await world.shutdown();
        });

        it("should find a item by ID", async () => {
            const actual = await world.getItemById(testItem.id);
            expect(actual).to.exist.and.have.property("id").equal(testItem.id);
        });

        it("should not find a item that doesn't exist", async () => {
            const actual = world.getItemById("i:invalid");
            expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });

        it("should fail if server has not been initialized", async () => {
            const world2 = await createWorld();

            const actual = world2.getItemById("i:invalid");
            await expect(actual).to.be.rejectedWith(WorldNotInitError);

            await world2.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world2 = await createWorldAndInit();
            await world2.shutdown();

            const actual = world2.getItemById("i:invalid");
            await expect(actual).to.be.rejectedWith(WorldShutdownError);
        });
    });

    describe("#getScriptById", () => {
        let world: MockWorld;
        let testScript: Script;

        before(async () => {
            world = await createWorldAndInit();
            const creator = await makeCreator(world);
            testScript = await creator().createTestScript("TestScript");
        });

        after(async () => {
            await world.shutdown();
        });

        it("should find a script by ID", async () => {
            const actual = await world.getScriptById(testScript.id);
            expect(actual).to.exist.and.have.property("id").equal(testScript.id);
        });

        it("should not find a script that doesn't exist", async () => {
            const actual = world.getScriptById("s:invalid");
            expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });

        it("should fail if server has not been initialized", async () => {
            const world2 = await createWorld();

            const actual = world2.getScriptById("s:invalid");
            await expect(actual).to.be.rejectedWith(WorldNotInitError);

            await world2.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world2 = await createWorldAndInit();
            await world2.shutdown();

            const actual = world2.getScriptById("s:invalid");
            await expect(actual).to.be.rejectedWith(WorldShutdownError);
        });
    });

    describe("#getActionById", () => {
        let world: MockWorld;
        let testAction: Action;

        before(async () => {
            world = await createWorldAndInit();
            const creator = await makeCreator(world);
            testAction = await creator().createTestAction("TestAction");
        });

        after(async () => {
            await world.shutdown();
        });

        it("should find a script by ID", async () => {
            const actual = await world.getActionById(testAction.id);
            expect(actual).to.exist.and.have.property("id").equal(testAction.id);
        });

        it("should not find a script that doesn't exist", async () => {
            const actual = world.getActionById("a:invalid");
            expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });

        it("should fail if server has not been initialized", async () => {
            const world2 = await createWorld();

            const actual = world2.getActionById("a:invalid");
            await expect(actual).to.be.rejectedWith(WorldNotInitError);

            await world2.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world2 = await createWorldAndInit();
            await world2.shutdown();

            const actual = world2.getActionById("a:invalid");
            await expect(actual).to.be.rejectedWith(WorldShutdownError);
        });
    });

    describe("#getObjectById", () => {
        let world: MockWorld;
        let rootPlayer: Player;
        let playerRoom: Room;
        let testItem: Item;
        let testScript: Script;
        let testAction: Action;

        before(async () => {
            world = await createWorldAndInit();
            const creator = (await makeCreator(world))();
            rootPlayer = creator.rootPlayer;
            playerRoom = creator.playerRoom;
            testItem = await creator.createTestItem("TestItem");
            testScript = await creator.createTestScript("TestScript");
            testAction = await creator.createTestAction("TestAction");
        });

        after(async () => {
            await world.shutdown();
        });

        it("should get an object by long ID and type", async () => {
            const actual = await world.getObjectById(rootPlayer.id, GameObjectTypes.PLAYER);
            expect(actual).to.exist.and.have.property("id").equal(rootPlayer.id);
        });

        it("should get an object by long ID with no type", async () => {
            const actual = await world.getObjectById(rootPlayer.id);
            expect(actual).to.exist.and.have.property("id").equal(rootPlayer.id);
        });

        it("should return a player", async () => {
            const actual = await world.getObjectById(rootPlayer.id);
            expect(actual).to.exist.and.have.property("id").equal(rootPlayer.id);
        });

        it("should return a room", async () => {
            const actual = await world.getObjectById(playerRoom.id, GameObjectTypes.ROOM);
            expect(actual).to.exist.and.have.property("id").equal(playerRoom.id);
        });

        it("should return an item", async () => {
            const actual = await world.getObjectById(testItem.id, GameObjectTypes.ITEM);
            expect(actual).to.exist.and.have.property("id").equal(testItem.id);
        });

        it("should return a script", async () => {
            const actual = await world.getObjectById(testScript.id, GameObjectTypes.SCRIPT);
            expect(actual).to.exist.and.have.property("id").equal(testScript.id);
        });

        it("should return an action", async () => {
            const actual = await world.getObjectById(testAction.id, GameObjectTypes.ACTION);
            expect(actual).to.exist.and.have.property("id").equal(testAction.id);
        });

        it("should fail if given a short ID", async () => {
            const actual = world.getObjectById("asdf");
            await expect(actual).to.be.rejected;
        });

        it("should fail if given a long ID with the wrong type", async () => {
            const actual = world.getObjectById("r:asdf", GameObjectTypes.PLAYER);
            await expect(actual).to.be.rejected;
        });
    });

    describe("#getObjectsByIds", () => {
        let world: MockWorld;
        let rootRoom: Room;
        let rootPlayer: Player;
        let testPlayer: Player;

        before(async () => {
            world = await createWorldAndInit();
            const creator = (await makeCreator(world))();
            rootRoom = creator.rootRoom;
            rootPlayer = creator.rootPlayer;
            testPlayer = await creator.createTestPlayer("TestPlayer");
        });

        after(async () => {
            await world.shutdown();
        });

        it("should return multiple objects passed as strings", async () => {
            const ids = [rootPlayer.id, testPlayer.id];
            const actual = await world.getObjectsByIds(ids);

            expect(actual).to.be.an("array").with.length(2);
            expect(actual[0]).to.exist.and.have.property("id").equal(rootPlayer.id);
            expect(actual[1]).to.exist.and.have.property("id").equal(testPlayer.id);
        });

        it("should return multiple objects passed as strings with types", async () => {
            const ids = [rootPlayer.id, testPlayer.id];
            const actual = await world.getObjectsByIds(ids, GameObjectTypes.PLAYER);

            expect(actual).to.be.an("array").with.length(2);
            expect(actual[0]).to.exist.and.have.property("id").equal(rootPlayer.id);
            expect(actual[1]).to.exist.and.have.property("id").equal(testPlayer.id);
        });

        it("should return multiple objects passed as promised strings", async () => {
            const ids = Promise.resolve([rootPlayer.id, testPlayer.id]);
            const actual = await world.getObjectsByIds(ids);

            expect(actual).to.be.an("array").with.length(2);
            expect(actual[0]).to.exist.and.have.property("id").equal(rootPlayer.id);
            expect(actual[1]).to.exist.and.have.property("id").equal(testPlayer.id);
        });

        it("should return empty if null", async () => {
            const actual = await world.getObjectsByIds([]);

            expect(actual).to.be.an("array").with.length(0);
        });

        it("should fail if any objects don't match type", async () => {
            const ids = Promise.resolve([rootPlayer.id, rootRoom.id]);
            const actual = world.getObjectsByIds(ids, GameObjectTypes.PLAYER);

            expect(actual).to.be.rejected;
        });
    });

    xdescribe("#getActiveServers", () => {
        let world: MockWorld;

        before(async () => {
            world = await createWorldAndInit();
        });

        after(async () => {
            await world.shutdown();
        });

        it("should return at least the current server", async () => {
            const actual = await world.getActiveServers();
            expect(actual).to.equal(1);
        });

        it("should return all servers when multiple are connected", async () => {
            const world2 = await createWorld();

            const actual = await world.getActiveServers();
            expect(actual).to.equal(2);

            await world2.shutdown();
        });

        it("should fail if server has not been initialized", async () => {
            const world2 = await createWorld();

            const actual = world2.getActiveServers();
            await expect(actual).to.be.rejectedWith(WorldNotInitError);

            await world2.shutdown();
        });

        it("should fail if server has been shut down", async () => {
            const world2 = await createWorldAndInit();
            await world2.shutdown();

            const actual = world2.getActiveServers();
            await expect(actual).to.be.rejectedWith(WorldShutdownError);
        });
    });

    // TODO: This needs a simulated player
    xdescribe("#getActiveRoomIds", () => {});

    // TODO: This needs a simulated player
    xdescribe("#getConnectedPlayerIds", () => {});

    // TODO: Figure out how to test this
    xdescribe("#invalidateScriptCache", () => {});
});
