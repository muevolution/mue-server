import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { GameObjectIdDoesNotExist, InvalidGameObjectParentError } from "../../src/errors";
import { Action, GameObjectTypes, Item, Player, Room } from "../../src/objects";
import { afterTestGroup, beforeTestGroup, init, objectCreator } from "../common";

const { redis, world } = init();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

describe("Room", () => {
    let rootPlayer: Player;
    let rootRoom: Room;
    let playerRoom: Room;
    let firstRoom: Room;
    const creator = () => objectCreator(world, rootRoom, rootPlayer, playerRoom);

    before(async () => {
        const results = await beforeTestGroup(redis, world);
        rootPlayer = results.rootPlayer;
        rootRoom = results.rootRoom;
        playerRoom = results.playerRoom;
    });

    after(async () => {
        await afterTestGroup(world);
    });

    // Actual methods

    describe(".create()", () => {
        it("should create successfully", async () => {
            firstRoom = await creator().createTestRoom("Room.create");
            expect(firstRoom).to.exist.and.have.property("id").be.a("string").and.length.at.least(1);
        });
    });

    describe(".imitate()", () => {
        // TODO: Figure out how to test these specifically
        xit("should fetch an existing room from cold storage", () => { return; });
        xit("should fetch an existing room from hot cache", () => { return; });

        it("should fail if the room does not exist", async () => {
            const actual = Room.imitate(world, "r:invalid");
            await expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });
    });

    describe("#getParent()", () => {
        it("should match", async () => {
            expect(firstRoom).to.exist;
            expect(rootRoom).to.exist;
            expect(await firstRoom.getParent()).to.exist.and.property("id").to.equal(rootRoom.id);
        });
    });

    describe("#getLocation()", () => {
        it("should match", async () => {
            expect(firstRoom).to.exist;
            expect(playerRoom).to.exist;
            expect(await firstRoom.getLocation()).to.exist.and.property("id").to.equal(playerRoom.id);
        });
    });

    describe("#reparent()", () => {
        let testRoom1: Room;
        let testRoom2: Room;

        before(async () => {
            testRoom1 = await creator().createTestRoom("Room.reparent target");
            testRoom2 = await creator().createTestRoom("Room.reparent sample");
        });

        it("should reparent successfully", async () => {
            const actual = await testRoom1.reparent(testRoom2);
            expect(actual).to.be.a("object");
            expect(actual).to.have.property("oldParent").and.have.property("_id").equal(rootRoom.shortid);
            expect(actual).to.have.property("newParent").and.have.property("_id").equal(testRoom2.shortid);
        });

        it("should not reparent to a non-room", async () => {
            const actual = testRoom1.reparent(rootPlayer as any); // Required to skip typescript safety checks
            await expect(actual).to.be.rejectedWith(InvalidGameObjectParentError);
        });

        after(async () => {
            await testRoom1.destroy();
            await testRoom2.destroy();
        });
    });

    describe("#move()", () => {
        let testRoom1: Room;
        let testRoom2: Room;

        before(async () => {
            testRoom1 = await creator().createTestRoom("Room.move target");
            testRoom2 = await creator().createTestRoom("Room.move sample");
        });

        it("should move successfully", async () => {
            const actual = await testRoom1.move(testRoom2);
            expect(actual).to.be.a("object");
            expect(actual).to.have.property("oldLocation").and.have.property("_id").equal(playerRoom.shortid);
            expect(actual).to.have.property("newLocation").and.have.property("_id").equal(testRoom2.shortid);
        });

        it("should not move to a non-room", async () => {
            const actual = testRoom1.reparent(rootPlayer as any); // Required to skip typescript safety checks
            await expect(actual).to.be.rejectedWith(InvalidGameObjectParentError);
        });

        after(async () => {
            await testRoom1.destroy();
            await testRoom2.destroy();
        });
    });

    describe("#getContents()", () => {
        let testRoom: Room;
        let item: Item;

        before(async () => {
            testRoom = await creator().createTestRoom("Room.getContents");
        });

        it("should start empty", async () => {
            const contents = await testRoom.getContents();
            expect(contents).to.be.empty;
        });

        it("should list an item", async () => {
            item = await Item.create(world, "Sample item", rootPlayer, playerRoom, testRoom);

            const contents = await testRoom.getContents();
            expect(contents).to.be.an("array").and.have.lengthOf(1).and.containSubset([{"_type": "i", "_id": item.shortid}]);
        });

        it("should lose an item after moved", async () => {
            const actual = await item.move(rootRoom);
            expect(actual).to.be.an("object");
            expect(actual).to.have.property("oldLocation").and.property("_id", testRoom.shortid);
            expect(actual).to.have.property("newLocation").and.property("_id", rootRoom.shortid);

            const contents = await testRoom.getContents();
            expect(contents).to.be.empty;
        });

        after(async () => {
            await item.destroy();
            await testRoom.destroy();
        });
    });

    describe("#find()", () => {
        let testRoom: Room;

        before(async () => {
            testRoom = await creator().createTestRoom("Room.find");
        });

        describe("items", () => {
            let item: Item;

            it("should start with no results", async () => {
                const actual = await testRoom.find("Sample");
                expect(actual).to.be.null;
            });

            it("should find an item by name", async () => {
                item = await Item.create(world, "Sample item", rootPlayer, playerRoom, testRoom);

                const actual = await testRoom.find("Sample item");
                expect(actual).to.exist.and.to.containSubset({"_type": "i", "_id": item.shortid});
            });

            it("should find an item by name with type", async () => {
                const actual = await testRoom.find("Sample item", GameObjectTypes.ITEM);
                expect(actual).to.exist.and.to.containSubset({"_type": "i", "_id": item.shortid});
            });

            xit("should find an item in a container", () => { return; });
            xit("should find an item higher up the parent tree", () => { return; });
            xit("should not find an item higher up the location tree", () => { return; });
            xit("should follow find precedence", () => { return; });

            it("should not find an item with the wrong type", async () => {
                const actual = await testRoom.find("Sample item", GameObjectTypes.ROOM);
                expect(actual).to.be.null;
            });

            after(async () => {
                await item.destroy();
            });
        });

        describe("actions", () => {
            let action: Action;

            it("should start with no results", async () => {
                const actual = await testRoom.find("sampleact", GameObjectTypes.ACTION);
                expect(actual).to.be.null;
            });

            xit("should find an action in a container", () => { return; });
            xit("should find an item higher up the parent tree", () => { return; });
            xit("should not find an item higher up the location tree", () => { return; });

            it("should find an action by name", async () => {
                action = await Action.create(world, "sampleact", rootPlayer, testRoom);

                const actual = await testRoom.find("sampleact", GameObjectTypes.ACTION);
                expect(actual).to.exist.and.to.containSubset({"_type": "a", "_id": action.shortid});
            });

            xit("should follow find precedence", () => {
                return;
            });

            after(async () => {
                await action.destroy();
            });
        });

        after(async () => {
            await testRoom.destroy();
        });
    });

    xdescribe("#findIn()", () => {
        // This is code-covered by #find
        return;
    });

    describe("#destroy()", () => {
        let testRoom: Room;
        let item: Item;

        before(async () => {
            testRoom = await creator().createTestRoom("Room.destroy");
            item = await Item.create(world, "Ejected Item", rootPlayer, rootRoom, testRoom);
        });

        it("should destroy a room and eject its contents", async () => {
            expect(item.location).to.equal(testRoom.id, "Item did not start in expected location");

            // Destroy the room
            const success = await testRoom.destroy();
            expect(success).to.be.true;
            expect(testRoom.destroyed).to.be.true;

            // Try to find again
            const refind = world.getObjectById(testRoom.id);
            await expect(refind).to.be.rejectedWith(GameObjectIdDoesNotExist);

            // Test spill
            expect(item.location).to.equal(playerRoom.id, "Item did not end up in expected location");
        });

        after(async () => {
            await item.destroy();
        });
    });
});
