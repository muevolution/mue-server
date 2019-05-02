import { EventEmitter } from "events";

import { BaseTypedEmitter } from "../common";
import { GameObjectDestroyedError, GameObjectIdDoesNotExist, IllegalObjectIdError, InvalidGameObjectLocationError, InvalidGameObjectParentError } from "../errors";
import { PropStructure, PropValues } from "../storage";
import { AllContainers, AllLocations } from "./model-aliases";
import { ALL_CONTAINER_TYPES, ALL_PARENT_TYPES, GameObjectMessage, GameObjectTypes, IGameObject, MetaData, splitExtendedId } from "./models";
import { World } from "./world";

const UNASSIGNED_ID = Symbol("Unassigned GameObject ID");

export abstract class GameObject<MD extends MetaData = MetaData> extends EventEmitter implements IGameObject {
    public static checkType(data: GameObject | string, ...types: GameObjectTypes[]): boolean {
        if (!data) {
            return false;
        }

        if (data instanceof GameObject) {
            return types.indexOf(data.type) > -1;
        }

        const split = splitExtendedId(data);
        if (!split || !split.type) {
            return false;
        }

        return types.indexOf(split.type) > -1;
    }

    protected _meta: MD;
    private _id: string | typeof UNASSIGNED_ID;
    private _type: GameObjectTypes;
    private _isDestroyed: boolean = false;
    private tupdater: BaseTypedEmitter<GameObjectMessage, GameObjectMessage>;

    protected constructor(protected world: World, objectType: GameObjectTypes, meta: MD, id?: string) {
        super();

        if (id) {
            const extendedId = splitExtendedId(id, objectType);
            if (!extendedId || !extendedId.shortid) {
                throw new IllegalObjectIdError(id);
            }

            this._id = extendedId.shortid;
        } else {
            this._id = UNASSIGNED_ID;
        }

        this._type = objectType;
        this._meta = meta;
        this.tupdater = new BaseTypedEmitter(this);
    }

    public get shortid() {
        return this._id.toString();
    }

    public get id() {
        return `${this._type}:${this.shortid}`;
    }

