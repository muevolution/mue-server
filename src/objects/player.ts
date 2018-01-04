import * as _ from "lodash";

import { Action } from "./action";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { GameObjectTypes, MetaData } from "./models";
import { Room } from "./room";
import { World } from "./world";

const PLAYER_CACHE = {} as {[id: string]: Player};

export class Player extends GameObject {
    static async create(world: World, name: string, creator: Player, parent: Room) {
        const p = new Player(world, {
            name,
            "creator": creator ? creator.id : null,
            "parent": parent ? parent.id : null
        });

        // Make sure a player with this name doesn't already exist
        const exPlayer = await world.storage.findPlayerByName(name);
        if (exPlayer) {
            throw new Error("Player with this name already exists");
        }

        await world.storage.addObject(p);
        PLAYER_CACHE[p.id] = p;
        return p;
    }

    static async imitate(world: World, id: string) {
        if (PLAYER_CACHE[id]) {
            return PLAYER_CACHE[id];
        }

        const meta = await world.storage.getMeta(id);
        if (!meta) {
            throw new Error(`Player ${id} not found`);
        }

        const p = new Player(world, meta, id);
        PLAYER_CACHE[id] = p;
        return p;
    }

    protected constructor(world: World, meta?: MetaData, id?: string) {
        super(world, GameObjectTypes.PLAYER, meta, id);
    }

    public get parent(): Promise<Room> {
        return super.parent as Promise<Room>;
    }

    async find(term: string, type?: GameObjectTypes): Promise<GameObject> {
        // Search on player first
        const firstSearch = await this.findIn(term, type);
        if (firstSearch) {
            return firstSearch;
        }

        // Now search the room tree
        if (type === GameObjectTypes.ACTION) {
            const parent = await this.parent;
            return parent.find(term, type);
        }
    }

    async findIn(term: string, type?: GameObjectTypes): Promise<GameObject> {
        const contents = await this.getContents();
        if (_.isEmpty(contents)) {
            return null;
        }

        // Test this object's actions
        if (type === GameObjectTypes.ACTION) {
            const actions = _.filter(contents, (c) => c.type === GameObjectTypes.ACTION) as Action[];
            const matchedAction = _.find(actions, (a) => a.matchCommand(term));
            if (matchedAction) {
                return matchedAction;
            }
        }

        // Test general item names
        const inv = _.find(contents, (c) => c.type === type && c.matchName(term));
        if (inv) {
            return inv;
        }

        // Test contained item's actions
        // TODO: Compose this better
        const items = _.filter(contents, (c) => c.type === GameObjectTypes.ITEM) as Item[];
        for (const item of items) {
            const fi = await item.findIn(term, type);
            if (fi) {
                return fi;
            }
        }

        return null;
    }

    public quit(reason?: string) {
        this.emit("quit", reason);
    }
}
