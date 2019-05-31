import * as Bluebird from "bluebird";
import * as _ from "lodash";
import { VM } from "vm2";

import { JsSandbox, ObjectTypes, SandboxMetadata } from "./js-sandbox";
import { InteriorMessage, LocalCommand, MessageFormats } from "./netmodels";
import { GameObjectTypes, Player, Script, splitExtendedId, World } from "./objects";

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
    private getSandbox(thisScript: Script, runBy: Player, command: LocalCommand, executionList: Array<Promise<any>>): { "mue": JsSandbox } {
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
            meta?: { [key: string]: any },
            extendedFormat?: MessageFormats,
            extendedContent?: { [key: string]: any },
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

        const sandbox: JsSandbox = {
            "world": {
                "tell": (message: string, target?: string, meta?: { [key: string]: any }) => {
                    wrap_async(world_tell(message, target, meta));
                },
                "tellExtended": async (extendedFormat: MessageFormats, extendedContent: { [key: string]: any }, target?: string, meta?: { [key: string]: any }) => {
                    wrap_async(world_tell(undefined, target, meta, extendedFormat, extendedContent));
                },
                "connectedPlayers": () => {
                    return this.world.getConnectedPlayerIds();
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
                        return undefined;
                    }

                    // TODO: Clean this up
                    const meta: SandboxMetadata = {
                        ...obj.meta,
                        "type": gameObjectTypeToSandboxType(obj.type)
                    };

                    return meta;
                },
                "getProp": async (objectId: string, path: string) => {
                    const obj = await this.world.getObjectById(objectId);
                    if (!obj) {
                        return undefined;
                    }

                    return obj.getProp(path);
                },
                "getProps": async (objectId: string, paths?: string[]) => {
                    const obj = await this.world.getObjectById(objectId);
                    if (!obj) {
                        return undefined;
                    }

                    const props = await obj.getProps();
                    if (!paths || paths.length < 1) {
                        return props;
                    }

                    return _.pick(props, ...paths);
                },
                "getContents": async (objectId: string, type?: ObjectTypes) => {
                    return this.world.storage.getContents(objectId, sandboxTypeToGameObjectType(type));
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
                },
                "createTable": createTable,
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
            "Types": ObjectTypes,
            "Library": {
                "lodash": _,
                "bluebird": Bluebird.getNewLibraryCopy()
            }
        };

        let boxedSandbox = Object.seal({ "mue": sandbox });
        boxedSandbox = Object.preventExtensions(boxedSandbox);

        return new Proxy(boxedSandbox, {
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

function sandboxTypeToGameObjectType(sandboxType: ObjectTypes | undefined): GameObjectTypes | undefined {
    if (!sandboxType) {
        return undefined;
    }

    switch (sandboxType) {
        case ObjectTypes.Room:
            return GameObjectTypes.ROOM;
        case ObjectTypes.Player:
            return GameObjectTypes.PLAYER;
        case ObjectTypes.Item:
            return GameObjectTypes.ITEM;
        case ObjectTypes.Script:
            return GameObjectTypes.SCRIPT;
        case ObjectTypes.Action:
            return GameObjectTypes.ACTION;
    }
}

function gameObjectTypeToSandboxType(type: GameObjectTypes | undefined): ObjectTypes | undefined {
    if (!type) {
        return undefined;
    }

    switch (type) {
        case GameObjectTypes.ROOM:
            return ObjectTypes.Room;
        case GameObjectTypes.PLAYER:
            return ObjectTypes.Player;
        case GameObjectTypes.ITEM:
            return ObjectTypes.Item;
        case GameObjectTypes.SCRIPT:
            return ObjectTypes.Script;
        case GameObjectTypes.ACTION:
            return ObjectTypes.Action;
    }
}

function createTable(
    header: Array<string | { text: string; width?: number }>,
    ...data: string[][]
): {
    text: string;
    rawTable: string[][]
} {
    const textOutput: string[] = [];
    const cellOutput: string[][] = [];
    const maxWidth = 80;

    function forceWidth(str: string, width: number): string {
        return (str || "").substring(0, width).padEnd(width);
    }

    const colWidths: number[] = _.map(header, (v, k) => {
        if (typeof v === "string") {
            return maxWidth / header.length;
        } else {
            return v.width || (maxWidth / header.length);
        }
    });

    for (let row = -1; row < data.length; row++) {
        let rowStr = "";
        const rowCell: string[] = [];

        for (let column = 0; column < header.length; column++) {
            const col = header[column];
            const colWidth = colWidths[column];

            if (row < 0) {
                // Render header
                if (typeof col === "string") {
                    rowStr += forceWidth(col, colWidth);
                    rowCell.push(col);
                } else {
                    rowStr += forceWidth(col.text, colWidth);
                    rowCell.push(col.text);
                }
            } else {
                const cell = data[row][column];
                rowStr += forceWidth(cell, colWidth);
                rowCell.push(cell);
            }
        }

        textOutput.push(rowStr);
        cellOutput.push(rowCell);
    }

    return {
        "text": textOutput.join("\n"),
        "rawTable": cellOutput
    };
}
