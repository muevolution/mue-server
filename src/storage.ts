// tslint:disable:member-ordering

import * as _ from "lodash";

import { generateId } from "./common";
import { GameObjectIdExistsError, InvalidGameObjectNameError, PlayerNameAlreadyExistsError } from "./errors";
import { GameObject, GameObjectTypes, MetaData, RootFields, splitExtendedId } from "./objects";
import { RedisConnection } from "./redis";

export type PropValues = string | number | Array<string | number> | undefined;
export interface PropStructure {
    [key: string]: PropValues;
}

export class Storage {
    private static getKeyStructure(owner: GameObject | string, key: string) {
        const eid = Storage.getIdFromObject(owner);
        return `s:${eid}:${key}`;
    }

    private static getIdFromObject(obj: GameObject | string): string {
        if (typeof obj === "object") {
            return obj.id;
        } else {
            return obj;
        }
    }

    private static getPropKeyStructure(owner: GameObject | string) {
        return Storage.getKeyStructure(owner, "props");
    }

    private static getContentsKeyStructure(owner: GameObject | string) {
        return Storage.getKeyStructure(owner, "contents");
    }

    private static getMetaKeyStructure(owner: GameObject | string) {
        return Storage.getKeyStructure(owner, "meta");
    }

    private static getScriptKeyStructure(owner: GameObject | string) {
        return Storage.getKeyStructure(owner, "script");
    }

    private static getObjectKeyStructure(object: GameObject) {
        return `i:${object.type}:all`;
    }

    private static getByNameKeyStructure(type: GameObjectTypes) {
        return `i:${type}:names`;
    }

    private static getRootKey() {
        return `i:root`;
    }

    private client: import("ioredis").Redis;

    constructor(private redis: RedisConnection) {
        this.client = redis.client;
    }

    get [Symbol.toStringTag]() {
        return "Storage";
    }

    async addObject(object: GameObject): Promise<boolean> {
        // Set the ID if it's a brand new object
        if (object.isPendingAdd) {
            // generateId should be unique due to the algorithm
            object.setInitialId(generateId());
        }

        // Check if the key is in use
        const isInUse = await this.client.sismember(Storage.getObjectKeyStructure(object), object.id);
        if (isInUse === 1) {
            throw new GameObjectIdExistsError(object.id, object.type);
        }

        // Make sure the object has a name set
        const name = object.name;

        if (!name) {
            throw new InvalidGameObjectNameError(object.id, object.type);
        }

        // Make sure a player with this name doesn't already exist
        if (object.type === GameObjectTypes.PLAYER) {
            const exPlayer = await this.findPlayerByName(name);
            if (exPlayer) {
                throw new PlayerNameAlreadyExistsError(name, exPlayer);
            }
        }

        await this.redis.multiWrap((multi) => {
            this.updateHashInMulti(multi, Storage.getMetaKeyStructure(object), object.meta as {});
            multi.sadd(Storage.getObjectKeyStructure(object), object.id);

            if (object.type === GameObjectTypes.PLAYER) {
                multi.hset(Storage.getByNameKeyStructure(GameObjectTypes.PLAYER), name.toLowerCase(), object.id);
            }

            if (object.meta.location) {
                this.reparentMoveInMulti(multi, "location", object, object.meta.location, undefined, false);
            }
        });

        return true;
    }

    async destroyObject(object: GameObject): Promise<boolean> {
        await this.redis.multiWrap((multi) => {
            // Remove primary properties
            multi.del(Storage.getPropKeyStructure(object));
            multi.del(Storage.getContentsKeyStructure(object));
            multi.del(Storage.getMetaKeyStructure(object));

            if (object.type === GameObjectTypes.PLAYER) {
                multi.hdel(Storage.getByNameKeyStructure(object.type), object.id);
            } else if (object.type === GameObjectTypes.SCRIPT) {
                multi.del(Storage.getScriptKeyStructure(object));
            }

            // Remove from global type list
            multi.srem(Storage.getObjectKeyStructure(object), object.id);

            // Remove from current location
            if (object.location) {
                multi.srem(Storage.getContentsKeyStructure(object.location), object.id);
            }
        });

        return true;
    }

    getAllPlayers(): Promise<{ [name: string]: string }> {
        const result = this.client.hgetall(Storage.getByNameKeyStructure(GameObjectTypes.PLAYER));
        return this.valueOrNull(result);
    }

    findPlayerByName(name: string): Promise<string | null> {
        return this.client.hget(Storage.getByNameKeyStructure(GameObjectTypes.PLAYER), name.toLowerCase());
    }

    async updatePlayerNameIndex(oldName: string, object: GameObject): Promise<boolean> {
        await this.redis.multiWrap((multi) => {
            multi.hdel(Storage.getByNameKeyStructure(GameObjectTypes.PLAYER), oldName.toLowerCase());
            multi.hset(Storage.getByNameKeyStructure(GameObjectTypes.PLAYER), object.name.toLowerCase(), object.id);
        });
        return true;
    }

    async getProp(owner: GameObject | string, path: string): Promise<PropValues> {
        const prop = await this.client.hget(Storage.getPropKeyStructure(owner), path);
        if (!prop) {
            return undefined;
        }

        const deserialized = JSON.parse(prop);
        return deserialized;
    }

    async getProps(owner: GameObject | string): Promise<PropStructure> {
        const props = await this.client.hgetall(Storage.getPropKeyStructure(owner));
        const deserialized = _.mapValues(props, (v, k) => JSON.parse(v));
        return deserialized || {};
    }

