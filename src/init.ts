import "source-map-support/register";

import * as bluebird from "bluebird";
import * as fs from "fs";

import { initLogger, Logger } from "./logging";
import { Action, Player, Room, Script, World } from "./objects";
import { PubSub } from "./pubsub";
import { RedisConnection } from "./redis";

initLogger();
const readFile = (filename: string, encoding: string): Promise<string> => new Promise((resolve, reject) => {
    fs.readFile(filename, encoding, (err, res) => {
        if (err) {
            return reject(err);
        }
        resolve(res);
    });
});

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

    const room = await Room.create(world, "#0", player1);
    Logger.debug("Room is", room.toString());

    await player1.move(room);
    await player2.move(room);
    Logger.debug("Player moves complete");

    const whoScript = await Script.create(world, "who.js", player1, player1);
    await whoScript.updateCode(await readFile("scripts/who.js", "utf-8"));

    const whoAction = await Action.create(world, "who", player1, room);
    await whoAction.setTarget(whoScript);

    const sayScript = await Script.create(world, "say.js", player1, player1);
    await sayScript.updateCode(await readFile("scripts/say.js", "utf-8"));

    const sayAction = await Action.create(world, "say", player1, room);
    await sayAction.setTarget(sayScript);

    Logger.debug("Code load complete");
}

main().then(() => {
    process.exit();
}).catch((err: any) => {
    Logger.error("Got error", err);
    process.exit(1);
});
