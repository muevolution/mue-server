// tslint:disable:max-classes-per-file

import { EventEmitter } from "events";

import { Logger } from "./logging";
import { MessageEvent } from "./netmodels";

interface CompatibleEmitter {
    emit(event: string, ...args: any[]): any;
    on(event: string, listener: (data: any) => void): any;
}

export class BaseTypedEmitter<O, I> {
    constructor(protected socket: CompatibleEmitter) {}

    public emit<T extends keyof O, K extends O[T]>(event: T, data: K) {
        return this.socket.emit(event, data);
    }

    public on<T extends keyof I, K extends I[T]>(event: T, listener: (data: K) => (Promise<any> | void), errorHandler?: (err: any) => any) {
        return this.socket.on(event, (data: K) => {
            let res: (Promise<any> | void);
            try {
                res = listener(data);
            } catch (err) {
                if (errorHandler) {
                    errorHandler(err);
                } else {
                    Logger.error("typedOn got error", err);
                    throw err;
                }

                return;
            }

            // Handle as a promise
            if (res && res.then) {
                res.catch((err) => {
                    if (errorHandler) {
                        errorHandler(err);
                    } else {
                        Logger.error("typedOn got error", err);
                    }
                });
            }
        });
    }
}

export class TypedEmitter<O extends MessageEvent, I extends MessageEvent> extends BaseTypedEmitter<O, I> {}
