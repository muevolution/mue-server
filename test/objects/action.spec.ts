import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { GameObjectIdDoesNotExist, InvalidGameObjectParentError } from "../../src/errors";
import { Action, Player, Room } from "../../src/objects";
import { afterTestGroup, beforeTestGroup, init } from "../common";

const { redis, world } = init();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

describe("Action", () => {
    let rootPlayer: Player;
    let rootRoom: Room;
    let playerRoom: Room;
    let firstAction: Action;

    before(async () => {
        const results = await beforeTestGroup(redis, world);
        rootPlayer = results.rootPlayer;
        rootRoom = results.rootRoom;
        playerRoom = results.playerRoom;
    });

    after(async () => {
        await afterTestGroup(world);
    });

    function createTestAction(name?: string): Promise<Action> {
        return Action.create(world, `TestAct${name}`, rootPlayer, playerRoom);
    }

    function createTestPlayer(name?: string): Promise<Player> {
        return Player.create(world, `Test player - ${name}`, rootPlayer, rootRoom, playerRoom);
    }

    // Actual methods

    describe(".create()", () => {
        it("should create successfully", async () => {
            firstAction = await createTestAction("ActionCreate");
            expect(firstAction).to.exist.and.have.property("id").be.a("string").and.length.at.least(1);
        });
    });

    describe(".imitate()", () => {
        // TODO: Figure out how to test these specifically
        xit("should fetch an existing action from cold storage", () => { return; });
        xit("should fetch an existing action from hot cache", () => { return; });

        it("should fail if the action does not exist", async () => {
            const actual = Action.imitate(world, "a:invalid");
            await expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });
    });

    describe("#getParent()", () => {
        it("should match", async () => {
            expect(firstAction).to.exist;
            expect(rootRoom).to.exist;
            expect(await firstAction.getParent()).to.exist.and.property("id").to.equal(rootPlayer.id);
        });
    });

    describe("#getLocation()", () => {
        it("should match", async () => {
            expect(firstAction).to.exist;
            expect(playerRoom).to.exist;
            expect(await firstAction.getLocation()).to.exist.and.property("id").to.equal(playerRoom.id);
        });
    });

    describe("#reparent", () => {
        let testPlayer: Player;
        let testAction: Action;

        before(async () => {
            testPlayer = await createTestPlayer("ScriptReparent");
            testAction = await createTestAction("ActionReparent");
        });

        it("should reparent successfully", async () => {
            const actual = await testAction.reparent(testPlayer);
            expect(actual).to.be.a("object");
            expect(actual).to.have.property("oldParent").and.have.property("_id").equal(rootPlayer.shortid);
            expect(actual).to.have.property("newParent").and.have.property("_id").equal(testPlayer.shortid);
        });

        it("should not reparent to a non-player", async () => {
            const actual = testAction.reparent(rootRoom as any); // Required to skip typescript safety checks
            await expect(actual).to.be.rejectedWith(InvalidGameObjectParentError);
        });

        after(async () => {
            await testAction.destroy();
            await testPlayer.destroy();
        });
    });

    describe("targets", () => {
        it("#target should not start with a target", () => {
            expect(firstAction.target).to.be.null;
        });

        it("#setTarget should set a target", async () => {
            const success = await firstAction.setTarget(rootRoom);
            expect(success).to.be.true;
        });

        it("#target should point at the new target", () => {
            expect(firstAction.target).to.be.a("string").equal(rootRoom.id);
        });

        it("#setTarget should unset a target", async () => {
            const success = await firstAction.setTarget(null);
            expect(success).to.be.true;
        });

        it("#target should now be null", () => {
            expect(firstAction.target).to.be.null;
        });
    });

    describe("#matchCommand", () => {
        let singleAction: Action;
        let multiAction: Action;

        before(async () => {
            singleAction = await createTestAction("Single");
            multiAction = await createTestAction("Multi;Double;Triple");
        });

        it("should not match an empty command", () => {
            const actual1 = singleAction.matchCommand("");
            expect(actual1).to.be.false;

            const actual2 = singleAction.matchCommand(null);
            expect(actual2).to.be.false;
        });

        it("should match a full command", () => {
            const actual = singleAction.matchCommand("testactsingle");
            expect(actual).to.be.true;
        });

        it("should match a partial command", () => {
            const actual1 = multiAction.matchCommand("testactmulti");
            expect(actual1).to.be.true;

            const actual2 = multiAction.matchCommand("double");
            expect(actual2).to.be.true;

            const actual3 = multiAction.matchCommand("triple");
            expect(actual3).to.be.true;
        });

        it("should not match the wrong full command", () => {
            const actual = singleAction.matchCommand("invalid");
            expect(actual).to.be.false;
        });

        it("should not match the wrong partial command", () => {
            const actual = multiAction.matchCommand("invalid");
            expect(actual).to.be.false;
        });

        after(async () => {
            await singleAction.destroy();
            await multiAction.destroy();
        });
    });

});