    async setProp(owner: GameObject | string, path: string, value: PropValues): Promise<boolean> {
        const serialized = JSON.stringify(value);
        if (value) {
            await this.client.hset(Storage.getPropKeyStructure(owner), path, serialized);
        } else {
            await this.client.hdel(Storage.getPropKeyStructure(owner), path);
        }
        return true;
    }

    async setProps(owner: GameObject | string, props: PropStructure): Promise<boolean> {
        const key = Storage.getPropKeyStructure(owner);
        const serialized = _.mapValues(props, (v) => v ? JSON.stringify(v) : null) as { [key: string]: string };

        await this.redis.multiWrap((multi) => {
            multi.del(key);
            this.updateHashInMulti(multi, key, serialized);
        });

        return true;
    }

    async getContents(owner: GameObject | string, type?: GameObjectTypes): Promise<string[]> {
        const contents = await this.client.smembers(Storage.getContentsKeyStructure(owner)) as string[];
        if (!type) {
            return contents;
        }

        return _.filter(contents, (id) => {
            const split = splitExtendedId(id);
            if (!split) {
                return false;
            }

            return split.type === type;
        });
    }

    async reparentObject(object: GameObject | string, newParent: GameObject | string, oldParent?: GameObject | string): Promise<boolean> {
        await this.redis.multiWrap((multi) => this.reparentMoveInMulti(multi, "parent", object, newParent, oldParent));
        return true;
    }

    async moveObject(object: GameObject | string, newLocation: GameObject | string, oldLocation?: GameObject | string): Promise<boolean> {
        await this.redis.multiWrap((multi) => this.reparentMoveInMulti(multi, "location", object, newLocation, oldLocation));
        return true;
    }

    async moveObjects(objects: GameObject[] | string[], newLocation: GameObject | string, oldLocation?: GameObject | string): Promise<boolean> {
        await this.redis.multiWrap((multi) => {
            _.forEach(objects, (object: GameObject | string) => this.reparentMoveInMulti(multi, "location", object, newLocation, oldLocation));
        });
        return true;
    }

    // Calling this without writeMeta is only useful for locations, parent is always only in meta
    private reparentMoveInMulti(multi: import("ioredis").Pipeline, type: "parent" | "location", object: GameObject | string, newOwner: GameObject | string, oldOwner?: GameObject | string, writeMeta: boolean = true) {
        if (!newOwner) {
            return false;
        }

        const objectEid = Storage.getIdFromObject(object);
        const newOwnerEid = Storage.getIdFromObject(newOwner);

        // Set object's reference
        if (writeMeta) {
            multi.hset(Storage.getMetaKeyStructure(object), type, newOwnerEid);
        }

        if (type === "location") {
            // Remove from old storage
            if (oldOwner) {
                multi.srem(Storage.getContentsKeyStructure(oldOwner), objectEid);
            }

            // Add to new
            multi.sadd(Storage.getContentsKeyStructure(newOwner), objectEid);
        }
    }

    async getMeta<MD extends MetaData>(object: GameObject<MD> | string): Promise<MD | null>;
    async getMeta<MD extends MetaData, KD extends keyof MetaData>(object: GameObject<MD> | string, key: KD): Promise<string | null>;
    async getMeta<MD extends MetaData, KD extends keyof MetaData>(object: GameObject<MD> | string, key?: KD): Promise<string | MD | null> {
        if (key) {
            return this.client.hget(Storage.getMetaKeyStructure(object), key);
        } else {
            const result = await this.client.hgetall(Storage.getMetaKeyStructure(object));
            return result && _.size(result) > 0 ? result : null;
        }
    }

    updateMeta<MD extends Readonly<MetaData>>(object: GameObject<MD> | string, meta: Partial<MD>): Promise<boolean>;
    updateMeta<MD extends Readonly<MetaData>, KD extends keyof MD>(object: GameObject<MD> | string, key: KD, value: string): Promise<boolean>;
    async updateMeta<MD extends Readonly<MetaData>, KD extends keyof MD>(object: GameObject<MD> | string, meta: KD | Partial<MD>, value?: string): Promise<boolean> {
        const key = Storage.getMetaKeyStructure(object);
        if (typeof meta === "object") {
            await this.redis.multiWrap((multi) => this.updateHashInMulti(multi, key, meta as {}));
        } else {
            await this.client.hset(key, meta.toString(), value);
        }

        return true;
    }

    getRootValue(field: RootFields): Promise<string | null> {
        const result = this.client.hget(Storage.getRootKey(), field);
        return this.valueOrNull(result);
    }

    async setRootValue(field: RootFields, value: string): Promise<boolean> {
        await this.client.hset(Storage.getRootKey(), field, value);
        return true;
    }

    private updateHashInMulti(multi: import("ioredis").Pipeline, key: string, value: { [key: string]: string }) {
        _.forEach(value, (v, k) => {
            if (v !== undefined && v !== null) {
                multi.hset(key, k, v);
            } else {
                multi.hdel(key, k);
            }
        });
    }

    async getScriptCode(object: GameObject | string): Promise<string | null> {
        return this.client.get(Storage.getScriptKeyStructure(object));
    }

    async setScriptCode(object: GameObject | string, code: string): Promise<boolean> {
        await this.client.set(Storage.getScriptKeyStructure(object), code);
        return true;
    }

    private async valueOrNull<T extends object | string | null | undefined>(value: T | Promise<T>): Promise<T | null> {
        const iValue = await value;
        return _.size(iValue) > 0 ? iValue : null;
    }
}
