import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { GameObjectIdExistsError, InvalidGameObjectNameError, PlayerNameAlreadyExistsError } from "../src/errors";
import { GameObject, GameObjectTypes, Item, Player, Room, RootFields } from "../src/objects";
import { RedisConnection } from "../src/redis";
import { Storage } from "../src/storage";
import { beforeTestGroup, init, objectCreator } from "./common";
import { MockItem } from "./objects/item.mock";
import { MockPlayer } from "./objects/player.mock";

const { redis, world } = init();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

describe("Storage", () => {
    let rootPlayer: Player;
    let rootRoom: Room;
    let playerRoom: Room;
    const creator = () => objectCreator(world, rootRoom, rootPlayer, playerRoom);
    let storage: Storage;

    before(async () => {
        // Start from scratch
        const redis2 = RedisConnection.connect();
        await redis2.client.flushdbAsync();
        await redis2.client.quitAsync();

        // Begin regular init
        const results = await beforeTestGroup(redis, world);
        rootPlayer = results.rootPlayer;
        rootRoom = results.rootRoom;
        playerRoom = results.playerRoom;

        // Storage specific
        storage = new Storage(redis);
    });

    after(async () => {
        await world.shutdown();
    });

    // Test methods

    describe(".constructor", () => {
        it("should construct successfully", async () => {
            const storage2 = new Storage(redis);
            expect(storage2).to.be.a("Storage");
        });
    });

    describe("#addObject", () => {
        it("should add a new object [INCPL]", async () => {
            const id = "tiao1";
            const location = "r:rewq";
            const meta = {
                "creator": "p:asdf",
                "parent": "i:sdfg",
                "name": "TestItem.addObject1",
                location
            };

            const testItem = new MockItem(world, meta, id);

            // API: Should return true
            const actual = await storage.addObject(testItem);
            expect(actual).to.be.true;

            // Redis: Meta should be set
            const redisMetaActual = await redis.client.hgetallAsync(`s:i:${id}:meta`);
            expect(redisMetaActual).to.deep.equal(meta);

            // Redis: Should be in master item list
            const redisObjListActual = await redis.client.smembersAsync("i:i:all");
            expect(redisObjListActual).to.contain(`i:${id}`);

            // API: Should be in location container
            const containerActual = await storage.getContents(location);
            expect(containerActual).to.contain(`i:${id}`);
        });

        it("should add a new object [INCP-]", async () => {
            const id = "tiao2";
            const parent = "i:sdfg";
            const meta = {
                "creator": "p:asdf",
                parent,
                "name": "TestItem.addObject2"
            };

            const testItem = new MockItem(world, meta, id);

            // API: Should return true
            const actual = await storage.addObject(testItem);
            expect(actual).to.be.true;

            // Redis: Meta should be set
            const redisMetaActual = await redis.client.hgetallAsync(`s:i:${id}:meta`);
            expect(redisMetaActual).to.deep.equal(meta);

            // Redis: Should be in master item list
            const redisObjListActual = await redis.client.smembersAsync("i:i:all");
            expect(redisObjListActual).to.contain(`i:${id}`);
        });

        it("should add a new object [INC-L]", async () => {
            const id = "tiao3";
            const meta = {
                "creator": "p:asdf",
                "name": "TestItem.addObject3",
                "location": "r:rewq"
            };

            const testItem = new MockItem(world, meta, id);

            // API: Should return true
            const actual = await storage.addObject(testItem);
            expect(actual).to.be.true;

            // Redis: Meta should be set
            const redisMetaActual = await redis.client.hgetallAsync(`s:i:${id}:meta`);
            expect(redisMetaActual).to.deep.equal(meta);

            // Redis: Should be in master item list
            const redisObjListActual = await redis.client.smembersAsync("i:i:all");
            expect(redisObjListActual).to.contain(`i:${id}`);
        });

        it("should add a new object [INC--]", async () => {
            const id = "tiao4";
            const meta = {
                "creator": "p:asdf",
                "name": "TestItem.addObject4"
            };

            const testItem = new MockItem(world, meta, id);

            // API: Should return true
            const actual = await storage.addObject(testItem);
            expect(actual).to.be.true;

            // Redis: Meta should be set
            const redisMetaActual = await redis.client.hgetallAsync(`s:i:${id}:meta`);
            expect(redisMetaActual).to.deep.equal(meta);

            // Redis: Should be in master item list
            const redisObjListActual = await redis.client.smembersAsync("i:i:all");
            expect(redisObjListActual).to.contain(`i:${id}`);
        });

        it("should add a new object [IN-PL]", async () => {
            const id = "tiao5";
            const location = "r:rewq";
            const meta = {
                "parent": "i:sdfg",
                "name": "TestItem.addObject5",
                location
            };

            const testItem = new MockItem(world, meta, id);

            // API: Should return true
            const actual = await storage.addObject(testItem);
            expect(actual).to.be.true;

            // Redis: Meta should be set
            const redisMetaActual = await redis.client.hgetallAsync(`s:i:${id}:meta`);
            expect(redisMetaActual).to.deep.equal(meta);

            // Redis: Should be in master item list
            const redisObjListActual = await redis.client.smembersAsync("i:i:all");
            expect(redisObjListActual).to.contain(`i:${id}`);

            // API: Should be in location container
            const containerActual = await storage.getContents(location);
            expect(containerActual).to.contain(`i:${id}`);
        });

        it("should add a new object [IN--L]", async () => {
            const id = "tiao6";
            const location = "r:rewq";
            const meta = {
                "name": "TestItem.addObject6",
                location
            };

            const testItem = new MockItem(world, meta, id);

            // API: Should return true
            const actual = await storage.addObject(testItem);
            expect(actual).to.be.true;

            // Redis: Meta should be set
            const redisMetaActual = await redis.client.hgetallAsync(`s:i:${id}:meta`);
            expect(redisMetaActual).to.deep.equal(meta);

            // Redis: Should be in master item list
            const redisObjListActual = await redis.client.smembersAsync("i:i:all");
            expect(redisObjListActual).to.contain(`i:${id}`);

            // API: Should be in location container
            const containerActual = await storage.getContents(location);
            expect(containerActual).to.contain(`i:${id}`);
        });

        it("should add a new object [IN---]", async () => {
            const id = "tiao7";
            const meta = {
                "name": "TestItem.addObject7"
            };

            const testItem = new MockItem(world, meta, id);

            // API: Should return true
            const actual = await storage.addObject(testItem);
            expect(actual).to.be.true;

            // Redis: Meta should be set
            const redisMetaActual = await redis.client.hgetallAsync(`s:i:${id}:meta`);
            expect(redisMetaActual).to.deep.equal(meta);

            // Redis: Should be in master item list
            const redisObjListActual = await redis.client.smembersAsync("i:i:all");
            expect(redisObjListActual).to.contain(`i:${id}`);
        });

        it("should fail with an ID that already exists [*NCPL]", async () => {
            // Create first item
            const testItem = new MockItem(world, {"name": "TestItem.addObject8"}, "tiao8");

            // API: Should return true
            const actual = await storage.addObject(testItem);
            expect(actual).to.be.true;

            // Create second item
            const testItem2 = new MockItem(world, {"name": "TestItem.addObject8"}, "tiao8");

            // API: Should throw
            const actual2 = storage.addObject(testItem2);
            await expect(actual2).to.be.rejectedWith(GameObjectIdExistsError);
        });

        it("should fail with no name [I-CPL]", async () => {
            const id = "tiao9";
            const location = "r:rewq";
            const meta = {
                "creator": "p:asdf",
                "parent": "i:sdfg",
                "name": null as string,
                location
            };

            const testItem = new MockItem(world, meta, id);

            // API: Should throw
            const actual = storage.addObject(testItem);
            await expect(actual).to.be.rejectedWith(InvalidGameObjectNameError);
        });

        it("should add a new player to the name key [IN---]", async () => {
            const testPlayer = new MockPlayer(world, {"name": "tiao10"});

            // API: Should return true
            const actual = await storage.addObject(testPlayer);
            expect(actual).to.be.true;

            // Redis: Player name should be in list
            const redisMetaActual = await redis.client.hgetAsync(`i:p:names`, "tiao10");
            expect(redisMetaActual).to.equal(testPlayer.id);
        });

        it("should fail to add a player that already exists [I*---]", async () => {
            // Create first item
            const testPlayer = new MockPlayer(world, {"name": "tiao11"});

            // API: Should return true
            const actual = await storage.addObject(testPlayer);
            expect(actual).to.be.true;

            // Create second item
            const testPlayer2 = new MockPlayer(world, {"name": "tiao11"});

            // API: Should throw
            const actual2 = storage.addObject(testPlayer2);
            await expect(actual2).to.be.rejectedWith(PlayerNameAlreadyExistsError);
        });
    });

    describe("#destroyObject", () => {
        async function objectTests(obj: GameObject, isPlayer?: boolean, isScript?: boolean) {
            // API: Should return true
            const actual = await storage.destroyObject(obj);
            expect(actual).to.be.true;

            // Redis: All keys should no longer exist
            const redisPropKeyActual = await redis.client.existsAsync(`s:${obj.id}:props`);
            expect(redisPropKeyActual).to.equal(0);

            const redisContentKeyActual = await redis.client.existsAsync(`s:${obj.id}:contents`);
            expect(redisContentKeyActual).to.equal(0);

            const redisMetaKeyActual = await redis.client.existsAsync(`s:${obj.id}:meta`);
            expect(redisMetaKeyActual).to.equal(0);

            // Redis: Players should be removed from the name index
            if (isPlayer) {
                const redisGlobalPlayerListActual = await redis.client.hexistsAsync(`i:p:names`, obj.name);
                expect(redisGlobalPlayerListActual).to.equal(0);
            }

            // Redis: Scripts should have their source removed
            if (isScript) {
                const redisScriptKeyActual = await redis.client.existsAsync(`s:s:script`);
                expect(redisScriptKeyActual).to.equal(0);
            }

            // Redis: All values should no longer exist in their parent lists
            const redisGlobalObjectKeyActual = await redis.client.sismemberAsync(`i:${obj.type}:all`, obj.id);
            expect(redisGlobalObjectKeyActual).to.equal(0);

            const redisParentContentKeyActual = await redis.client.sismemberAsync(`s:${obj.location}:contents`, obj.id);
            expect(redisParentContentKeyActual).to.equal(0);
        }

        it("should destroy an object and remove all related keys", async () => {
            const testItem = await creator().createTestItem("DestroyTestItem");
            await objectTests(testItem);
        });

        it("should remove a player's name from the index", async () => {
            const testPlayer = await creator().createTestPlayer("DestroyTestPlayer");
            await objectTests(testPlayer, true, false);
        });

        it("should remove a script's source from the index", async () => {
            const testScript = await creator().createTestScript("DestroyTestScript");
            await testScript.updateCode("return true;");

            await objectTests(testScript, false, true);
        });

        it("should return true when the object has already been deleted", async () => {
            const testItem = await creator().createTestItem("DestroyTestItem");

            const actual = await storage.destroyObject(testItem);
            expect(actual).to.be.true;

            const actual2 = await storage.destroyObject(testItem);
            expect(actual2).to.be.true;
        });
    });

    describe("#getAllPlayers", () => {
        it("should contain all known player names", async () => {
            // Create players to check for
            const testPlayer1 = await creator().createTestPlayer("GetAllTestPlayer1");
            const testPlayer2 = await creator().createTestPlayer("GetAllTestPlayer2");
            const testPlayer3 = await creator().createTestPlayer("GetAllTestPlayer3");

            const expected = {
                [testPlayer1.name.toLowerCase()]: testPlayer1.id,
                [testPlayer2.name.toLowerCase()]: testPlayer2.id,
                [testPlayer3.name.toLowerCase()]: testPlayer3.id
            };

            // API: Should return expected values
            const actual = await storage.getAllPlayers();
            expect(actual).to.containSubset(expected);
        });
    });

    describe("#findPlayerByName", () => {
        it("should return a valid player's ID", async () => {
            const testPlayer = await creator().createTestPlayer("FindPlayerTest");

            // API: Should return expected values
            const actual = await storage.findPlayerByName(testPlayer.name);
            expect(actual).to.equal(testPlayer.id);
        });

        it("should return null with an invalid player", async () => {
            // API: Should return expected values
            const actual = await storage.findPlayerByName("InvalidFindPlayerTest");
            expect(actual).to.equal(null);
        });
    });

    describe("#updatePlayerNameIndex", () => {
        it("should rename a player in the global player list", async () => {
            // This test is weird because most of name changing is implemented in GameObject

            // Create a player that actually will exist in storage
            const testPlayer = await creator().createTestPlayer("UpdatePlayerNameTestABC");

            // Create a fake player that we'll change the value to
            const fakePlayer = new MockPlayer(world, {"name": "UpdaterPlayerNameTestXYZ"});
            fakePlayer.setInitialId(testPlayer.shortid);

            // API: Should return expected values
            const actual = await storage.updatePlayerNameIndex("UpdatePlayerNameTestABC", fakePlayer);
            expect(actual).to.be.true;

            // Redis: Should return expected value
            const redisOldActual = await redis.client.hgetAsync("i:p:names", "updaterplayernametestabc");
            expect(redisOldActual).to.equal(null);

            const redisNewActual = await redis.client.hgetAsync("i:p:names", "updaterplayernametestxyz");
            expect(redisNewActual).to.equal(testPlayer.id);
        });
    });

    describe("properties", () => {
        let testObj: Item;

        before(async () => {
            testObj = await creator().createTestItem("Storage.properties");
        });

        it("#getProp() should get nothing at start", async () => {
            const actual = await storage.getProp(testObj, "testpath");
            expect(actual).to.be.null;

            const getRedisActual = await redis.client.hgetAsync(`s:${testObj.id}:props`, "testpath");
            expect(getRedisActual).to.be.null;
        });

        it("#getProps() should get nothing at start", async () => {
            const actual = await storage.getProps(testObj);
            expect(actual).to.be.a("object").and.deep.equal({});

            const getRedisActual = await redis.client.hgetallAsync(`s:${testObj.id}:props`);
            expect(getRedisActual).to.be.null;
        });

        it("#setProp() and #getProp() should handle string properties", async () => {
            const setActual = await storage.setProp(testObj, "teststrprop", "teststr");
            expect(setActual).to.be.true;

            const getActual = await storage.getProp(testObj, "teststrprop");
            expect(getActual).to.be.a("string").and.equal("teststr");

            const getRedisActual = await redis.client.hgetAsync(`s:${testObj.id}:props`, "teststrprop");
            expect(getRedisActual).to.equal(`"teststr"`);
        });

        it("#setProp() and #getProp() should handle number properties", async () => {
            const setActual = await storage.setProp(testObj, "testnumprop", 2299);
            expect(setActual).to.be.true;

            const getActual = await storage.getProp(testObj, "testnumprop");
            expect(getActual).to.be.a("number").and.equal(2299);

            const getRedisActual = await redis.client.hgetAsync(`s:${testObj.id}:props`, "testnumprop");
            expect(getRedisActual).to.equal("2299");
        });

        it("#setProp() and #getProp() should handle array properties", async () => {
            const setActual = await storage.setProp(testObj, "testarrprop", ["a", 123]);
            expect(setActual).to.be.true;

            const getActual = await storage.getProp(testObj, "testarrprop");
            expect(getActual).to.be.an("array").and.deep.equal(["a", 123]);

            const getRedisActual = await redis.client.hgetAsync(`s:${testObj.id}:props`, "testarrprop");
            expect(getRedisActual).to.equal(`["a",123]`);
        });

        it("#setProp() should unset a property", async () => {
            const setActual = await storage.setProp(testObj, "testempty", "a");
            expect(setActual).to.be.true;

            const setRedisActual = await redis.client.hgetAsync(`s:${testObj.id}:props`, "testempty");
            expect(setRedisActual).to.equal(`"a"`);

            const unsetActual = await storage.setProp(testObj, "testempty", null);
            expect(unsetActual).to.be.true;

            const getActual = await storage.getProp(testObj, "testempty");
            expect(getActual).to.be.null;

            const getRedisActual = await redis.client.hgetAsync(`s:${testObj.id}:props`, "testempty");
            expect(getRedisActual).to.be.null;
        });

        it("#getProps() should fetch all set values", async () => {
            const actual = await storage.getProps(testObj);
            expect(actual).to.be.an("object").and.deep.equal({
                "teststrprop": "teststr",
                "testnumprop": 2299,
                "testarrprop": ["a", 123]
            });
        });

        it("#setProps() should set multiple properties", async () => {
            const setActual = await storage.setProps(testObj, {
                "teststrprop": 361666,
                "newprop": "newval",
                "testarrprop": null
            });
            expect(setActual).to.be.true;

            const getChangedActual = await storage.getProp(testObj, "teststrprop");
            expect(getChangedActual).to.be.a("number").and.equal(361666);

            const getNewActual = await storage.getProp(testObj, "newprop");
            expect(getNewActual).to.be.a("string").and.equal("newval");

            const getUnsetActual = await storage.getProp(testObj, "testarrprop");
            expect(getUnsetActual).to.be.null;

            const getRedisActual = await redis.client.hgetallAsync(`s:${testObj.id}:props`);
            expect(getRedisActual).to.deep.equal({
                "teststrprop": "361666",
                "newprop": `"newval"`
            });
        });

        after(async () => {
            await testObj.destroy();
        });
    });

    describe("#getContents()", () => {
        let testItem: Item;
        let item: Item;
        let item2: Item;

        before(async () => {
            testItem = await creator().createTestItem("Item.getContents");
        });

        it("should start empty", async () => {
            // API: Should return expected values
            const contents = await storage.getContents(testItem);
            expect(contents).to.be.an("array").and.have.lengthOf(0);

            // Redis: Contents should be null
            const redisActual = await redis.client.smembersAsync(`s:${testItem.id}:contents`);
            expect(redisActual).to.be.an("array").and.have.lengthOf(0);
        });

        it("should list an item once added", async () => {
            item = await Item.create(world, "Storage.getContents1", rootPlayer, playerRoom, testItem);
            item2 = await Item.create(world, "Storage.getContents2", rootPlayer, playerRoom, testItem);

            // API: Should return expected values
            const contents = await storage.getContents(testItem);
            expect(contents).to.be.an("array").and.have.members([item.id, item2.id]);
        });

        it("should lose an item after moved", async () => {
            const actual = await item.move(rootRoom);
            expect(actual).to.not.be.null;

            // API: Should return expected values
            const contents = await storage.getContents(testItem);
            expect(contents).to.be.an("array").and.have.members([item2.id]);

            // Redis: Contents should not include item ID
            const redisActual = await redis.client.smembersAsync(`s:${testItem.id}:contents`);
            expect(redisActual).to.not.contain(item.id);
        });

        it("should return proper filtered results", async () => {
            const testRoom = await creator().createTestRoom("Storage.getContents3");
            const innerTestItem = await creator().createTestItem("Storage.getContents4");

            // API: Should return expected values
            const actualRooms = await storage.getContents(playerRoom, GameObjectTypes.ROOM);
            expect(actualRooms).to.be.an("array").and.contain(testRoom.id);
            actualRooms.forEach((id) => expect(id).to.match(/^r:/));

            const actualItems = await storage.getContents(playerRoom, GameObjectTypes.ITEM);
            expect(actualItems).to.be.an("array").and.contain(innerTestItem.id);
            actualItems.forEach((id) => expect(id).to.match(/^i:/));
        });

        after(async () => {
            await item.destroy();
            await testItem.destroy();
        });
    });

    describe("#reparentObject", () => {
        it("should reparent object", async () => {
            const testItem = await creator().createTestItem("Storage.reparentObject item");
            const testRoom = await creator().createTestRoom("Storage.reparentObject room");

            // API: Should return expected values
            const actual = await storage.reparentObject(testItem, testRoom, playerRoom);
            expect(actual).to.be.true;

            // Redis: Ensure item's parent is set correctly
            const redisActual = await redis.client.hgetAsync(`s:${testItem.id}:meta`, "parent");
            expect(redisActual).to.equal(testRoom.id);
        });
    });

    describe("#moveObject", () => {
        it("should move object", async () => {
            const testItem = await creator().createTestItem("Storage.moveObject item");
            const testRoom = await creator().createTestRoom("Storage.moveObject room");

            // API: Should return expected values
            const actual = await storage.moveObject(testItem, testRoom, playerRoom);
            expect(actual).to.be.true;

            // Redis: Ensure item's parent is set correctly
            const redisActual = await redis.client.hgetAsync(`s:${testItem.id}:meta`, "location");
            expect(redisActual).to.equal(testRoom.id);

            const redisOldContainerActual = await redis.client.sismemberAsync(`s:${playerRoom.id}:contents`, testItem.id);
            expect(redisOldContainerActual).to.equal(0);

            const redisNewContainerActual = await redis.client.sismemberAsync(`s:${testRoom.id}:contents`, testItem.id);
            expect(redisNewContainerActual).to.equal(1);
        });
    });

    describe("#moveObjects", () => {
        it("should move multiple objects at once", async () => {
            const testItem1 = await creator().createTestItem("Storage.moveObject item1");
            const testItem2 = await creator().createTestItem("Storage.moveObject item2");
            const testRoom = await creator().createTestRoom("Storage.moveObject room");

            // API: Should return expected values
            const actual = await storage.moveObjects([testItem1, testItem2], testRoom, playerRoom);
            expect(actual).to.be.true;

            // Redis: Ensure item's parent is set correctly
            const redisActual1 = await redis.client.hgetAsync(`s:${testItem1.id}:meta`, "location");
            expect(redisActual1).to.equal(testRoom.id);

            const redisOldContainerActual1 = await redis.client.sismemberAsync(`s:${playerRoom.id}:contents`, testItem1.id);
            expect(redisOldContainerActual1).to.equal(0);

            const redisNewContainerActual1 = await redis.client.sismemberAsync(`s:${testRoom.id}:contents`, testItem1.id);
            expect(redisNewContainerActual1).to.equal(1);

            const redisActual2 = await redis.client.hgetAsync(`s:${testItem2.id}:meta`, "location");
            expect(redisActual2).to.equal(testRoom.id);

            const redisOldContainerActual2 = await redis.client.sismemberAsync(`s:${playerRoom.id}:contents`, testItem2.id);
            expect(redisOldContainerActual2).to.equal(0);

            const redisNewContainerActual2 = await redis.client.sismemberAsync(`s:${testRoom.id}:contents`, testItem2.id);
            expect(redisNewContainerActual2).to.equal(1);
        });
    });

    describe("#getMeta", () => {
        it("should return a single value for an object", async () => {
            const testItem = await creator().createTestItem("Storage.getMeta");

            // API: Should return expected values
            const actual = await storage.getMeta(testItem, "name");
            expect(actual).to.be.a("string").to.equal(testItem.name);
        });

        it("should return all values for an object", async () => {
            const testItem = await creator().createTestItem("Storage.getMeta");

            // API: Should return expected values
            const actual = await storage.getMeta(testItem);
            expect(actual).to.be.an("object").and.eql(testItem.meta);
        });
    });

    describe("#updateMeta", () => {
        it("should update a single value for an object", async () => {
            const testItem = await creator().createTestItem("Storage.updateMeta");

            // API: Should return expected values
            const actual = await storage.updateMeta(testItem, "name", "NewName");
            expect(actual).to.be.true;

            // Redis: Ensure value was set correctly
            const redisActual = await redis.client.hgetAsync(`s:${testItem.id}:meta`, "name");
            expect(redisActual).to.equal("NewName");
        });

        it("should update all values for an object", async () => {
            const testItem = await creator().createTestItem("Storage.updateMeta");

            // API: Should return expected values
            const actual = await storage.updateMeta(testItem, {
                "name": "NewNamier",
                "creator": "p:asdf"
            });
            expect(actual).to.be.true;

            // Redis: Ensure values were set correctly
            const redisActual = await redis.client.hgetallAsync(`s:${testItem.id}:meta`);
            expect(redisActual).to.eql({
                "name": "NewNamier",
                "creator": "p:asdf",
                "parent": testItem.parent,
                "location": testItem.location,
            });
        });
    });

    describe("root value", () => {
        it("should update and fetch a value", async () => {
            const testPlayer = await creator().createTestPlayer("The new god");

            // API: Should return expected values
            const setActual = await storage.setRootValue(RootFields.GOD, testPlayer.id);
            expect(setActual).to.be.true;

            const getActual = await storage.getRootValue(RootFields.GOD);
            expect(getActual).to.equal(testPlayer.id);

            // Redis: Ensure value was set correctly
            const redisActual = await redis.client.hgetAsync("i:root", "god");
            expect(redisActual).to.equal(testPlayer.id);
        });
    });

    describe("script code", () => {
        it("should set and return code for a script", async () => {
            const testScript = await creator().createTestScript("Storage.getScriptCode");
            const code = "return true;";

            // API: Should return expected values
            await testScript.updateCode(code);
            const setActual = await storage.setScriptCode(testScript, code);
            expect(setActual).to.be.true;

            const getActual = await storage.getScriptCode(testScript);
            expect(getActual).to.equal(code);

            // Redis: Ensure value was set correctly
            const redisActual = await redis.client.getAsync(`s:${testScript.id}:script`);
            expect(redisActual).to.equal(code);
        });

        it("should return null for an ID that does have a script set", async () => {
            const testScript = await creator().createTestScript("Storage.getScriptCode2");

            // API: Should return expected values
            const actual = await storage.getScriptCode(testScript);
            expect(actual).to.be.null;

            // Redis: Ensure value doesn't exist
            const redisActual = await redis.client.existsAsync(`s:${testScript.id}:script`);
            expect(redisActual).to.equal(0);
        });

        it("should return null for an ID that does not exist", async () => {
            // API: Should return expected values
            const actual = await storage.getScriptCode("s:invalid");
            expect(actual).to.be.null;

            // Redis: Ensure value doesn't exist
            // I'm not sure how this would ever return true... good 1=1 test I guess
            const redisActual = await redis.client.existsAsync("s:s:invalid:script");
            expect(redisActual).to.equal(0);
        });
    });
});
