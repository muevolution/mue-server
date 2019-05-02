import * as Bluebird from "bluebird";
import * as _ from "lodash";
import { VM } from "vm2";

import { JsSandbox } from "./js-sandbox";
import { InteriorMessage, LocalCommand, MessageFormats } from "./netmodels";
import { Player, Script, World, splitExtendedId } from "./objects";

// TODO: Some form of timeslicing per player

export class ScriptManager {
    private vm: VM;

    constructor(private world: World) {
    }

    public async runScript(script: Script, runBy: Player, command: LocalCommand) {
        const executionList: Array<Promise<any>> = [];

        this.vm = new VM({
            "timeout": 10000,
            "sandbox": this.getSandbox(script, runBy, command, executionList)
        });

        await this.vm.run(script.compiled);
        await Bluebird.any(executionList);
    }

    /* Sandbox tenents
       Never give the world a shared game object (World, GameObject, etc), always pass IDs
       Don't trust script input or execution
    */
    private getSandbox(thisScript: Script, runBy: Player, command: LocalCommand, executionList: Array<Promise<any>>): JsSandbox {
        const user_log = async (level: string, ...args: any[]) => {
            await this.world.publishMessage(`Script>${level}> ${JSON.stringify(args)}`, runBy);
        };

        // Wrapper for one-shot functions to prevent needing an await in user code
        const wrap_async = (result: Promise<void>) => {
            const p = result.catch(async (err) => {
                await user_log("error", err.message);
                return Promise.resolve();
            });
            executionList.push(p);
        };

        const world_tell = async (
            message?: string,
            target?: string,
            meta?: {[key: string]: any},
            extendedFormat?: MessageFormats,
            extendedContent?: {[key: string]: any},
        ) => {
            // TODO: Check that the user actually has permission to send to this target
            // It should either be to themselves, another player(?), or the room they're in
            const targetObj = target ? await this.world.getObjectById(target) : runBy;
            if (!targetObj) {
                throw new Error("Target not found");
            }
            const im: InteriorMessage = {
                message,
                meta,
                extendedContent,
                extendedFormat,
                "source": runBy.id,
                "script": thisScript.id
            };
            await this.world.publishMessage(im, targetObj);
        };

        let sandbox: JsSandbox = {
            "world": {
                "tell": (message: string, target?: string, meta?: {[key: string]: any}) => {
                    wrap_async(world_tell(message, target, meta));
                },
                "tellExtended": async (extendedFormat: MessageFormats, extendedContent: {[key: string]: any}, target?: string, meta?: {[key: string]: any}) => {
                    wrap_async(world_tell(undefined, target, meta, extendedFormat, extendedContent));
                },
                "connectedPlayers": () => {
                    return this.world.getConnectedPlayerIds();
                },
                // TODO: These should probably just be generic for objects
                "getPlayerNameFromId": async (playerId: string) => {
                    const player = await this.world.getPlayerById(playerId);
                    if (!player) {
                        return undefined;
                    }

                    return player.name;
                },
                "getPlayerIdFromName": async (playerName: string) => {
                    const player = await this.world.getPlayerByName(playerName);
                    if (!player) {
                        return undefined;
                    }

                    return player.id;
                },
                "getParent": async (objectId: string) => {
                    const obj = await this.world.getObjectById(objectId);
                    if (!obj) {
                        return undefined;
                    }

                    return obj.parent;
                },
                "getLocation": async (objectId: string) => {
                    const obj = await this.world.getObjectById(objectId);
                    if (!obj) {
                        return undefined;
                    }

                    return obj.location;
                },
                "find": async (target: string) => {
                    const obj = await runBy.resolveTarget(target);
                    if (!obj) {
                        return undefined;
                    }

                    return obj.id;
                },
                "getDetails": async (objectId: string) => {
                    const obj = await this.world.getObjectById(objectId);
                    if (!obj) {
                        return {};
                    }

                    // TODO: Clean this up
                    const meta = _.cloneDeep(obj.meta) as {[key: string]: string};
                    meta.type = obj.type;

                    return meta;
                },
                "getProp": async (objectId: string, path: string) => {
                    const obj = await this.world.getObjectById(objectId);
                    if (!obj) {
                        return undefined;
                    }

                    return obj.getProp(path);
                },
                "getContents": async (objectId: string) => {
                    return this.world.storage.getContents(objectId);
                }
            },
            "script": {
                "thisScript": thisScript.id,
                "thisPlayer": runBy.id,
                command
            },
            "Util": {
                "splitId": (objectId: string) => {
                    return splitExtendedId(objectId) as any;
                }
            },
            "Log": {
                "debug": (...args: any[]) => {
                    wrap_async(user_log("debug", ...args));
                },
                "info": (...args: any[]) => {
                    wrap_async(user_log("info", ...args));
                },
                "error": (...args: any[]) => {
                    wrap_async(user_log("error", ...args));
                }
            },
            "Types": {
                "Room": "r",
                "Player": "p",
                "Item": "i",
                "Script": "s",
                "Action": "a"
            },
            "Library": {
                "lodash": _
            }
        };

        sandbox = Object.seal(sandbox);
        sandbox = Object.preventExtensions(sandbox);

        return new Proxy(sandbox, {
            "setPrototypeOf": () => {
                return false;
            },
            "isExtensible": () => {
                return false;
            },
            "preventExtensions": () => {
                return false;
            },
            "defineProperty": () => {
                return false;
            },
            "set": () => {
                return false;
            },
            "deleteProperty": () => {
                return false;
            }
        });
    }
}
