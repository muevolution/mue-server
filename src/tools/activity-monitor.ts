import "source-map-support/register";

import { initLogger, Logger } from "../logging";
import { RedisConnection } from "../redis";

initLogger();

// Bring up a new environment

const redis = RedisConnection.connect();

async function main() {
    Logger.info("Starting activity monitor");

    await redis.client.psubscribe("*");
    redis.client.on("pmessage", (filter, channel, message) => {
        Logger.info(`[${channel}]>> ${message}`);
    });
}

main().catch((err: any) => {
    Logger.error("Got error", err);
    process.exit(1);
});
