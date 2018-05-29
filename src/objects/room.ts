import * as _ from "lodash";

import { GameObjectIdDoesNotExist, GameObjectIdExistsError } from "../errors";
import { Action } from "./action";
import { Container, GetContents, SpillContents } from "./container";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { RoomLocations, RoomParents } from "./model-aliases";
import { GameObjectTypes, MetaData } from "./models";
import { Player } from "./player";
import { World } from "./world";

const ROOM_CACHE = {} as {[id: string]: Room};

export class Room extends GameObject implements Container {
    static async create(world: World, name: string, creator: Player, parent?: RoomParents, location?: RoomLocations) {
        const p = new Room(world, {
            name,
            "creator": creator.id,
            "parent": parent ? parent.id : null,
            "location": location ? location.id : parent ? parent.id : null,
        });
        if (ROOM_CACHE[p.id]) {
            throw new GameObjectIdExistsError(p.id, GameObjectTypes.ROOM);
        }
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
            throw new GameObjectIdDoesNotExist(id, GameObjectTypes.ROOM);
        }

        const p = new Room(world, meta, id);
        ROOM_CACHE[id] = p;
        return p;
    }

    protected constructor(world: World, meta?: MetaData, id?: string) {
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

    getContents(type?: GameObjectTypes) {
        return GetContents(this.world, this, type);
    }

    // TODO: This method needs optimization/caching
    async find(term: string, type?: GameObjectTypes): Promise<GameObject> {
        // Search this room first
        const firstSearch = await this.findIn(term, type);
        if (firstSearch) {
            return firstSearch;
        }

        // Now search the parent tree
        let current = await this.getParent();
        while (current) {
            const action = await current.findIn(term, type);
            if (action) {
                return action;
            }

            current = await current.getParent();
        }

        return null;
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
        const inv = _.find(contents, (c) => (!type || c.type === type) && c.matchName(term));
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

    async destroy(): Promise<boolean> {
        if (!await SpillContents(this.world, this)) {
            // TODO: Throw error or something
            return false;
        }

        return super.destroy();
    }

    protected getCache() {
        return ROOM_CACHE;
    }
}
