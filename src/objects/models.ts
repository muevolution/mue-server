import { Storage } from "../storage";

export type PlayerId = string;

export enum GameObjectTypes {
    ROOM = "r",
    PLAYER = "p",
    ITEM = "i"
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

export enum MetaKeys {
    NAME = "name",
    CREATOR = "creator",
    PARENT = "parent"
}

export type MetaData = HashResult<MetaKeys>;

export enum ObjectEvents {
    MOVE = "move",
    RENAME = "rename"
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
