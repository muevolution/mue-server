import { Storage } from "../storage";

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

export function splitExtendedId(id: string): {"id": string, "type"?: GameObjectTypes} {
    const a = id.split(":");
    if (a.length < 2) {
        return {"id": a[0]};
    } else {
        return {"type": a[0] as GameObjectTypes, "id": a[1]};
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
    event: string;
    meta?: {};
}
