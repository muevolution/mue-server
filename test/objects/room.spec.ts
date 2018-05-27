import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { Action, GameObjectTypes, Item, Player, Room } from "../../src/objects";
import { afterTestGroup, beforeTestGroup, init } from "../common";

const { redis, world } = init();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

describe("Room", () => {
    let rootPlayer: Player;
    let rootRoom: Room;
    let playerRoom: Room;
    let firstRoom: Room;

    before(async () => {
        const results = await beforeTestGroup(redis, world);
        rootPlayer = results.rootPlayer;
        rootRoom = results.rootRoom;
        playerRoom = results.playerRoom;
    });

    after(async () => {
        await afterTestGroup(world);
    });

    function createTestRoom(name?: string): Promise<Room> {
        return Room.create(world, `Test room - ${name}`, rootPlayer, rootRoom, playerRoom);
    }

    // Actual methods

    describe(".create()", () => {
        it("should create successfully", async () => {
            firstRoom = await createTestRoom("Room.create");
            expect(firstRoom).to.exist.and.have.property("id").be.a("string").and.length.at.least(1);
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
            expect(rootRoom).to.exist;
            expect(await firstRoom.getLocation()).to.exist.and.property("id").to.equal(playerRoom.id);
        });
    });

    describe("#getContents()", () => {
        let testRoom: Room;
        let item: Item;

        before(async () => {
            testRoom = await createTestRoom("Room.getContents");
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
            testRoom = await createTestRoom("Room.find");
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

            xit("should find an item in a container", () => {
                return;
            });

            xit("should find an item higher up the parent tree", () => {
                return;
            });

            xit("should not find an item higher up the location tree", () => {
                return;
            });

            xit("should follow find precedence", () => {
                return;
            });

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

            xit("should find an action in a container", () => {
                return;
            });

            xit("should find an item higher up the parent tree", () => {
                return;
            });

            xit("should not find an item higher up the location tree", () => {
                return;
            });

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
            testRoom = await createTestRoom("Room.getContents");
            item = await Item.create(world, "Ejected Item", rootPlayer, rootRoom, testRoom);
        });

        it("should destroy a room and eject its contents", async () => {
            // console.log("player room id", playerRoom.id, "test room id", testRoom.id, "root room id", rootRoom.id);
            expect(item.location).to.equal(testRoom.id, "Item did not start in expected location");

            // Destroy the room
            const success = await testRoom.destroy();
            expect(success).to.be.true;
            expect(testRoom.destroyed).to.be.true;

            // Try to find again
            const refind = world.getObjectById(testRoom.id);
            expect(refind).to.be.rejectedWith(Error);

            // Test spill
            expect(item.location).to.equal(playerRoom.id, "Item did not end up in expected location");
        });

        after(async () => {
            await item.destroy();
        });
    });
});
