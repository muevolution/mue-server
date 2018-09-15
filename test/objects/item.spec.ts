import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { GameObjectIdDoesNotExist } from "../../src/errors";
import { Action, GameObjectTypes, Item, Player, Room } from "../../src/objects";
import { afterTestGroup, beforeTestGroup, init, objectCreator } from "../common";

const { redis, world } = init();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

describe("Item", () => {
    let rootPlayer: Player;
    let rootRoom: Room;
    let playerRoom: Room;
    let firstItem: Item;
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
            firstItem = await creator().createTestItem("Item.create");
            expect(firstItem).to.exist.and.have.property("id").be.a("string").and.length.at.least(1);
        });

        xit("should create with meta value fallbacks");
    });

    describe(".imitate()", () => {
        // TODO: Figure out how to test these specifically
        xit("should fetch an existing item from cold storage", () => { return; });
        xit("should fetch an existing item from hot cache", () => { return; });

        it("should fail if the item does not exist", async () => {
            const actual = Item.imitate(world, "i:invalid");
            await expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });
    });

    describe("#getParent()", () => {
        it("should match", async () => {
            expect(firstItem).to.exist;
            expect(rootRoom).to.exist;
            expect(await firstItem.getParent()).to.exist.and.property("id").to.equal(rootRoom.id);
        });
    });

    describe("#getLocation()", () => {
        it("should match", async () => {
            expect(firstItem).to.exist;
            expect(playerRoom).to.exist;
            expect(await firstItem.getLocation()).to.exist.and.property("id").to.equal(playerRoom.id);
        });
    });

    describe("#getContents()", () => {
        let testItem: Item;
        let item: Item;

        before(async () => {
            testItem = await creator().createTestItem("Item.getContents");
        });

        it("should start empty", async () => {
            const contents = await testItem.getContents();
            expect(contents).to.be.empty;
        });

        it("should list an item", async () => {
            item = await Item.create(world, "Sample item", rootPlayer, playerRoom, testItem);

            const contents = await testItem.getContents();
            expect(contents).to.be.an("array").and.have.lengthOf(1).and.containSubset([{"_type": "i", "_id": item.shortid}]);
        });

        it("should lose an item after moved", async () => {
            const actual = await item.move(rootRoom);
            expect(actual).to.be.an("object");
            expect(actual).to.have.property("oldLocation").and.property("_id", testItem.shortid);
            expect(actual).to.have.property("newLocation").and.property("_id", rootRoom.shortid);

            const contents = await testItem.getContents();
            expect(contents).to.be.empty;
        });

        after(async () => {
            await item.destroy();
            await testItem.destroy();
        });
    });

    describe("#find()", () => {
        let testItem: Item;

        before(async () => {
            testItem = await creator().createTestItem("Item.find");
        });

        describe("items", () => {
            let item: Item;

            it("should start with no results", async () => {
                const actual = await testItem.find("Sample");
                expect(actual).to.be.null;
            });

            it("should find an item by name", async () => {
                item = await Item.create(world, "Sample item", rootPlayer, playerRoom, testItem);

                const actual = await testItem.find("Sample item");
                expect(actual).to.exist.and.to.containSubset({"_type": "i", "_id": item.shortid});
            });

            it("should find an item by name with type", async () => {
                const actual = await testItem.find("Sample item", GameObjectTypes.ITEM);
                expect(actual).to.exist.and.to.containSubset({"_type": "i", "_id": item.shortid});
            });

            xit("should not find an item in a container", () => { return; });
            xit("should not find an item higher up the parent tree", () => { return; });
            xit("should not find an item higher up the location tree", () => { return; });

            it("should not find an item with the wrong type", async () => {
                const actual = await testItem.find("Sample item", GameObjectTypes.ROOM);
                expect(actual).to.be.null;
            });

            after(async () => {
                await item.destroy();
            });
        });

        describe("actions", () => {
            let action: Action;

            it("should start with no results", async () => {
                const actual = await testItem.find("sampleact", GameObjectTypes.ACTION);
                expect(actual).to.be.null;
            });

            xit("should find an action in a container", () => { return; });
            xit("should find an item higher up the parent tree", () => { return; });
            xit("should not find an item higher up the location tree", () => { return; });

            it("should find an action by name", async () => {
                action = await Action.create(world, "sampleact", rootPlayer, testItem);

                const actual = await testItem.find("sampleact", GameObjectTypes.ACTION);
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
            await testItem.destroy();
        });
    });

    xdescribe("#findIn()", () => {
        // This is code-covered by #find
        return;
    });

    describe("#destroy()", () => {
        let testItem: Item;
        let item: Item;

        before(async () => {
            testItem = await creator().createTestItem("Item.getContents");
            item = await Item.create(world, "Ejected Item", rootPlayer, rootRoom, testItem);
        });

        it("should destroy an item and eject its contents", async () => {
            expect(item.location).to.equal(testItem.id, "Item did not start in expected location");

            // Destroy the room
            const success = await testItem.destroy();
            expect(success).to.be.true;
            expect(testItem.destroyed).to.be.true;

            // Try to find again
            const refind = world.getObjectById(testItem.id);
            await expect(refind).to.be.rejectedWith(GameObjectIdDoesNotExist);

            // Test spill
            expect(item.location).to.equal(playerRoom.id, "Item did not end up in expected location");
        });

        after(async () => {
            await item.destroy();
        });
    });
});
