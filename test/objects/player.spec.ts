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

describe("Player", () => {
    let rootPlayer: Player;
    let rootRoom: Room;
    let playerRoom: Room;
    let firstPlayer: Player;
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

    function createTestPlayer(name?: string): Promise<Player> {
        return Player.create(world, `TestPlayer${name}`, rootPlayer, rootRoom, playerRoom);
    }

    // Actual methods

    describe(".create()", () => {
        it("should create successfully", async () => {
            firstPlayer = await createTestPlayer("PlayerCreate");
            expect(firstPlayer).to.exist.and.have.property("id").be.a("string").and.length.at.least(1);
        });

        xit("should create with meta value fallbacks");
    });

    describe(".imitate()", () => {
        // TODO: Figure out how to test these specifically
        xit("should fetch an existing player from cold storage", () => { return; });
        xit("should fetch an existing player from hot cache", () => { return; });

        it("should fail if the player does not exist", async () => {
            const actual = Player.imitate(world, "p:invalid");
            await expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });
    });

    describe("#getParent()", () => {
        it("should match", async () => {
            expect(firstPlayer).to.exist;
            expect(rootRoom).to.exist;
            expect(await firstPlayer.getParent()).to.exist.and.property("id").to.equal(rootRoom.id);
        });
    });

    describe("#getLocation()", () => {
        it("should match", async () => {
            expect(firstPlayer).to.exist;
            expect(playerRoom).to.exist;
            expect(await firstPlayer.getLocation()).to.exist.and.property("id").to.equal(playerRoom.id);
        });
    });

    describe("#reparent", () => {
        let testPlayer: Player;
        let testRoom2: Room;

        before(async () => {
            testPlayer = await createTestPlayer("PlayerReparentTarget");
            testRoom2 = await creator().createTestRoom("Player.reparent sample");
        });

        it("should reparent successfully", async () => {
            const actual = await testPlayer.reparent(testRoom2);
            expect(actual).to.be.a("object");
            expect(actual).to.have.property("oldParent").and.have.property("_id").equal(rootRoom.shortid);
            expect(actual).to.have.property("newParent").and.have.property("_id").equal(testRoom2.shortid);
        });

        it("should not reparent to a non-room", async () => {
            const actual = testPlayer.reparent(rootPlayer as any); // Required to skip typescript safety checks
            await expect(actual).to.be.rejectedWith(InvalidGameObjectParentError);
        });

        after(async () => {
            await testPlayer.destroy();
            await testRoom2.destroy();
        });
    });

    describe("#move", () => {
        let testPlayer: Player;
        let testRoom2: Room;

        before(async () => {
            testPlayer = await createTestPlayer("PlayerMoveTarget");
            testRoom2 = await creator().createTestRoom("Player.move sample");
        });

        it("should move successfully", async () => {
            const actual = await testPlayer.move(testRoom2);
            expect(actual).to.be.a("object");
            expect(actual).to.have.property("oldLocation").and.have.property("_id").equal(playerRoom.shortid);
            expect(actual).to.have.property("newLocation").and.have.property("_id").equal(testRoom2.shortid);

            // TODO: Test for message
        });

        it("should not move to an invalid type", async () => {
            const actual = testPlayer.reparent(rootPlayer as any); // Required to skip typescript safety checks
            await expect(actual).to.be.rejectedWith(InvalidGameObjectParentError);
        });

        after(async () => {
            await testPlayer.destroy();
            await testRoom2.destroy();
        });
    });

    describe("#getContents()", () => {
        let testPlayer: Player;
        let item: Item;

        before(async () => {
            testPlayer = await createTestPlayer("PlayerGetContents");
        });

        it("should start empty", async () => {
            const contents = await testPlayer.getContents();
            expect(contents).to.be.empty;
        });

        it("should list an item", async () => {
            item = await Item.create(world, "Sample item", rootPlayer, playerRoom, testPlayer);

            const contents = await testPlayer.getContents();
            expect(contents).to.be.an("array").and.have.lengthOf(1).and.containSubset([{"_type": "i", "_id": item.shortid}]);
        });

        it("should lose an item after moved", async () => {
            const actual = await item.move(rootRoom);
            expect(actual).to.be.an("object");
            expect(actual).to.have.property("oldLocation").and.property("_id", testPlayer.shortid);
            expect(actual).to.have.property("newLocation").and.property("_id", rootRoom.shortid);

            const contents = await testPlayer.getContents();
            expect(contents).to.be.empty;
        });

        after(async () => {
            await item.destroy();
            await testPlayer.destroy();
        });
    });

    describe("#find()", () => {
        let testPlayer: Player;

        before(async () => {
            testPlayer = await createTestPlayer("PlayerFind");
        });

        describe("items", () => {
            let item: Item;

            it("should start with no results", async () => {
                const actual = await testPlayer.find("Sample");
                expect(actual).to.be.null;
            });

            it("should find an item by name", async () => {
                item = await Item.create(world, "Sample item", rootPlayer, playerRoom, testPlayer);

                const actual = await testPlayer.find("Sample item");
                expect(actual).to.exist.and.to.containSubset({"_type": "i", "_id": item.shortid});
            });

            it("should find an item by name with type", async () => {
                const actual = await testPlayer.find("Sample item", GameObjectTypes.ITEM);
                expect(actual).to.exist.and.to.containSubset({"_type": "i", "_id": item.shortid});
            });

            xit("should find an item in a container", () => { return; });
            xit("should find an item higher up the parent tree", () => { return; });
            xit("should not find an item higher up the location tree", () => { return; });
            xit("should follow find precedence", () => { return; });

            it("should not find an item with the wrong type", async () => {
                const actual = await testPlayer.find("Sample item", GameObjectTypes.ROOM);
                expect(actual).to.be.null;
            });

            after(async () => {
                await item.destroy();
            });
        });

        describe("actions", () => {
            let action: Action;

            it("should start with no results", async () => {
                const actual = await testPlayer.find("sampleact", GameObjectTypes.ACTION);
                expect(actual).to.be.null;
            });

            xit("should find an action in a container", () => { return; });
            xit("should find an item higher up the parent tree", () => { return; });
            xit("should not find an item higher up the location tree", () => { return; });

            it("should find an action by name", async () => {
                action = await Action.create(world, "sampleact", rootPlayer, testPlayer);

                const actual = await testPlayer.find("sampleact", GameObjectTypes.ACTION);
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
            await testPlayer.destroy();
        });
    });

    xdescribe("#findIn()", () => {
        // This is code-covered by #find
        return;
    });

    describe("#resolveTarget()", () => {
        let testPlayer: Player;
        let testPlayer2: Player;
        let item: Item;

        before(async () => {
            testPlayer = await createTestPlayer("PlayerResolveTarget");
            const testRoom = await Room.create(world, "TestRoomResolveTarget", rootPlayer, rootRoom, playerRoom);
            testPlayer2 = await Player.create(world, "PlayerResolveTarget2", rootPlayer, rootRoom, testRoom);
            item = await Item.create(world, "FindMe", rootPlayer, rootRoom, testPlayer);
            await Item.create(world, "NotFindMe", rootPlayer, rootRoom, testPlayer2);
        });

        it("should resolve 'me' as the player", async () => {
            const actual = await testPlayer.resolveTarget("me");
            expect(actual).to.exist.and.have.property("id").equal(testPlayer.id);
        });

        it("should resolve 'here' as the location", async () => {
            const actual = await testPlayer.resolveTarget("here");
            expect(actual).to.exist.and.have.property("id").equal(playerRoom.id);
        });

        it("should resolve 'parent' as the parent", async () => {
            const actual = await testPlayer.resolveTarget("parent");
            expect(actual).to.exist.and.have.property("id").equal(rootRoom.id);
        });

        it("should resolve an object by ID when absolute", async () => {
            const actual = await testPlayer.resolveTarget(item.id, true);
            expect(actual).to.exist.and.have.property("id").equal(item.id);
        });

        it("should not resolve an object by ID when not absolute", async () => {
            const actual = await testPlayer.resolveTarget(item.id);
            expect(actual).to.be.null;
        });

        it("should resolve a player by name when absolute", async () => {
            const actual = await testPlayer.resolveTarget("TestPlayerPlayerCreate", true);
            expect(actual).to.exist.and.have.property("id").equal(firstPlayer.id);
        });

        it("should not resolve a player by name when not absolute", async () => {
            const actual = await testPlayer.resolveTarget("TestPlayerPlayerResolveTarget2");
            expect(actual).to.be.null;
        });

        it("should find an item in the player search precedence", async () => {
            const actual = await testPlayer.resolveTarget("FindMe");
            expect(actual).to.exist.and.have.property("id").equal(item.id);
        });

        it("should not find an item not in the player search precedence", async () => {
            const actual = await testPlayer.resolveTarget("NotFindMe");
            expect(actual).to.be.null;
        });
    });

    describe("#destroy()", () => {
        let testPlayer: Player;
        let item: Item;

        before(async () => {
            testPlayer = await createTestPlayer("PlayerDestroy");
            item = await Item.create(world, "Ejected Item", rootPlayer, rootRoom, testPlayer);
        });

        it("should destroy a player and eject its contents", async () => {
            expect(item.location).to.equal(testPlayer.id, "Item did not start in expected location");

            // Destroy the player
            const success = await testPlayer.destroy();
            expect(success).to.be.true;
            expect(testPlayer.destroyed).to.be.true;

            // Try to find again
            const refind = world.getObjectById(testPlayer.id);
            await expect(refind).to.be.rejectedWith(GameObjectIdDoesNotExist);

            // Test spill
            expect(item.location).to.equal(playerRoom.id, "Item did not end up in expected location");
        });

        after(async () => {
            await item.destroy();
        });
    });

    xdescribe("#sendMessage()", () => { return; });
    xdescribe("#quit()", () => { return; });
});
