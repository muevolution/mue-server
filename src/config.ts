import * as nconf from "nconf";

export interface TelnetConfig {
    port: number;
    target_url: string;
}

function loadConfig() {
    const n = nconf.env({"separator": "__", "parseValues": true});

    n.file({"file": "mue.config.json", "dir": "../"});

    if (process.env.NODE_ENV === "test") {
        n.file({"file": "mue.config.test.json", "dir": "../"});
    }

    n.defaults({
        "port": 3000
    });

    n.load();

    return n;
}

const configEnv = loadConfig();

export const config = {
    "redis": configEnv.get("redis") as import("ioredis").RedisOptions,
    "port": configEnv.get("port") as number,
};
