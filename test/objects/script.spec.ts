import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { GameObjectIdDoesNotExist, InvalidGameObjectParentError } from "../../src/errors";
import { Player, Room, Script, GameObjectTypes } from "../../src/objects";
import { afterTestGroup, beforeTestGroup, init, objectCreator } from "../common";

const { redis, world } = init();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

describe("Script", () => {
    let rootPlayer: Player;
    let rootRoom: Room;
    let playerRoom: Room;
    let firstScript: Script;
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
            firstScript = await creator().createTestScript("Script.create");
            expect(firstScript).to.exist.and.have.property("id").be.a("string").and.length.at.least(1);
        });

        xit("should create with meta value fallbacks");
    });

    describe(".imitate()", () => {
        // TODO: Figure out how to test these specifically
        xit("should fetch an existing script from cold storage", () => { return; });
        xit("should fetch an existing script from hot cache", () => { return; });

        it("should fail if the script does not exist", async () => {
            const actual = Script.imitate(world, "s:invalid");
            await expect(actual).to.be.rejectedWith(GameObjectIdDoesNotExist);
        });
    });

    xdescribe(".invalidateCache()", () => { return; });

    describe("#getParent()", () => {
        it("should match", async () => {
            expect(firstScript).to.exist;
            expect(rootPlayer).to.exist;
            expect(await firstScript.getParent()).to.exist.and.property("id").to.equal(rootPlayer.id);
        });
    });

    describe("#getLocation()", () => {
        it("should match", async () => {
            expect(firstScript).to.exist;
            expect(playerRoom).to.exist;
            expect(await firstScript.getLocation()).to.exist.and.property("id").to.equal(playerRoom.id);
        });
    });

    describe("#reparent()", () => {
        let testPlayer: Player;
        let testScript: Script;

        before(async () => {
            testPlayer = await creator().createTestPlayer("ScriptReparent");
            testScript = await creator().createTestScript("Script.reparent");
        });

        it("should reparent successfully", async () => {
            const actual = await testScript.reparent(testPlayer);
            expect(actual).to.be.a("object");
            expect(actual).to.have.property("oldParent").and.have.property("_id").equal(rootPlayer.shortid);
            expect(actual).to.have.property("newParent").and.have.property("_id").equal(testPlayer.shortid);
        });

        it("should not reparent to a non-player", async () => {
            const actual = testScript.reparent(rootRoom as any); // Required to skip typescript safety checks
            await expect(actual).to.be.rejectedWith(InvalidGameObjectParentError);
        });

        after(async () => {
            await testScript.destroy();
            await testPlayer.destroy();
        });
    });

    describe("scripting", () => {
        const testCode = "console.log('hello test!');";
        let testScript: Script;

        before(async () => {
            testScript = await creator().createTestScript("Script.scripting");
        });

        it("#compiled should start empty", () => {
            const actual = testScript.compiled;
            expect(actual).to.not.exist;
        });

        it("#updateCode() should update the set code", async () => {
            const setActual = testScript.updateCode(testCode);
            await expect(setActual).to.eventually.be.fulfilled;

            const getActual = testScript.compiled;
            expect(getActual).to.exist.and.have.property("code").include(testCode);
        });

        it("should reload cold with code loaded", async () => {
            await world.objectCache.invalidateAll(GameObjectTypes.SCRIPT); // Invalidate the cache first to force a cold fetch
            const refind = await world.getScriptById(testScript.id);
            expect(refind).to.have.property("compiled").have.property("code").include(testCode);
        });

        after(async () => {
            await testScript.destroy();
        });
    });

});
