import "source-map-support/register";

import { initLogger, Logger } from "../logging";
import { Action, Player, Room, RootFields, World } from "../objects";
import { RedisConnection } from "../redis";
import { updateScripts } from "../reload-script";

initLogger();

// Bring up a new environment

const redis = RedisConnection.connect();
const world = new World({ "redisConnection": redis });

async function main() {
    await world.init();

    const active = await world.getActiveServers();
    if (active > 1) {
        Logger.error("A game server is still connected to this redis instance. Cannot continue.");
        return;
    }

    await redis.client.flushdbAsync();

    const player1 = await Player.create(world, "Hera", null, null);
    const player2 = await Player.create(world, "Kauko", player1, null);
    Logger.debug("Player is", [player1.toString(), player2.toString()]);
    await world.storage.setRootValue(RootFields.GOD, player1.id);

    const room = await Room.create(world, "#0", player1);
    Logger.debug("Room is", room.toString());
    await world.storage.setRootValue(RootFields.ROOT_ROOM, room.id);

    await player1.move(room);
    await player2.move(room);
    Logger.debug("Player moves complete");

    const room2 = await Room.create(world, "First Room", player1, room);

    const room1act = await Action.create(world, "roomzero", player1, room2);
    await room1act.setTarget(room);

    const room2act = await Action.create(world, "roomone", player1, room);
    await room2act.setTarget(room2);

    await updateScripts(world, player1, room, room);
    Logger.debug("Code load complete");
}

main().then(() => {
    process.exit();
}).catch((err: any) => {
    Logger.error("Got error", err);
    process.exit(1);
});
