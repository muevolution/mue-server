import * as Bluebird from "bluebird";
import { VM } from "vm2";

import { LocalCommand, MessageFormats } from "../client_types";
import { JsSandbox } from "./js-sandbox";
import { Logger } from "./logging";
import { GameObjectTypes, Player, Script, World } from "./objects";

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
            message: string,
            target?: string,
            meta?: {[key: string]: any},
            extendedContent?: string,
            extendedFormat?: string | MessageFormats
        ) => {
            // TODO: Check that the user actually has permission to send to this target
            // It should either be to themselves, another player(?), or the room they're in
            const targetObj = target ? await this.world.getObjectById(target) : runBy;
            if (!targetObj) {
                throw new Error("Target not found");
            }
            if (extendedContent || extendedFormat) {
                message = ""; // TODO: Figure out how to properly handle extended messages
            }
            await this.world.publishMessage({
                message,
                meta,
                extendedContent,
                extendedFormat,
                "source": runBy.id,
                "script": thisScript.id
            }, targetObj);
        };

        // TODO: Mask functions from client (proxy?)
        return {
            "world": {
                "tell": (message: string, target?: string, meta?: {[key: string]: any}) => {
                    wrap_async(world_tell(message, target, meta));
                },
                "tellExtended": async (extendedContent: string, extendedFormat: string | MessageFormats, target?: string, meta?: {[key: string]: any}) => {
                    wrap_async(world_tell(null, target, meta, extendedContent, extendedFormat));
                },
                "connectedPlayers": () => {
                    return this.world.getConnectedPlayerIds();
                },
                // TODO: These should probably just be generic for objects
                "getPlayerNameFromId": async (playerId: string) => {
                    const player = await this.world.getPlayerById(playerId);
                    if (!player) {
                        return null;
                    }

                    return player.name;
                },
                "getPlayerIdFromName": async (playerName: string) => {
                    const player = await this.world.getPlayerByName(playerName);
                    if (!player) {
                        return null;
                    }

                    return player.id;
                },
                "getParent": async (objectId: string) => {
                    const obj = await this.world.getObjectById(objectId);
                    const parent = await obj.parent;
                    if (!parent) {
                        return null;
                    }

                    return parent.id;
                }
            },
            "script": {
                "thisScript": thisScript.id,
                "thisPlayer": runBy.id,
                command
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
            }
        };
    }
}
