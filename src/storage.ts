import * as _ from "lodash";
import { Multi } from "redis";

import { GameObject, GameObjectTypes, MetaData, MetaKeys } from "./objects";
import { AsyncRedisClient, AsyncRedisMulti } from "./redis";

export class Storage {
    private static getKeyStructure(owner: GameObject | string, key: string) {
        let eid;
        if (typeof owner === "object") {
            eid = owner.id;
        } else {
            eid = owner;
        }
        return `s:${eid}:${key}`;
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

    private static getObjectKeyStructure(object: GameObject) {
        return `i:${object.type}:all`;
    }

    private static getByNameKeyStructure(type: GameObjectTypes) {
        return `i:${type}:names`;
    }

    constructor(private client: AsyncRedisClient) {
    }

    async addObject(object: GameObject) {
        const multi = this.client.multi();
        this.updateMetaInMulti(multi, Storage.getMetaKeyStructure(object), object.meta);
        multi.rpush(Storage.getObjectKeyStructure(object), object.id);

        if (object.type === GameObjectTypes.PLAYER) {
            multi.hset(Storage.getByNameKeyStructure(GameObjectTypes.PLAYER), object.name.toLowerCase(), object.id);
        }

        return multi.execAsync();
    }

    destroyObject(object: GameObject) {
        return this.client.lremAsync(Storage.getObjectKeyStructure(object), object.id);
    }

    getAllPlayers() {
        return this.client.hgetallAsync(Storage.getByNameKeyStructure(GameObjectTypes.PLAYER));
    }

    findPlayerByName(name: string) {
        return this.client.hgetAsync(Storage.getByNameKeyStructure(GameObjectTypes.PLAYER), name.toLowerCase());
    }

    async updatePlayerNameIndex(oldName: string, object: GameObject) {
        const multi = this.client.multi();
        multi.hdel(Storage.getByNameKeyStructure(GameObjectTypes.PLAYER), oldName);
        multi.hset(Storage.getByNameKeyStructure(GameObjectTypes.PLAYER), object.name, object.id);
        return multi.execAsync();
    }

    getProps(owner: GameObject | string) {
        return this.client.getAsync(Storage.getPropKeyStructure(owner));
    }

    async setProps(owner: GameObject | string, props: {}): Promise<boolean> {
        // TODO: Investigate using a hash per user for this
        const result = await this.client.setAsync(Storage.getPropKeyStructure(owner), JSON.stringify(props));
        return result === "OK";
    }

    getContents(owner: GameObject | string): Promise<string[]> {
        return this.client.lrangeAsync(Storage.getContentsKeyStructure(owner), 0, -1);
    }

    moveObject(object: GameObject | string, oldOwner: GameObject | string, newOwner: GameObject | string) {
        const multi = this.client.multi();
        let objectEid;
        if (typeof object === "object") {
            objectEid = object.id;
        } else {
            objectEid = object;
        }

        let newOwnerEid;
        if (typeof newOwner === "object") {
            newOwnerEid = newOwner.id;
        } else {
            newOwnerEid = newOwner;
        }

        // Set object's reference
        multi.hset(Storage.getMetaKeyStructure(object), MetaKeys.PARENT, newOwnerEid);

        // Remove from old storage
        if (oldOwner) {
            multi.lrem(Storage.getContentsKeyStructure(oldOwner), 0, objectEid);
        }

        // Add to new
        multi.rpush(Storage.getContentsKeyStructure(newOwner), objectEid);

        return multi.execAsync();
    }

    getMeta(object: GameObject | string): Promise<MetaData>;
    getMeta(object: GameObject | string, key: MetaKeys): Promise<string>;
    getMeta(object: GameObject | string, key?: MetaKeys): Promise<string | MetaData> {
        if (key) {
            return this.client.hgetAsync(Storage.getMetaKeyStructure(object), key);
        } else {
            return this.client.hgetallAsync(Storage.getMetaKeyStructure(object)) as Promise<MetaData>;
        }
    }

    updateMeta(object: GameObject | string, meta: MetaData): Promise<boolean>;
    updateMeta(object: GameObject | string, key: MetaKeys, value: string): Promise<boolean>;
    async updateMeta(object: GameObject | string, meta: MetaKeys | MetaData, value?: string): Promise<boolean> {
        const key = Storage.getMetaKeyStructure(object);
        if (typeof meta === "object") {
            const multi = this.client.multi();
            this.updateMetaInMulti(multi, key, meta);
            return multi.execAsync();
        } else {
            await this.client.hsetAsync(key, meta, value);
            return true;
        }
    }

    updateMetaInMulti(multi: Multi, key: string, meta: MetaData) {
        _.forEach(meta, (v, k) => {
            if (v !== undefined && v !== null) {
                multi.hset(key, k, v.toString());
            } else {
                multi.hdel(key, k);
            }
        });
    }
}
