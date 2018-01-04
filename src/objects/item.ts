import * as _ from "lodash";

import { Action } from "./action";
import { GameObject } from "./gameobject";
import { GameObjectTypes, MetaData, MetaKeys } from "./models";
import { Player } from "./player";
import { Room } from "./room";
import { World } from "./world";

export class Item extends GameObject {
    static async create(world: World, name: string, creator: Player, parent: Room | Player | Item) {
        const p = new Item(world, {
            name,
            "creator": creator.id,
            "parent": parent.id
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

    public get parent(): Promise<Room | Player | Item> {
        return super.parent as Promise<Room | Player | Item>;
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
