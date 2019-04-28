import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { ObjectCache } from "../src/objectcache";
import { GameObjectTypes, Player } from "../src/objects";
import { afterTestGroup, beforeTestGroup, init } from "./common";

const { redis, world } = init();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

describe("ObjectCache", () => {
    let rootPlayer: Player;

    before(async () => {
        const results = await beforeTestGroup(redis, world);
        rootPlayer = results.rootPlayer;
    });

    after(async () => {
        await afterTestGroup(world);
    });

    describe(".constructor", () => {
        it("should construct successfully", async () => {
            const oc = new ObjectCache(world);
            expect(oc).to.be.a("ObjectCache");
        });
    });

    describe("#getObject", () => {
        it("should return null when object doesn't exist", () => {
            const actual = world.objectCache.getObject("r:asmdf");
            expect(actual).to.be.null;
        });

        it("should return an object from the cache", () => {
            const actual = world.objectCache.getObject(rootPlayer.id, GameObjectTypes.PLAYER);
            expect(actual).to.have.property("type").equal(GameObjectTypes.PLAYER);
        });
    });

    xdescribe("#standardCreate", () => { });

    xdescribe("#standardImitate", () => { });

    describe("#hasObjectId", () => {
        it("should return false with an object not in the cache", () => {
            const actual = world.objectCache.hasObjectId("r:asdmf");
            expect(actual).to.be.false;
        });

        it("should return true with an object in the cache", () => {
            const actual = world.objectCache.hasObjectId(rootPlayer.id);
            expect(actual).to.be.true;
        });
    });

    xdescribe("#invalidate", () => { });

    xdescribe("#invalidateLocal", () => { });

    xdescribe("#invalidateAll", () => { });

    xdescribe("#onDestroy", () => { });

    xdescribe("#postDestroy", () => { });
});
