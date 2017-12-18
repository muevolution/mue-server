import * as _ from "lodash";

import { Action } from "./action";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { GameObjectTypes, MetaData, MetaKeys } from "./models";
import { Player } from "./player";
import { World } from "./world";

const ROOM_CACHE = {} as {[id: string]: Room};

export class Room extends GameObject {
    static async create(world: World, name: string, creator: Player, parent?: Room) {
        const p = new Room(world, {
            name,
            "creator": creator.id,
            "parent": parent ? parent.id : null
        });
        await world.storage.addObject(p);
        ROOM_CACHE[p.id] = p;
        return p;
    }

    static async imitate(world: World, id: string) {
        if (ROOM_CACHE[id]) {
            return ROOM_CACHE[id];
        }

        const meta = await world.storage.getMeta(id);
        if (!meta) {
            throw new Error(`Room ${id} not found`);
        }

        const p = new Room(world, meta, id);
        ROOM_CACHE[id] = p;
        return p;
    }

    protected constructor(world: World, meta?: MetaData, id?: string) {
        super(world, GameObjectTypes.ROOM, meta, id);
    }

    public get parent(): Promise<Room> {
        return super.parent as Promise<Room>;
    }

    // TODO: This method needs optimization/caching
    async find(command: string): Promise<Action> {
        // Search this room first
        const firstSearch = await this.findIn(command);
        if (firstSearch) {
            return firstSearch;
        }

        // Now search the parent tree
        let current = await this.parent;
        while (current) {
            const action = await current.findIn(command);
            if (action) {
                return action;
            }

            current = await current.parent;
        }

        return null;
    }

    async findIn(command: string): Promise<Action> {
        const contents = await this.getContents();
        if (_.isEmpty(contents)) {
            return null;
        }

        // Test this object's actions
        const actions = _.filter(contents, (c) => c.type === GameObjectTypes.ACTION) as Action[];
        const matchedAction = _.find(actions, (a) => a.matchCommand(command));
        if (matchedAction) {
            return matchedAction;
        }

        // Test contained item's actions
        // TODO: Compose this better
        const items = _.filter(contents, (c) => c.type === GameObjectTypes.ITEM) as Item[];
        for (const item of items) {
            const fi = await item.findIn(command);
            if (fi) {
                return fi;
            }
        }

        return null;
    }
}
