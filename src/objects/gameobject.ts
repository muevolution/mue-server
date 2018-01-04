import { EventEmitter } from "events";
import * as _ from "lodash";
import * as shortid from "shortid";

import { BaseTypedEmitter } from "../common";
import { GameObjectMessage, GameObjectTypes, IGameObject, MetaData, splitExtendedId } from "./models";
import { World } from "./world";

export abstract class GameObject<MD extends MetaData = MetaData> extends EventEmitter implements IGameObject {
    public static checkType(data: GameObject<any> | string, type: GameObjectTypes): boolean {
        if (!data) {
            return false;
        }

        if (data instanceof GameObject) {
            return (data.type === type);
        }

        const split = splitExtendedId(data);
        return (split.type === type);
    }

    public static deserialize<T extends GameObject<any>>(data: string): T {
        // TODO: Add type checking
        return JSON.parse(data);
    }

    private static generateId(): string {
        return shortid.generate().toLowerCase().replace("_", "a").replace("-", "b");
    }

    protected _meta: MD;
    private _id: string;
    private _type: GameObjectTypes;
    private tupdater: BaseTypedEmitter<GameObjectMessage, GameObjectMessage>;

    protected constructor(protected world: World, objectType: GameObjectTypes, meta?: MD, id?: string) {
        super();
        this._id = id ? splitExtendedId(id).id : GameObject.generateId();
        this._type = objectType;
        this._meta = meta;
        this.tupdater = new BaseTypedEmitter(this);
    }

    public get shortid() {
        return this._id;
    }

    public get id() {
        return `${this._type}:${this._id}`;
    }

    public get name() {
        return this._meta.name;
    }

    public get type() {
        return this._type;
    }

    public get meta(): Readonly<MD> {
        return this._meta;
    }

    public get parent() {
        return this.world.getObjectById(this._meta.parent);
    }

    public async get() {
        return this.world.storage.getProps(this);
    }

    public async set(props: {}) {
        return this.world.storage.setProps(this, props);
    }

    public matchName(term: string): boolean {
        return term.trim().toLowerCase() === this.name.toLowerCase();
    }

    public async rename(newName: string): Promise<boolean> {
        const curMeta = await this.world.storage.getMeta(this) as MD;
        const oldName = curMeta.name;
        curMeta.name = newName;
        this._meta = curMeta;
        const updatedMeta = await this.world.storage.updateMeta(this, curMeta);
        const updatedIndex = await this.world.storage.updatePlayerNameIndex(oldName, this);

        this.tupdater.emit("rename", { oldName, newName });

        return updatedMeta && updatedIndex;
    }

    public async move(newOwner: GameObject<any>): Promise<boolean> {
        const parent = await this.world.storage.getMeta(this, "parent");
        const oldOwner = await this.world.getObjectById(parent);
        const result = await this.world.storage.moveObject(this, newOwner, oldOwner);
        if (result) {
            this._meta.parent = newOwner.id;
        }

        this.tupdater.emit("move", { oldOwner, newOwner });

        return result;
    }

    public async getContents(type?: GameObjectTypes): Promise<Array<GameObject<any>>> {
        const contentIds = await this.world.storage.getContents(this, type);
        const contentP = _.map(contentIds, (id) => {
            return this.world.getObjectById(id, type);
        });
        return Promise.all(contentP);
    }

    toString() {
        return `'${this.name}' [${this.id}]`;
    }
}
