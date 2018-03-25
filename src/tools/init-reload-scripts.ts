import "source-map-support/register";

import { initLogger, Logger } from "../logging";
import { World } from "../objects";
import { RedisConnection } from "../redis";
import { updateScripts } from "../reload-script";

initLogger();

// Reload scripts

const redis = RedisConnection.connect();
const world = new World({ "redisConnection": redis });

async function main() {
    await world.init();

    const player1 = await world.getPlayerByName("Hera");
    const room = await world.getRootRoom();

    await updateScripts(world, player1, room, room);
    Logger.debug("Code load complete");
}

main().then(() => {
    process.exit();
}).catch((err: any) => {
    Logger.error("Got error", err);
    process.exit(1);
});
