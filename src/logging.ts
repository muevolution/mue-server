import * as winston from "winston";
import { LoggerInstance, Winston } from "winston";

export function initLogger(logLevel: string = "debug") {
    Logger = new (winston.Logger)({
        "level": logLevel,
        "transports": [
            new (winston.transports.Console)({})
        ]
    });
}

export let Logger: LoggerInstance;
