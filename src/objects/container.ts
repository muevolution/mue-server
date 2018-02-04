import * as _ from "lodash";

import { GameObject } from "./gameobject";
import { GameObjectTypes } from "./models";
import { World } from "./world";

export interface Container {
    getContents(type?: GameObjectTypes): Promise<GameObject[]>;
    find(term: string, type?: GameObjectTypes): Promise<GameObject>;
    findIn(term: string, type?: GameObjectTypes): Promise<GameObject>;
}

export async function GetContents(world: World, container: GameObject, type?: GameObjectTypes) {
    const contentIds = await world.storage.getContents(container, type);
    const contentP = _.map(contentIds, (id) => {
        return world.getObjectById(id, type);
    });
    return Promise.all(contentP);
}
