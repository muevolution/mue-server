import "source-map-support/register";

import { initLogger, Logger } from "../logging";
import { Player, Room, RootFields, World } from "../objects";
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
    const player1 = await Player.rootCreate(world, "Hera");
    await world.storage.setRootValue(RootFields.GOD, player1.id);
    Logger.debug("Player 1 is" + player1.toString());

    // Rooms
    const room0 = await Room.rootCreate(world, "#0");
    await world.storage.setRootValue(RootFields.ROOT_ROOM, room0.id);

    const playerRootRoom = await Room.create(world, "Player Root", player1, room0);
    await world.storage.setRootValue(RootFields.PLAYER_ROOT, playerRootRoom.id);

    Logger.debug("Rooms are: " + [room0.toString(), playerRootRoom.toString()]);

    // Put players in room
    await player1.move(room0);
    await player1.reparent(playerRootRoom);
    Logger.debug("Player moves complete");

    // Create second player in one go
    const player2 = await Player.create(world, "Kauko", player1, playerRootRoom, room0);
    Logger.debug("Player 2 is: " + player2.toString());

    // Load scripts
    await updateScripts(world, player1, room0, room0);
    Logger.debug("Code load complete");
}

main().then(() => {
    process.exit();
}).catch((err: any) => {
    Logger.error("Got error", err);
    process.exit(1);
});
