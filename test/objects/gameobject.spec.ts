import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { GameObjectDestroyedError, GameObjectIdDoesNotExist, InvalidGameObjectContainerError } from "../../src/errors";
import { Action, GameObjectTypes, Player, Room, GameObject } from "../../src/objects";
import { afterTestGroup, beforeTestGroup, init } from "../common";
import { MockGameObject } from "./gameobject.mock";

const { redis, world } = init();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

describe("GameObject", () => {
    let rootPlayer: Player;
    let rootRoom: Room;
    let playerRoom: Room;
    let firstObj: MockGameObject;

    before(async () => {
        const results = await beforeTestGroup(redis, world);
        rootPlayer = results.rootPlayer;
        rootRoom = results.rootRoom;
        playerRoom = results.playerRoom;
    });

    after(async () => {
        await afterTestGroup(world);
    });

    async function createTestObj(name?: string, id?: string): Promise<MockGameObject> {
        const mgo = new MockGameObject(world, {
            "name": `Test Object - ${name}`,
            "creator": rootPlayer.id,
            "location": playerRoom.id,
            "parent": rootRoom.id,
        }, id);
        await world.storage.addObject(mgo);
        return mgo;
    }

    function createTestRoom(name?: string): Promise<Room> {
        return Room.create(world, `Test room - ${name}`, rootPlayer, rootRoom, playerRoom);
    }

    // Actual methods

    describe(".checkType()", () => {
        let testObj: MockGameObject;

        before(async () => {
            testObj = await createTestObj("GameObj.properties");
        });

        it("should correctly match types by instance", () => {
            const actual = GameObject.checkType(testObj, GameObjectTypes.ROOM);
            expect(actual).to.be.true;
        });

        it("should fail to match wrong type by instance", () => {
            const actual = GameObject.checkType(testObj, GameObjectTypes.ITEM);
            expect(actual).to.be.false;
        });

        it("should correctly match types by id", () => {
            const actual = GameObject.checkType("r:1234", GameObjectTypes.ROOM);
            expect(actual).to.be.true;
        });

        it("should fail to match wrong type by id", () => {
            const actual = GameObject.checkType("r:1234", GameObjectTypes.ITEM);
            expect(actual).to.be.false;
        });

        it("should fail to match on short id", () => {
            const actual = GameObject.checkType("1234", GameObjectTypes.ROOM);
            expect(actual).to.be.false;
        });

        it("should fail to match on null", () => {
            const actual = GameObject.checkType(null, GameObjectTypes.ROOM);
            expect(actual).to.be.false;
        });

        it("should fail to match on empty string", () => {
            const actual = GameObject.checkType("", GameObjectTypes.ROOM);
            expect(actual).to.be.false;
        });

        after(async () => {
            await testObj.destroy();
        });
    });

    describe(".constructor()", () => {
        it("should create successfully", async () => {
            firstObj = await createTestObj("GameObj.create", "testid1");
            expect(firstObj).to.exist;
        });
    });

    describe("properties", () => {
        it("#shortid should match", () => {
            expect(firstObj).to.have.property("shortid").to.equal("testid1");
        });

        it("#id should match", () => {
            expect(firstObj).to.have.property("id").to.equal("r:testid1");
        });

        it("#name should match", () => {
            expect(firstObj).to.have.property("name").to.equal("Test Object - GameObj.create");
        });

        it("#type should match", () => {
            expect(firstObj).to.have.property("type").to.equal(GameObjectTypes.ROOM);
        });

        it("#destroyed should be false", () => {
            expect(firstObj).to.have.property("destroyed").and.be.false;
        });

        it("#meta should match", () => {
            expect(firstObj).to.have.property("meta").to.deep.equals({
                "name": "Test Object - GameObj.create",
                "creator": rootPlayer.id,
                "location": playerRoom.id,
                "parent": rootRoom.id,
            });
        });

        it("#parent should match", () => {
            expect(firstObj).to.have.property("parent").to.equal(rootRoom.id);
        });

        it("#location should match", () => {
            expect(firstObj).to.have.property("location").to.equal(playerRoom.id);
        });
    });

    describe("#getParent()", () => {
        it("should match", async () => {
            expect(firstObj).to.exist;
            expect(rootRoom).to.exist;
            expect(await firstObj.getParent()).to.exist.and.property("id").to.equal(rootRoom.id);
        });
    });

    describe("#getLocation()", () => {
        it("should match", async () => {
            expect(firstObj).to.exist;
            expect(rootRoom).to.exist;
            expect(await firstObj.getLocation()).to.exist.and.property("id").to.equal(playerRoom.id);
        });
    });

    describe("properties", () => {
        let testObj: MockGameObject;

        before(async () => {
            testObj = await createTestObj("GameObj.properties", "testid2");
        });

        it("#getProp should get nothing at start", async () => {
            const actual = await testObj.getProp("testpath");
            expect(actual).to.be.null;
        });

        it("#getProps should get nothing at start", async () => {
            const actual = await testObj.getProps();
            expect(actual).to.be.a("object").and.deep.equal({});
        });

        it("#setProp and #getProp should handle string properties", async () => {
            const setActual = await testObj.setProp("teststrprop", "teststr");
            expect(setActual).to.be.true;

            const getActual = await testObj.getProp("teststrprop");
            expect(getActual).to.be.a("string").and.equal("teststr");
        });

        it("#setProp and #getProp should handle number properties", async () => {
            const setActual = await testObj.setProp("testnumprop", 2299);
            expect(setActual).to.be.true;

            const getActual = await testObj.getProp("testnumprop");
            expect(getActual).to.be.a("number").and.equal(2299);
        });

        it("#setProp and #getProp should handle array properties", async () => {
            const setActual = await testObj.setProp("testarrprop", ["a", 123]);
            expect(setActual).to.be.true;

            const getActual = await testObj.getProp("testarrprop");
            expect(getActual).to.be.an("array").and.deep.equal(["a", 123]);
        });

        it("#setProp should unset a property", async () => {
            const setActual = await testObj.setProp("testempty", "a");
            expect(setActual).to.be.true;

            const unsetActual = await testObj.setProp("testempty", null);
            expect(unsetActual).to.be.true;

            const getActual = await testObj.getProp("testempty");
            expect(getActual).to.be.null;
        });

        it("#getProps should fetch all set values", async () => {
            const actual = await testObj.getProps();
            expect(actual).to.be.an("object").and.deep.equal({
                "teststrprop": "teststr",
                "testnumprop": 2299,
                "testarrprop": ["a", 123]
            });
        });

        it("#setProps should set multiple properties", async () => {
            const setActual = await testObj.setProps({
                "teststrprop": 361666,
                "newprop": "newval",
                "testarrprop": null
            });
            expect(setActual).to.be.true;

            const getChangedActual = await testObj.getProp("teststrprop");
            expect(getChangedActual).to.be.a("number").and.equal(361666);

            const getNewActual = await testObj.getProp("newprop");
            expect(getNewActual).to.be.a("string").and.equal("newval");

            const getUnsetActual = await testObj.getProp("testarrprop");
            expect(getUnsetActual).to.be.null;
        });

        after(async () => {
            await testObj.destroy();
        });
    });

    describe("#matchName", () => {
        it("should match successfully", () => {
            const actual = firstObj.matchName("test object - gameObj.create");
            expect(actual).to.be.true;
        });

        it("should not match on null", () => {
            const actual = firstObj.matchName(null);
            expect(actual).to.be.false;
        });

        it("should not match on empty string", () => {
            const actual = firstObj.matchName("");
            expect(actual).to.be.false;
        });

        it("should not match on incorrect value", () => {
            const actual = firstObj.matchName("invalid");
            expect(actual).to.be.false;
        });

        // not yet implemented
        xit("should match fuzzy", () => {
            const actual = firstObj.matchName("test object");
            expect(actual).to.be.true;
        });
    });

    describe("#rename", () => {
        let testObj: MockGameObject;

        before(async () => {
            testObj = await createTestObj("GameObj.rename", "testid2");
        });

        it("should rename successfully", async () => {
            const actual = await testObj.rename("RenamedTestObj");
            expect(actual).to.be.true;
            expect(testObj.name).to.equal("RenamedTestObj");
        });

        it("should be able to be found cold and still be renamed", async () => {
            const refind = await world.getObjectById(testObj.id);
            expect(refind).to.exist.and.property("name").to.equal("RenamedTestObj");
        });

        it("should update the player name index", async () => {
            const newPlayer = await Player.create(world, "gameobjrenametest", rootPlayer, rootRoom, playerRoom);
            expect(newPlayer).to.exist;

            const renameActual = await newPlayer.rename("gameobjrenamed");
            expect(renameActual).to.be.true;

            const refind = await world.getPlayerByName("gameobjrenametest");
            expect(refind).to.be.null;

            const refind2 = await world.getPlayerByName("gameobjrenamed");
            expect(refind2).to.exist.and.property("id").to.equal(newPlayer.id);
        });

        it("should not set as null", async () => {
            const actual = await testObj.rename(null);
            expect(actual).to.be.false;
        });

        it("should not set as empty string", async () => {
            const actual = await testObj.rename("");
            expect(actual).to.be.false;
        });

        after(async () => {
            await testObj.destroy();
        });
    });

    describe("#reparent", () => {
        let testRoom1: Room;
        let testRoom2: Room;
        let testObj: MockGameObject;

        before(async () => {
            testRoom1 = await createTestRoom("GameObj.reparent1");
            testRoom2 = await createTestRoom("GameObj.reparent2");
            testObj = await createTestObj("GameObj.reparent", "testid2");
        });

        it("should reparent successfully", async () => {
            const actual = await testObj.reparent(testRoom1);
            expect(actual).to.be.a("object");
            expect(actual).to.have.property("oldParent").and.have.property("_id").equal(rootRoom.shortid);
            expect(actual).to.have.property("newParent").and.have.property("_id").equal(testRoom1.shortid);
        });

        it("should not reparent to a destroyed object", async () => {
            await testRoom2.destroy();
            const actual = testObj.reparent(testRoom2);
            await expect(actual).to.be.rejectedWith(GameObjectDestroyedError);
        });

        it("should not reparent to a null object", async () => {
            const actual = await testObj.reparent(null);
            expect(actual).to.be.null;
        });

        after(async () => {
            await testObj.destroy();
            await testRoom1.destroy();
            await testRoom2.destroy();
        });
    });

    describe("#move", () => {
        let testRoom1: Room;
        let testRoom2: Room;
        let testObj: MockGameObject;
        let testAction: Action;

        before(async () => {
            testRoom1 = await createTestRoom("GameObj.reparent1");
            testRoom2 = await createTestRoom("GameObj.reparent2");
            testObj = await createTestObj("GameObj.move", "testid2");
            testAction = await Action.create(world, "Test Action", rootPlayer, playerRoom);
        });

        it("should move successfully", async () => {
            const actual = await firstObj.move(testRoom1);
            expect(actual).to.be.a("object");
            expect(actual).to.have.property("oldLocation").and.have.property("_id").equal(playerRoom.shortid);
            expect(actual).to.have.property("newLocation").and.have.property("_id").equal(testRoom1.shortid);
        });

        it("should not move to a non-container", async () => {
            const actual = firstObj.move(testAction as any); // Required to skip typescript safety checks
            await expect(actual).to.be.rejectedWith(InvalidGameObjectContainerError);
        });

        it("should not move to a destroyed object", async () => {
            await testRoom2.destroy();
            const actual = firstObj.move(testRoom2);
            await expect(actual).to.be.rejectedWith(GameObjectDestroyedError);
        });

        it("should not move to a null object", async () => {
            const actual = await firstObj.move(null);
            expect(actual).to.be.null;
        });

        after(async () => {
            await testObj.destroy();
            await testAction.destroy();
            await testRoom1.destroy();
            await testRoom2.destroy();
        });
    });

    describe("#destroy()", () => {
        let testObj: MockGameObject;

        before(async () => {
            testObj = await createTestObj("GameObj.destroy");
        });

        it("should destroy an object", async () => {
            // Destroy the room
            const actual = await testObj.destroy();
            expect(actual).to.be.true;
            expect(testObj.destroyed).to.be.true;

            // Try to find again
            const refind = world.getObjectById(testObj.id);
            await expect(refind).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });

        after(async () => {
            await testObj.destroy();
        });
    });

    describe("#toString", () => {
        let testObj: MockGameObject;

        before(async () => {
            testObj = await createTestObj("GameObj.toString", "testid2");
        });

        it("should match", () => {
            expect(testObj.toString()).to.be.a("string").and.equal(`'Test Object - GameObj.toString' [r:testid2]`);
        });

        after(async () => {
            await testObj.destroy();
        });
    });
});