    public get isPendingAdd() {
        return this._id === UNASSIGNED_ID;
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

    /** Reassign the object's short ID. For use by Storage.addObject only */
    public setInitialId(newId: string) {
        if (!this.isPendingAdd) {
            throw new Error("Cannot reassign an ID to an item with one already defined");
        }

        if (newId === null) {
            throw new Error("Reassigned ID cannot be null");
        }

        this._id = newId;
    }

    public get parent() {
        return this._meta.parent;
    }

    public getParent() {
        return this.world.getObjectById(this.parent);
    }

    public get isParentRoot() {
        return this._meta.parent === this.id;
    }

    public get location() {
        return this._meta.location;
    }

    public getLocation(): Promise<AllContainers> {
        return this.world.getObjectById(this.location) as Promise<AllContainers>;
    }

    public get isLocationRoot() {
        return this._meta.location === this.id;
    }

    public getProp(path: string): Promise<PropValues> {
        return this.world.storage.getProp(this, path);
    }

    public getProps(): Promise<PropStructure> {
        return this.world.storage.getProps(this);
    }

    public setProp(path: string, value: PropValues): Promise<boolean> {
        return this.world.storage.setProp(this, path, value);
    }

    public setProps(props: PropStructure): Promise<boolean> {
        return this.world.storage.setProps(this, props);
    }

    public matchName(term: string): boolean {
        if (!term) {
            return false;
        }

        // TODO: Add fuzzy matching
        return term.trim().toLowerCase() === this.name.toLowerCase();
    }

    public async rename(newName: string): Promise<boolean> {
        if (!newName) {
            return false;
        }

        const curMeta = await this.world.storage.getMeta(this) as MD;
        const oldName = curMeta.name;
        curMeta.name = newName;
        this._meta = curMeta;
        const updatedMeta = await this.world.storage.updateMeta(this, curMeta);
        let updatedIndex = true;

        if (this.type === GameObjectTypes.PLAYER) {
            updatedIndex = await this.world.storage.updatePlayerNameIndex(oldName, this);
        }

        this.tupdater.emit("rename", { oldName, newName });

        return updatedMeta && updatedIndex;
    }

    public async reparent(newParent: AllLocations) {
        return this._reparent(newParent, [GameObjectTypes.ROOM, GameObjectTypes.PLAYER, GameObjectTypes.ITEM]);
    }

    public async move(newLocation: AllContainers) {
        return this._move(newLocation, [GameObjectTypes.ROOM, GameObjectTypes.PLAYER, GameObjectTypes.ITEM]);
    }

    public postMove(newLocation: AllContainers, oldLocation?: GameObject): { oldLocation?: GameObject, newLocation: GameObject } {
        this._meta.location = newLocation.id;

        const output = { oldLocation, newLocation };
        this.tupdater.emit("move", output);
        return output;
    }

    public async destroy(): Promise<boolean> {
        await this.world.storage.destroyObject(this);
        this._isDestroyed = true;
        await this.world.objectCache.onDestroy(this);
        return true;
    }

    async invalidate(): Promise<boolean> {
        const newMeta = await this.world.storage.getMeta(this);
        if (!newMeta) {
            // TODO: More specific error?
            throw new GameObjectIdDoesNotExist(this.id, this.type);
        }

        this._meta = newMeta;
        return true;
    }

    public toString() {
        return `'${this.name}' [${this.id}]`;
    }

    protected async _reparent(newParent: AllLocations, restrictedTypes?: GameObjectTypes[]): Promise<{ oldParent?: GameObject, newParent: GameObject } | null> {
        if (!newParent) {
            return null;
        }

        // Check requested type restrictions
        if (restrictedTypes) {
            if (!GameObject.checkType(newParent, ...restrictedTypes)) {
                throw new InvalidGameObjectParentError(newParent.id, newParent.type);
            }
        }

        // Not allowed to be outside of an allowed parent type no matter what
        if (ALL_PARENT_TYPES.indexOf(newParent.type) < 0) {
            throw new InvalidGameObjectParentError(newParent.id, newParent.type);
        }

        if (newParent.destroyed) {
            throw new GameObjectDestroyedError(newParent.id, newParent.type);
        }

        // Can't move into a destroyed location
        const parent = await this.world.storage.getMeta(this, "parent") || undefined;

        const oldParent = await this.world.getObjectById(parent) || undefined;
        const result = await this.world.storage.reparentObject(this, newParent, parent);
        if (!result) {
            return null;
        }

        this._meta.parent = newParent.id;

        const output = { oldParent, newParent };
        this.tupdater.emit("reparent", output);
        return output;
    }

    protected async _move(newLocation: AllContainers, restrictedTypes?: GameObjectTypes[]): Promise<{ oldLocation?: GameObject, newLocation: GameObject } | null> {
        if (!newLocation) {
            return null;
        }

        // Check requested type restrictions
        if (restrictedTypes) {
            if (!GameObject.checkType(newLocation, ...restrictedTypes)) {
                throw new InvalidGameObjectLocationError(newLocation.id, newLocation.type);
            }
        }

        // Not allowed to be outside of an allowed container type no matter what
        if (ALL_CONTAINER_TYPES.indexOf(newLocation.type) < 0) {
            throw new InvalidGameObjectLocationError(newLocation.id, newLocation.type);
        }

        // Can't move into a destroyed location
        if (newLocation.destroyed) {
            throw new GameObjectDestroyedError(newLocation.id, newLocation.type);
        }

        // Handle the move
        const oldLocationEid = await this.world.storage.getMeta(this, "location") || undefined;
        const oldLocation = await this.world.getObjectById(oldLocationEid) || undefined;
        const result = await this.world.storage.moveObject(this, newLocation as GameObject, oldLocation);
        if (!result) {
            return null;
        }

        // Run the post-move trigger
        return this.postMove(newLocation, oldLocation);
    }
}
