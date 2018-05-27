import * as _ from "lodash";

import { GameObject } from "./gameobject";
import { GameObjectTypes } from "./models";
import { World } from "./world";

export interface Container {
    getContents(type?: GameObjectTypes): Promise<GameObject[]>;
    find(term: string, type?: GameObjectTypes): Promise<GameObject>;
    findIn(term: string, type?: GameObjectTypes): Promise<GameObject>;
}

export interface GameObjectContainer extends GameObject, Container {}

export async function GetContents(world: World, container: GameObject, type?: GameObjectTypes) {
    const contentIds = await world.storage.getContents(container, type);
    const contentP = _.map(contentIds, (id) => {
        return world.getObjectById(id, type);
    });
    return Promise.all(contentP);
}

export async function SpillContents(world: World, container: GameObjectContainer) {
    // TODO: This will need to reparent all the children somehow too

    const newParent = await container.getLocation();
    const contents = await GetContents(world, container);
    if (contents.length < 1) {
        return true;
    }

    // Move all the objects in a transaction
    // TODO: Traditionally this sends everything 'home', should we dump to parent instead?
    const result = await world.storage.moveObjects(contents, newParent, container);
    if (!result) {
        return false;
    }

    // Update all the objects with their new container
    _.forEach(contents, (obj) => obj.postMove(newParent, container));

    return true;
}
