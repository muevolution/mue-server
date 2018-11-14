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

    // Start from scratch
    await redis.client.flushdb();

    // Players
    const player1 = await Player.create(world, "Hera");
    await world.storage.setRootValue(RootFields.GOD, player1.id);
    Logger.debug("Player 1 is" + player1.toString());

    // Rooms
    const room1 = await Room.create(world, "#0", player1);
    await world.storage.setRootValue(RootFields.ROOT_ROOM, room1.id);

    const proom = await Room.create(world, "Player Root", player1);
    await world.storage.setRootValue(RootFields.PLAYER_ROOT, proom.id);

    const room2 = await Room.create(world, "First Room", player1, room1);

    // Room actions
    const room1act = await Action.create(world, "roomzero", player1, room2);
    await room1act.setTarget(room1);

    const room2act = await Action.create(world, "roomone", player1, room1);
    await room2act.setTarget(room2);

    Logger.debug("Rooms are: " + [room1.toString(), room2.toString()]);

    // Put players in room
    await player1.move(room1);
    await player1.reparent(proom);
    Logger.debug("Player moves complete");

    // Create second player in one go
    const player2 = await Player.create(world, "Kauko", player1, proom, room1);
    Logger.debug("Player 2 is: " + player2.toString());

    // Load scripts
    await updateScripts(world, player1, room1, room1);
    Logger.debug("Code load complete");
}

main().then(() => {
    process.exit();
}).catch((err: any) => {
    Logger.error("Got error", err);
    process.exit(1);
});
