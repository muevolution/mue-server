import * as bluebird from "bluebird";
import * as _ from "lodash";

import { notEmpty } from "../common";
import { Action } from "./action";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { GameObjectTypes } from "./models";
import { Player } from "./player";
import { Room } from "./room";
import { Script } from "./script";
import { World } from "./world";

export interface Container {
    getContents(type?: GameObjectTypes): Promise<(GameObject | null)[]>;
    find(term: string, type?: GameObjectTypes): Promise<GameObject | null>;
    findIn(term: string, type?: GameObjectTypes): Promise<GameObject | null>;
}

export interface GameObjectContainer extends GameObject, Container { }

export async function GetContents(world: World, container: GameObject, type: GameObjectTypes.ROOM): Promise<Room[]>;
export async function GetContents(world: World, container: GameObject, type: GameObjectTypes.PLAYER): Promise<Player[]>;
export async function GetContents(world: World, container: GameObject, type: GameObjectTypes.ITEM): Promise<Item[]>;
export async function GetContents(world: World, container: GameObject, type: GameObjectTypes.SCRIPT): Promise<Script[]>;
export async function GetContents(world: World, container: GameObject, type: GameObjectTypes.ACTION): Promise<Action[]>;
export async function GetContents(world: World, container: GameObject, type?: GameObjectTypes): Promise<GameObject[]>;
export async function GetContents(world: World, container: GameObject, type?: GameObjectTypes): Promise<GameObject[]> {
    const results = await bluebird.map(
        world.storage.getContents(container, type),
        (id) => world.getObjectById(id, type)
    );
    return results.filter(notEmpty);
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
