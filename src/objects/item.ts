import * as _ from "lodash";

import { Action } from "./action";
import { Container, GetContents } from "./container";
import { GameObject } from "./gameobject";
import { ItemLocations, ItemParents } from "./model-aliases";
import { GameObjectTypes, MetaData, MetaKeys } from "./models";
import { Player } from "./player";
import { Room } from "./room";
import { Script } from "./script";
import { World } from "./world";

export class Item extends GameObject implements Container {
    static async create(world: World, name: string, creator: Player, parent: ItemParents, location?: ItemLocations) {
        const p = new Item(world, {
            name,
            "creator": creator.id,
            "parent": parent.id,
            "location": location ? location.id : parent.id
        });
        await world.storage.addObject(p);
        return p;
    }

    static async imitate(world: World, id: string) {
        const meta = await world.storage.getMeta(id);
        if (!meta) {
            throw new Error(`Item ${id} not found`);
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

    getContents(type?: GameObjectTypes) {
        return GetContents(this.world, this, type);
    }

    async find(term: string, type?: GameObjectTypes): Promise<GameObject> {
        return this.findIn(term, type);
    }

    async findIn(term: string, type?: GameObjectTypes): Promise<GameObject> {
        const contents = await this.getContents();

        if (type === GameObjectTypes.ACTION) {
            const actions = _.filter(contents, (c) => c.type === GameObjectTypes.ACTION) as Action[];
            return _.find(actions, (a) => a.matchCommand(term));
        }

        // Test general item names
        return _.find(contents, (c) => c.type === type && c.matchName(term));
    }
}
