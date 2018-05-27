import { EventEmitter } from "events";

import { BaseTypedEmitter, generateId } from "../common";
import { PropStructure, PropValues } from "../storage";
import { AllContainers } from "./model-aliases";
import { GameObjectMessage, GameObjectTypes, IGameObject, MetaData, splitExtendedId } from "./models";
import { World } from "./world";

export abstract class GameObject<MD extends MetaData = MetaData> extends EventEmitter implements IGameObject {
    public static checkType(data: GameObject | string, type: GameObjectTypes): boolean {
        if (!data) {
            return false;
        }

        if (data instanceof GameObject) {
            return (data.type === type);
        }

        const split = splitExtendedId(data);
        return (split.type === type);
    }

    protected _meta: MD;
    private _id: string;
    private _type: GameObjectTypes;
    private _isDestroyed: boolean;
    private tupdater: BaseTypedEmitter<GameObjectMessage, GameObjectMessage>;

    protected constructor(protected world: World, objectType: GameObjectTypes, meta?: MD, id?: string) {
        super();
        this._id = id ? splitExtendedId(id).id : generateId();
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

    public get destroyed() {
        return this._isDestroyed;
    }

    public get meta(): Readonly<MD> {
        return this._meta;
    }

    public get parent() {
        return this._meta.parent;
    }

    public getParent() {
        return this.world.getObjectById(this.parent);
    }

    public get location() {
        return this._meta.location;
    }

    public getLocation(): Promise<AllContainers> {
        return this.world.getObjectById(this.location) as Promise<AllContainers>;
    }

    public getProp(path: string): Promise<PropValues> {
        return this.world.storage.getProp(this, path);
    }

    public getProps(): Promise<PropStructure> {
        return this.world.storage.getProps(this);
    }

    public setProp(path: string, value: PropValues) {
        return this.world.storage.setProp(this, path, value);
    }

    public setProps(props: PropStructure) {
        return this.world.storage.setProps(this, props);
    }

    public matchName(term: string): boolean {
        // TODO: Add fuzzy matching
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

    public async reparent(newParent: GameObject): Promise<{oldParent?: GameObject, newParent: GameObject}> {
        const parent = await this.world.storage.getMeta(this, "parent");
        const oldParent = await this.world.getObjectById(parent);
        const result = await this.world.storage.reparentObject(this, newParent, oldParent);
        if (!result) {
            return null;
        }

        this._meta.parent = newParent.id;

        const output = { oldParent, newParent };
        this.tupdater.emit("reparent", output);
        return output;
    }

    public async move(newLocation: AllContainers): Promise<{oldLocation?: GameObject, newLocation: GameObject}> {
        const oldLocationEid = await this.world.storage.getMeta(this, "location");
        const oldLocation = await this.world.getObjectById(oldLocationEid);
        const result = await this.world.storage.moveObject(this, newLocation as GameObject, oldLocation);
        if (!result) {
            return null;
        }

        return this.postMove(newLocation, oldLocation);
    }

    public postMove(newLocation: AllContainers, oldLocation?: GameObject): {oldLocation?: GameObject, newLocation: GameObject} {
        this._meta.location = newLocation.id;

        const output = { oldLocation, newLocation };
        this.tupdater.emit("move", output);
        return output;
    }

    public async destroy(): Promise<boolean> {
        await this.world.storage.destroyObject(this);
        this._isDestroyed = true;
        this.invalidateCache(this.id);
        return true;
    }

    public toString() {
        return `'${this.name}' [${this.id}]`;
    }

    protected invalidateCache(id?: string): void {
        return;
    }
}
