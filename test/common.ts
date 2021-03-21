import { initLogger } from "../src/logging";
import { Action, Item, MetaData, Player, Room, RootFields, Script, World } from "../src/objects";
import { RedisConnection } from "../src/redis";
import { MockGameObject } from "./objects/gameobject.mock";
import { MockWorld } from "./objects/world.mock";
import { MockRedisConnection } from "./redis.mock";

export function init() {
    initLogger();
    const redis = MockRedisConnection.connect();
    const world = new MockWorld({ "redisConnection": redis });

    return { redis, world };
}

export async function beforeTestGroup(redis: RedisConnection, world: World) {
    // Start from scratch
    await redis.client.flushdb();

    // Bring up the world
    await world.init();

    // Create test player
    const rootPlayer = await Player.rootCreate(world, "RootPlayer");
    await world.storage.setRootValue(RootFields.GOD, rootPlayer.id);

    // Create the root room, which makes these tests a bit redundant but whatever we need it first
    const rootRoom = await Room.rootCreate(world, "RootRoom");
    await world.storage.setRootValue(RootFields.ROOT_ROOM, rootRoom.id);

    // Create a player root room
    const playerRoom = await Room.create(world, "PlayerRootRoom", rootPlayer, rootRoom);
    await world.storage.setRootValue(RootFields.PLAYER_ROOT, playerRoom.id);

    return { rootPlayer, rootRoom, playerRoom };
}

export async function afterTestGroup(world: World) {
    // Shut down the world connection
    await world.shutdown();
}

export function objectCreator(world: World, rootRoom: Room, rootPlayer: Player, playerRoom: Room) {
    function createTestAction(name?: string): Promise<Action> {
        return Action.create(world, `TestAct${name}`, rootPlayer, playerRoom);
    }

    function createTestPlayer(name?: string, password?: string): Promise<Player> {
        return Player.create(world, `Test player - ${name}`, password || "password", rootPlayer, rootRoom, playerRoom);
    }

    function createTestItem(name?: string): Promise<Item> {
        return Item.create(world, `Test item - ${name}`, rootPlayer, rootRoom, playerRoom);
    }

    function createTestRoom(name?: string): Promise<Room> {
        return Room.create(world, `Test room - ${name}`, rootPlayer, rootRoom, playerRoom);
    }

    function createTestScript(name?: string): Promise<Script> {
        return Script.create(world, `Test script - ${name}`, rootPlayer, playerRoom);
    }

    async function createTestObj(name?: string, id?: string): Promise<MockGameObject> {
        const mgo = new MockGameObject(world, new MetaData({
            "name": `Test Object - ${name}`,
            "creator": rootPlayer.id,
            "location": playerRoom.id,
            "parent": rootRoom.id,
        }), id);
        await world.storage.addObject(mgo);
        return mgo;
    }

    return {
        world,
        rootRoom,
        rootPlayer,
        playerRoom,
        createTestAction,
        createTestPlayer,
        createTestItem,
        createTestObj,
        createTestRoom,
        createTestScript
    };
}
