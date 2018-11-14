import * as winston from "winston";

const standardFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  );

export function initLogger(logLevel: string = "debug") {
    Logger = winston.createLogger({
        "level": logLevel,
        "format": standardFormat,
        "transports": [
            new winston.transports.Console()
        ]
    });
}

export let Logger: winston.Logger;
