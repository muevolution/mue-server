import { initLogger } from "../src/logging";
import { Player, Room, RootFields, World } from "../src/objects";
import { RedisConnection } from "../src/redis";

export function init() {
    initLogger();
    const redis = RedisConnection.connect();
    const world = new World({ "redisConnection": redis });

    return { redis, world };
}

export async function beforeTestGroup(redis: RedisConnection, world: World) {
    // Start from scratch
    await redis.client.flushdbAsync();

    // Bring up the world
    await world.init();

    // Create test player
    const rootPlayer = await Player.create(world, "RootPlayer");
    await world.storage.setRootValue(RootFields.GOD, rootPlayer.id);

    // Create the root room, which makes these tests a bit redundant but whatever we need it first
    const rootRoom = await Room.create(world, "RootRoom", rootPlayer);
    await world.storage.setRootValue(RootFields.ROOT_ROOM, rootRoom.id);

    // Create a player root room
    const playerRoom = await Room.create(world, "PlayerRootRoom", rootPlayer);
    await world.storage.setRootValue(RootFields.PLAYER_ROOT, playerRoom.id);

    return { rootPlayer, rootRoom, playerRoom };
}

export async function afterTestGroup(world: World) {
    // Shut down the world connection
    await world.shutdown();
}
