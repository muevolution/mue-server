import * as _ from "lodash";

import { GameObjectIdDoesNotExist, GameObjectIdExistsError } from "../errors";
import { Action } from "./action";
import { Container, GetContents, SpillContents } from "./container";
import { GameObject } from "./gameobject";
import { ItemLocations, ItemParents } from "./model-aliases";
import { GameObjectTypes, MetaData } from "./models";
import { Player } from "./player";
import { Room } from "./room";
import { Script } from "./script";
import { World } from "./world";

// TODO: If we want to support multi-server we need to use many-instance with some sort of cross-server lifecycle system
// Right now, an item ('s meta) could be updated on one server and not another
const ITEM_CACHE = {} as {[id: string]: Item};

export class Item extends GameObject implements Container {
    static async create(world: World, name: string, creator: Player, parent: ItemParents, location?: ItemLocations) {
        const p = new Item(world, {
            name,
            "creator": creator.id,
            "parent": parent.id,
            "location": location ? location.id : parent.id
        });
        if (ITEM_CACHE[p.id]) {
            throw new GameObjectIdExistsError(p.id, GameObjectTypes.ITEM);
        }
        await world.storage.addObject(p);
        ITEM_CACHE[p.id] = p;
        return p;
    }

    static async imitate(world: World, id: string) {
        if (ITEM_CACHE[id]) {
            return ITEM_CACHE[id];
        }

        const meta = await world.storage.getMeta(id);
        if (!meta) {
            throw new GameObjectIdDoesNotExist(id, GameObjectTypes.ITEM);
        }

        return new Item(world, meta, id);
    }

    protected constructor(world: World, meta?: MetaData, id?: string) {
        super(world, GameObjectTypes.ITEM, meta, id);
    }

    public getParent(): Promise<ItemParents> {
        return super.getParent() as Promise<ItemParents>;
    }

    public getLocation() {
        return super.getLocation() as Promise<ItemLocations>;
    }

    getContents(type: GameObjectTypes.ROOM): Promise<Room[]>;
    getContents(type: GameObjectTypes.PLAYER): Promise<Player[]>;
    getContents(type: GameObjectTypes.ITEM): Promise<Item[]>;
    getContents(type: GameObjectTypes.SCRIPT): Promise<Script[]>;
    getContents(type: GameObjectTypes.ACTION): Promise<Action[]>;
    getContents(type?: GameObjectTypes): Promise<GameObject[]>;
    getContents(type?: GameObjectTypes): Promise<GameObject[]> {
        return GetContents(this.world, this, type);
    }

    async find(term: string, type?: GameObjectTypes): Promise<GameObject> {
        return this.findIn(term, type);
    }

    async findIn(term: string, type?: GameObjectTypes): Promise<GameObject> {
        const contents = await this.getContents();
        if (_.isEmpty(contents)) {
            return null;
        }

        if (type === GameObjectTypes.ACTION) {
            const actions = _.filter(contents, (c) => c.type === GameObjectTypes.ACTION) as Action[];
            return _.find(actions, (a) => a.matchCommand(term)) || null;
        }

        // Test general item names
        return _.find(contents, (c) => (!type || c.type === type) && c.matchName(term)) || null;
    }

    async destroy(): Promise<boolean> {
        if (!await SpillContents(this.world, this)) {
            // TODO: Throw error or something
            return false;
        }

        return super.destroy();
    }

    protected getCache() {
        return ITEM_CACHE;
    }
}
