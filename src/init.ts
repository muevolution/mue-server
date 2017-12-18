import "source-map-support/register";

import { initLogger, Logger } from "./logging";
import { Player, Room, World } from "./objects";
import { PubSub } from "./pubsub";
import { RedisConnection } from "./redis";

initLogger();

// Bring up a new environment

const redis = RedisConnection.connect({"host": "10.0.2.242", "port": 32769});
const world = new World({ "redisConnection": redis });

async function main() {
    await redis.client.flushdbAsync();

    const player1 = await Player.create(world, "Hera", null, null);
    const player2 = await Player.create(world, "Kauko", player1, null);
    Logger.debug("Player is", [player1.toString(), player2.toString()]);

    const room = await Room.create(world, "#0", player1);
    Logger.debug("Room is", room.toString());

    await player1.move(room);
    await player2.move(room);
    Logger.debug("Player moves complete");
}

main().then(() => {
    process.exit();
}).catch((err: any) => {
    Logger.error("Got error", err);
    process.exit(1);
});
