import { Storage } from "../storage";

export type PlayerId = string;

export enum GameObjectTypes {
    ROOM = "r",
    PLAYER = "p",
    ITEM = "i",
    SCRIPT = "s",
    ACTION = "a"
}

export enum RootFields {
    ROOT_ROOM = "root_room",
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
}

export type MetaKeys = keyof MetaData;

export interface GameObjectMessage {
    rename: ObjectRenameEvent;
    move: ObjectMoveEvent;
}

export interface IGameObject {
    id: string;
}

export interface ObjectMoveEvent {
    oldOwner?: IGameObject;
    newOwner: IGameObject;
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
