import * as Bluebird from "bluebird";
import { VM } from "vm2";

import { Logger } from "./logging";
import { LocalCommand, MessageFormats } from "./netmodels";
import { GameObjectTypes, Player, Script, World } from "./objects";

// TODO: Some form of timeslicing per player

export class ScriptManager {
    private vm: VM;

    constructor(private world: World) {
    }

    public async runScript(script: Script, runBy: Player, command: LocalCommand) {
        this.vm = new VM({
            "timeout": 10000,
            "sandbox": this.getSandbox(script, runBy, command)
        });

        await this.vm.run(script.compiled);
    }

    /* Sandbox tenents
       Never give the world a shared game object (World, GameObject, etc), always pass IDs
       Don't trust script input or execution
    */
    private getSandbox(thisScript: Script, runBy: Player, command: LocalCommand): {} {
        return {
            "world": {
                "tell": async (message: string, target?: string, meta?: {[key: string]: any}) => {
                    // TODO: Check that the user actually has permission to send to this target
                    // It should either be to themselves, another player(?), or the room they're in
                    const targetObj = target ? await this.world.getObjectById(target) : runBy;
                    if (!targetObj) {
                        throw new Error("Target not found");
                    }
                    return this.world.publishMessage({
                        message,
                        meta,
                        "source": runBy.id,
                        "script": thisScript.id
                    }, targetObj);
                },
                "tellExtended": async (extendedContent: string, extendedFormat: string | MessageFormats, target?: string, meta?: {[key: string]: any}) => {
                    const targetObj = target ? await this.world.getObjectById(target) : runBy;
                    if (!targetObj) {
                        throw new Error("Target not found");
                    }
                    const message = ""; // TODO: Figure out how to properly handle extended messages
                    return this.world.publishMessage({
                        message,
                        meta,
                        extendedContent,
                        extendedFormat,
                        "source": runBy.id,
                        "script": thisScript.id
                    }, targetObj);
                },
                "connectedPlayers": async () => {
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
                    Logger.debug("Script>DEBUG>", ...args);
                },
                "info": (...args: any[]) => {
                    Logger.debug("Script>INFO>", ...args);
                },
                "error": (...args: any[]) => {
                    Logger.debug("Script>ERROR>", ...args);
                }
            }
        };
    }
}
