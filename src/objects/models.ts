export enum GameObjectTypes {
    ROOM = "r",
    PLAYER = "p",
    ITEM = "i",
    SCRIPT = "s",
    ACTION = "a"
}

export enum RootFields {
    ROOT_ROOM = "root_room",
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

export function splitExtendedId(id: string, checkType?: GameObjectTypes): {"id": string, "type"?: GameObjectTypes} {
    if (!id) {
        return null;
    }

    const a = id.split(":");
    if (a.length < 2) {
        return {"id": a[0]};
    } else {
        if (!a[1]) {
            return null;
        }

        const type = a[0] as GameObjectTypes;

        if (ALL_GAME_OBJECT_TYPES.indexOf(type) < 0) {
            throw new Error(`Invalid object type (${type})`);
        } else if (checkType && type !== checkType) {
            throw new Error(`Object ID ${id} does not match requested type ${checkType}`);
        }

        return {type, "id": a[1]};
    }
}

export function expectExtendedId(id: string, type: GameObjectTypes): string {
    const exid = splitExtendedId(id, type);
    if (!exid) {
        return null;
    }

    if (exid.type && exid.type !== type) {
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

export interface MetaData {
    name: string;
    creator: string;
    parent: string;
    location: string;
}

export type MetaKeys = keyof MetaData;

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

export interface InterServerMessage {
    event: "joined" | "invalidate_script";
    meta?: {
        instance?: string;
    };
}
