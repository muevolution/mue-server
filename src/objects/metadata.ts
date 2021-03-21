import { ActionMetaData } from "./action";
import { GameObject } from "./gameobject";
import { GameObjectTypes, MetaData, splitExtendedId } from "./models";
import { PlayerMetaData } from "./player";

export function GetMetaDataType(object: GameObject<any> | string): new (params: Record<string, string>) => any {
    let type: GameObjectTypes;

    if (typeof object === "object") {
        type = object.type;
    } else if (typeof object === "string") {
        const split = splitExtendedId(object);
        if (split?.type) {
            type = split.type;
        } else {
            throw new Error("Invalid ID type");
        }
    } else {
        throw new Error("Invalid parameter");
    }

    switch (type) {
        case GameObjectTypes.ACTION:
            return ActionMetaData;
        case GameObjectTypes.PLAYER:
            return PlayerMetaData;
        default:
            return MetaData;
    }
}
