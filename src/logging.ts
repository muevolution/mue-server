import * as winston from "winston";

export function initLogger(logLevel: string = "debug") {
    Logger = winston.createLogger({
        "level": logLevel,
        "transports": [
            new winston.transports.Console()
        ]
    });
}

export let Logger: winston.Logger;
