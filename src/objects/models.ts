import * as _ from "lodash";

export enum GameObjectTypes {
    ROOM = "r",
    PLAYER = "p",
    ITEM = "i",
    SCRIPT = "s",
    ACTION = "a"
}

export enum RootFields {
    ROOT_ROOM = "root_room",
    START_ROOM = "start_room",
    PLAYER_ROOT = "player_root",
    GOD = "god"
}

export const ALL_GAME_OBJECT_TYPES: GameObjectTypes[] = [
    GameObjectTypes.ROOM,
    GameObjectTypes.PLAYER,
    GameObjectTypes.ITEM,
    GameObjectTypes.SCRIPT,
    GameObjectTypes.ACTION
];

export const ALL_CONTAINER_TYPES: GameObjectTypes[] = [
    GameObjectTypes.ROOM,
    GameObjectTypes.PLAYER,
    GameObjectTypes.ITEM
];

export const ALL_PARENT_TYPES = ALL_CONTAINER_TYPES;

export interface ExtendedId {
    "id"?: string;
    "shortid": string;
    "type"?: GameObjectTypes;
}

export function splitExtendedId(id: string | null, checkType?: GameObjectTypes): ExtendedId | null {
    if (!id) {
        return null;
    }

    const a = id.split(":");
    if (a.length < 2) {
        return { "shortid": a[0] };
    } else {
        if (!a[1]) {
            return null;
        }

        const type = a[0] as GameObjectTypes;

        if (ALL_GAME_OBJECT_TYPES.indexOf(type) < 0) {
            // TODO: Specific error class
            throw new Error(`Invalid object type (${type})`);
        } else if (checkType && type !== checkType) {
            // TODO: Specific error class
            throw new Error(`Object ID ${id} does not match requested type ${checkType}`);
        }

        return { id, type, "shortid": a[1] };
    }
}

export function expectExtendedId(id: string | null, type: GameObjectTypes): string | null {
    const exid = splitExtendedId(id, type);
    if (!exid) {
        return null;
    }

    if (exid.type && exid.type !== type) {
        // TODO: Specific error class
        throw new Error(`Object ID ${id} does not match requested type ${type}`);
    } else if (exid.type) {
        return id;
    } else {
        return `${type}:${id}`;
    }
}

export type HashResult<T extends string> = {
    [P in T]: string;
};

export interface MetaDataValues {
    name: string;
    creator: string;
    parent: string;
    location?: string
};

export class MetaData {
    name: string;
    creator: string;
    parent: string;
    location?: string;

    constructor(data: MetaDataValues | Record<string, string>) {
        this.name = data.name;
        this.creator = data.creator;
        this.parent = data.parent;
        this.location = data.location;
    }

    toJSON(): { [key: string]: string | undefined | null } {
        return _.mapValues(this, _.identity) as { [key: string]: string | undefined | null };
    }

    toRecord(): Record<string, string> {
        const json = this.toJSON();
        return _.filter(json, f => !!f) as any as Record<string, string>;
    }

    __clone(): MetaData {
        return new MetaData(this.toJSON() as any);
    }
}

export interface GameObjectMessage {
    rename: ObjectRenameEvent;
    reparent: ObjectReparentEvent;
    move: ObjectMoveEvent;
}

export interface IGameObject {
    id: string;
}

export interface ObjectReparentEvent {
    oldParent?: IGameObject;
    newParent: IGameObject;
}

export interface ObjectMoveEvent {
    oldLocation?: IGameObject;
    newLocation: IGameObject;
}

export interface ObjectRenameEvent {
    oldName?: string;
    newName: string;
}

export interface PlayerMessage extends GameObjectMessage {
    quit: string;
}

interface InterServerMessageAll {
    event: "joined" | "invalidate_script" | "update_object";
    instance: string;
    meta?: any;
}

interface InterServerMessageJoined extends InterServerMessageAll {
    event: "joined";
}

interface InterServerMessageInvalidateScript extends InterServerMessageAll {
    event: "invalidate_script";
}

interface InterServerMessageUpdateObject extends InterServerMessageAll {
    event: "update_object";
    meta: {
        id: string;
        message: "invalidate" | "destroyed";
    };
}

export type InterServerMessage = InterServerMessageJoined | InterServerMessageInvalidateScript | InterServerMessageUpdateObject;
