import * as _ from "lodash";

import { GameObjectIdDoesNotExist, GameObjectIdExistsError } from "./errors";
import { Action, GameObject, GameObjectTypes, Item, Player, Room, Script, splitExtendedId, World, MetaData } from "./objects";

/** Local server object cache */
export class ObjectCache {
    private _cache: { [id: string]: GameObject } = {};

    constructor(private world: World) { }

    get [Symbol.toStringTag]() {
        return "ObjectCache";
    }

    /** Get an object from the cache. Returns null if not in cache. */
    getObject(object: GameObject | string, type: GameObjectTypes.ROOM): Room;
    getObject(object: GameObject | string, type: GameObjectTypes.PLAYER): Player;
    getObject(object: GameObject | string, type: GameObjectTypes.ITEM): Item;
    getObject(object: GameObject | string, type: GameObjectTypes.SCRIPT): Script;
    getObject(object: GameObject | string, type: GameObjectTypes.ACTION): Action;
    getObject(object: GameObject | string, type?: GameObjectTypes): GameObject;
    getObject(object: GameObject | string, type?: GameObjectTypes): GameObject {
        let id: string;
        if (object instanceof GameObject) {
            id = object.id;
        } else {
            id = object;
        }

        splitExtendedId(id, type);

        if (!this._cache[id]) {
            return null;
        }

        return this._cache[id];
    }

    /** Handle the backend of creating an object. */
    async standardCreate(p: GameObject, type: GameObjectTypes.ROOM): Promise<Room>;
    async standardCreate(p: GameObject, type: GameObjectTypes.PLAYER): Promise<Player>;
    async standardCreate(p: GameObject, type: GameObjectTypes.ITEM): Promise<Item>;
    async standardCreate(p: GameObject, type: GameObjectTypes.SCRIPT): Promise<Script>;
    async standardCreate(p: GameObject, type: GameObjectTypes.ACTION): Promise<Action>;
    async standardCreate(p: GameObject, type: GameObjectTypes): Promise<GameObject> {
        if (this.hasObjectId(p.id)) {
            throw new GameObjectIdExistsError(p.id, type);
        }

        await this.world.storage.addObject(p);
        await this.putObject(p);

        return p;
    }

    async standardImitate(id: string, type: GameObjectTypes.ROOM, builder: (meta: MetaData) => Room | Promise<Room>): Promise<Room>;
    async standardImitate(id: string, type: GameObjectTypes.PLAYER, builder: (meta: MetaData) => Player | Promise<Player>): Promise<Player>;
    async standardImitate(id: string, type: GameObjectTypes.ITEM, builder: (meta: MetaData) => Item | Promise<Item>): Promise<Item>;
    async standardImitate(id: string, type: GameObjectTypes.SCRIPT, builder: (meta: MetaData) => Script | Promise<Script>): Promise<Script>;
    async standardImitate(id: string, type: GameObjectTypes.ACTION, builder: (meta: MetaData) => Action | Promise<Action>): Promise<Action>;
    async standardImitate(id: string, type: GameObjectTypes, builder: (meta: MetaData) => GameObject | Promise<GameObject>): Promise<GameObject> {
        const cachedObj = this.world.objectCache.getObject(id, type);
        if (cachedObj) {
            return cachedObj;
        }

        const meta = await this.world.storage.getMeta(id);
        if (!meta) {
            throw new GameObjectIdDoesNotExist(id, type);
        }

        const obj = await builder(meta);
        this.putObject(obj);
        return obj;
    }

    /** Check if the cache has a specific object ID. */
    hasObjectId(id: string): boolean {
        return !!this._cache[id];
    }

    /** Invalidate an object across all servers. */
    async invalidate(object: GameObject | string): Promise<boolean> {
        const id = this.getIdOfEither(object);
        await this.world.sendObjectUpdate(id, "invalidate");
        return this.invalidateLocal(id);
    }

    /** Invalidate an object on this server. */
    invalidateLocal(p: GameObject | string): Promise<boolean> {
        const object = this.getObjectOfEither(p);
        if (object) {
            return object.invalidate();
        }
    }

    /** Invalidate all objects of a type on this server. */
    async invalidateAll(type: GameObjectTypes): Promise<boolean[]> {
        const p = _.chain(this._cache).keys()
            .map((m) => splitExtendedId(m))
            .filter((f) => f.id && f.type === type)
            .map((k) => this.invalidateLocal(k.id))
            .value();

        return Promise.all(p);
    }

    /** Destroy an object on all servers. */
    async onDestroy(object: GameObject): Promise<void> {
        if (!object.destroyed) {
            // TODO: Specific error
            throw new Error("game object was not destroyed!");
        }

        await this.world.sendObjectUpdate(object.id, "destroyed");
        await this.postDestroy(object);
    }

    /** Remove the destroyed object from this server. */
    postDestroy(p: GameObject | string): void {
        const id = this.getIdOfEither(p);
        delete this._cache[id];
    }

    private putObject(object: GameObject): void {
        if (object.isPendingAdd) {
            throw new GameObjectIdDoesNotExist(object.id, object.type);
        }

        this._cache[object.id] = object;
    }

    private getObjectOfEither(p: GameObject | string, type?: GameObjectTypes) {
        if (p instanceof GameObject) {
            return p;
        } else {
            return this.getObject(p, type);
        }
    }

    private getIdOfEither(p: GameObject | string) {
        if (typeof p === "string") {
            return p;
        } else {
            return p.id;
        }
    }
}
