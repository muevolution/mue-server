import { EventEmitter } from "events";
import * as _ from "lodash";
import * as shortid from "shortid";

import { GameObjectTypes, IGameObject, MetaData, MetaKeys, splitExtendedId } from "./models";
import { World } from "./world";


export abstract class GameObject extends EventEmitter implements IGameObject {
    public static deserialize<T extends GameObject>(data: string): T {
        // TODO: Add type checking
        return JSON.parse(data);
    }

    private static generateId(): string {
        return shortid.generate().toLowerCase().replace("_", "a").replace("-", "b");
    }

    private _id: string;
    private _type: GameObjectTypes;
    private _meta: MetaData;

    protected constructor(private world: World, objectType: GameObjectTypes, meta?: MetaData, id?: string) {
        super();
        this._id = id ? splitExtendedId(id).id : GameObject.generateId();
        this._type = objectType;
        this._meta = meta;
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

    public get meta(): Readonly<MetaData> {
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

    public async rename(newName: string): Promise<boolean> {
        const curMeta = await this.world.storage.getMeta(this);
        const oldName = curMeta.name;
        curMeta.name = newName;
        this._meta = curMeta;
        const updatedMeta = await this.world.storage.updateMeta(this, curMeta);
        const updatedIndex = await this.world.storage.updatePlayerNameIndex(oldName, this);

        this.emit("rename", { oldName, newName });

        return updatedMeta && updatedIndex;
    }

    public async move(newOwner: GameObject): Promise<boolean> {
        const parent = await this.world.storage.getMeta(this, MetaKeys.PARENT);
        const oldOwner = await this.world.getObjectById(parent);
        const result = await this.world.storage.moveObject(this, oldOwner, newOwner);
        if (result) {
            this._meta.parent = newOwner.id;
        }

        this.emit("move", { oldOwner, newOwner });

        return result;
    }

    public async contents(): Promise<GameObject[]> {
        const contentIds = await this.world.storage.getContents(this);
        const contentP = _.map(contentIds, (id) => {
            return this.world.getObjectById(id);
        });
        return Promise.all(contentP);
    }

    toString() {
        return `'${this.name}' [${this.id}]`;
    }
}
