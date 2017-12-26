import * as nconf from "nconf";
import * as redis from "redis";

export interface TelnetConfig {
    port: number;
    target_url: string;
}

function loadConfig() {
    const n = nconf
        .env({"separator": "__", "parseValues": true})
        .file({"file": "mue.config.json", "dir": "../"})
        .defaults({
            "port": 3000,
            "telnet": {
                "port": 8888,
                "target_url": "http://localhost:3000/"
            }
        });
    n.load();
    return n;
}

const configEnv = loadConfig();

export const config = {
    "redis": configEnv.get("redis") as redis.ClientOpts,
    "port": configEnv.get("port") as number,
    "telnet": configEnv.get("telnet") as TelnetConfig
};
