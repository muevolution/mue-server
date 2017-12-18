import "source-map-support/register";

import * as express from "express";
import * as aa from "express-async-await";
import * as http from "http";
import * as _ from "lodash";
import * as socketio from "socket.io";

import { initLogger, Logger } from "./logging";
import { Player, Room, World } from "./objects";
import { PubSub } from "./pubsub";
import { RedisConnection } from "./redis";

initLogger();

const app = aa(express());
const server = new http.Server(app);
const io = socketio(server);

const redis = RedisConnection.connect({"host": "10.0.2.242", "port": 32769});
const world = new World({ "redisConnection": redis });

app.get("/", (req, res) => {
    res.send("Hello world!");
});

app.get("/players/:playerId", async (req, res) => {
    const player = await world.getPlayerById(req.route.playerId);
    if (!player) {
        return res.status(404).json({"error": true, "message": "Not found"});
    }

    const output = {
        "meta": player.meta
    };

    res.json(output);
});

app.get("/players", async (req, res) => {
    const players = await world.storage.getAllPlayers();
    res.json(players);
});

app.get("/rooms/:roomId", async (req, res) => {
    const room = await world.getRoomById(req.route.roomId);
    if (!room) {
        return res.status(404).json({"error": true, "message": "Not found"});
    }

    const output = {
        "meta": room.meta
    };

    res.json(output);
});

io.on("connection", (socket) => {
    Logger.debug("Got a connection");
    const ps = new PubSub(redis.client, socket, world);
    ps.init();
});

setInterval(async () => {
    await world.publishMessage(`The time is ${new Date().toISOString()}`);
}, 30000);

async function main() {
    await world.init();

    server.listen(3000, () => {
        Logger.info("Listening on port " + 3000);
    });
}

main().catch((err: any) => {
    Logger.error("Got top level error", err);
    process.exit(1);
});
