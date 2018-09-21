// tslint:disable:max-classes-per-file

import * as shortid from "shortid";
import * as util from "util";

import { MessageEvent } from "../client_types";
import { Logger } from "./logging";
import { AsyncRedisClient } from "./redis";

export function generateId(): string {
    return shortid.generate().toLowerCase().replace("_", "a").replace("-", "b");
}

export function RedisClientDebug(client: AsyncRedisClient, msg: {}) {
    // TODO: Add debug toggle
    if (!client) { return; }
    client.publish("c:debug", util.inspect(msg), (err, reply) => {
        // Don't actually care, this is throwaway debugging
    });
}

interface CompatibleEmitter {
    emit(event: string, ...args: any[]): any;
    on(event: string, listener: (data: any) => void): any;
}

export class BaseTypedEmitter<O, I> {
    constructor(protected socket: CompatibleEmitter, protected redisClient?: AsyncRedisClient) {}

    public emit<T extends Extract<keyof O, string>, K extends O[T]>(event: T, data: K) {
        RedisClientDebug(this.redisClient, {"type": "outbound", event, data});
        return this.socket.emit(event, data);
    }

    public on<T extends Extract<keyof I, string>, K extends I[T]>(event: T, listener: (data: K) => (Promise<any> | void), errorHandler?: (err: any) => any) {
        return this.socket.on(event, (data: K) => {
            const res = Promise.resolve(listener(data));
            res.then((d) => {
                RedisClientDebug(this.redisClient, {"type": "inbound", event, "data": data});
                return d;
            }).catch((err) => {
                RedisClientDebug(this.redisClient, {"type": "inbound", event, "error": err.message});
                if (errorHandler) {
                    errorHandler(err);
                } else {
                    Logger.error("typedOn got error", err);
                }
            });
        });
    }
}

export class TypedEmitter<O extends MessageEvent, I extends MessageEvent> extends BaseTypedEmitter<O, I> {}
