import * as _ from "lodash";

import { Action } from "./action";
import { Container, GetContents, SpillContents } from "./container";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { RoomLocations, RoomParents } from "./model-aliases";
import { GameObjectTypes, MetaData } from "./models";
import { Player } from "./player";
import { Script } from "./script";
import { World } from "./world";

export class Room extends GameObject implements Container {
    static async create(world: World, name: string, creator: Player, parent: RoomParents, location?: RoomLocations) {
        const p = new Room(world, {
            name,
            "creator": creator.id,
            "parent": parent.id,
            "location": location ? location.id : parent ? parent.id : undefined,
        });

        return world.objectCache.standardCreate(p, GameObjectTypes.ROOM);
    }

    static async rootCreate(world: World, name: string) {
        const p = new Room(world, {
            name,
            "creator": "p:0",
            "parent": "r:0",
            "location": "r:0",
        }, "r:0");

        return world.objectCache.standardCreate(p, GameObjectTypes.ROOM);
    }

    static async imitate(world: World, id: string) {
        return world.objectCache.standardImitate(id, GameObjectTypes.ROOM, (meta) => new Room(world, meta, id));
    }

    protected constructor(world: World, meta: MetaData, id?: string) {
        super(world, GameObjectTypes.ROOM, meta, id);
    }

    public getParent(): Promise<RoomParents> {
        return super.getParent() as Promise<RoomParents>;
    }

    public getLocation() {
        return super.getLocation() as Promise<RoomLocations>;
    }

    public reparent(newParent: RoomParents) {
        return super._reparent(newParent, [GameObjectTypes.ROOM]);
    }

    public move(newLocation: RoomLocations) {
        return super._move(newLocation, [GameObjectTypes.ROOM]);
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

    // TODO: This method needs optimization/caching
    async find(term: string, type?: GameObjectTypes): Promise<GameObject | null> {
        // Search this room first
        const firstSearch = await this.findIn(term, type);
        if (firstSearch) {
            return firstSearch;
        }

        // Now search the parent tree
        let current = await this.getParent();
        while (current && !current.isParentRoot) {
            const action = await current.findIn(term, type);
            if (action) {
                return action;
            }

            current = await current.getParent();
        }

        return null;
    }

    findIn(term: string, type: GameObjectTypes.ROOM): Promise<Room | null>;
    findIn(term: string, type: GameObjectTypes.PLAYER): Promise<Player | null>;
    findIn(term: string, type: GameObjectTypes.ITEM): Promise<Item | null>;
    findIn(term: string, type: GameObjectTypes.SCRIPT): Promise<Script | null>;
    findIn(term: string, type: GameObjectTypes.ACTION): Promise<Action | null>;
    findIn(term: string, type?: GameObjectTypes): Promise<GameObject | null>;
    async findIn(term: string, type?: GameObjectTypes): Promise<GameObject | null> {
        const contents = await this.getContents();
        if (_.isEmpty(contents)) {
            return null;
        }

        // Test this object's actions
        if (type === GameObjectTypes.ACTION) {
            const actions = _.filter(contents, (c) => !!c && c.type === GameObjectTypes.ACTION) as Action[];
            const matchedAction = _.find(actions, (a) => a.matchCommand(term));
            if (matchedAction) {
                return matchedAction;
            }
        }

        // Test general item names
        const inv = _.find(contents, (c) => !!c && (!type || c.type === type) && c.matchName(term));
        if (inv) {
            return inv;
        }

        // Test contained item's actions
        // TODO: Compose this better
        const items = _.filter(contents, (c) => !!c && c.type === GameObjectTypes.ITEM) as Item[];
        for (const item of items) {
            const fi = await item.findIn(term, type);
            if (fi) {
                return fi;
            }
        }

        return null;
    }

    async destroy(): Promise<boolean> {
        if (!await SpillContents(this.world, this)) {
            // TODO: Throw error or something
            return false;
        }

        return super.destroy();
    }
}
