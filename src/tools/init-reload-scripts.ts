import "source-map-support/register";

import { initLogger, Logger } from "../logging";
import { RootFields, World } from "../objects";
import { RedisConnection } from "../redis";
import { updateScripts } from "../reload-script";

initLogger();

// Reload scripts

const redis = RedisConnection.connect();
const world = new World({ "redisConnection": redis });

async function main() {
    await world.init();

    const playerRoot = await world.storage.getRootValue(RootFields.GOD);
    if (!playerRoot) {
        throw new Error("Could not find player root value. Did you init the server?");
    }

    const player1 = await world.getPlayerById(playerRoot);
    if (!player1) {
        throw new Error("Could not find root player. Did you init the server?");
    }

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
