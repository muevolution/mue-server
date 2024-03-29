import * as _ from "lodash";

import { InteriorMessage } from "../netmodels";
import * as security from "../security";
import { Action } from "./action";
import { Container, GetContents, SpillContents } from "./container";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { PlayerLocations, PlayerParents } from "./model-aliases";
import { GameObjectTypes, MetaData, MetaDataValues } from "./models";
import { Room } from "./room";
import { Script } from "./script";
import { World } from "./world";

interface PlayerMetaDataValues extends MetaDataValues {
    passwordHash?: string;
}

export class PlayerMetaData extends MetaData {
    passwordHash?: string;

    constructor(data: PlayerMetaDataValues | Record<string, string>) {
        super(data);
        this.passwordHash = data.passwordHash;
    }
}

// tslint:disable-next-line: max-classes-per-file
export class Player extends GameObject<PlayerMetaData> implements Container {
    static async create(world: World, name: string, password: string, creator: Player, parent: PlayerParents, location?: PlayerLocations) {
        // Hash the password
        const passwordHash = await security.hashPassword(password);

        const p = new Player(world, new PlayerMetaData({
            name,
            "creator": creator.id,
            "parent": parent.id,
            "location": location ? location.id : parent ? parent.id : undefined,
            passwordHash
        }));

        return world.objectCache.standardCreate(p, GameObjectTypes.PLAYER);
    }

    static async rootCreate(world: World, name: string) {
        const p = new Player(world, new PlayerMetaData({
            name,
            "creator": "p:0",
            "parent": "r:0",
            "location": "r:0"
        }), "p:0");

        return world.objectCache.standardCreate(p, GameObjectTypes.PLAYER);
    }

    static async imitate(world: World, id: string) {
        return world.objectCache.standardImitate(id, GameObjectTypes.PLAYER, (meta) => new Player(world, meta, id));
    }

    protected constructor(world: World, meta: PlayerMetaData, id?: string) {
        super(world, GameObjectTypes.PLAYER, meta, id);
    }

    public getParent() {
        return super.getParent() as Promise<PlayerParents>;
    }

    public getLocation() {
        return super.getLocation() as Promise<PlayerLocations>;
    }

    reparent(newParent: PlayerParents) {
        return super._reparent(newParent, [GameObjectTypes.ROOM]);
    }

    async move(newLocation: PlayerLocations) {
        const result = await super._move(newLocation, [GameObjectTypes.ROOM, GameObjectTypes.ITEM]);
        if (!result) {
            return null;
        }

        // Notify rooms of change
        // TODO: Make sure the current user doesn't the third person join/part messages
        if (result.oldLocation) {
            await this.world.publishMessage(`${this.name} has left.`, result.oldLocation);
        }

        await this.sendMessage(`You arrive in ${result.newLocation.name}.`);
        await this.world.publishMessage(`${this.name} has arrived.`, result.newLocation);

        return result;
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

    find(term: string, type: GameObjectTypes.ROOM, searchLoc?: boolean): Promise<Room | null>;
    find(term: string, type: GameObjectTypes.PLAYER, searchLoc?: boolean): Promise<Player | null>;
    find(term: string, type: GameObjectTypes.ITEM, searchLoc?: boolean): Promise<Item | null>;
    find(term: string, type: GameObjectTypes.SCRIPT, searchLoc?: boolean): Promise<Script | null>;
    find(term: string, type: GameObjectTypes.ACTION, searchLoc?: boolean): Promise<Action | null>;
    find(term: string, type?: GameObjectTypes, searchLoc?: boolean): Promise<GameObject | null>;
    async find(term: string, type?: GameObjectTypes, searchLoc?: boolean): Promise<GameObject | null> {
        // Search on player first
        const firstSearch = await this.findIn(term, type);
        if (firstSearch) {
            return firstSearch;
        }

        // Now search the player tree
        let parent: Room | undefined;
        if (type === GameObjectTypes.ACTION) {
            parent = await this.getParent();
            if (parent) {
                const pRes = await parent.find(term, type);
                if (pRes) {
                    return pRes;
                }
            }
        }

        // Now search the room tree
        if (type === GameObjectTypes.ACTION || searchLoc) {
            const location = await this.getLocation();
            if (location === parent) {
                // Already searched this tree
                return null;
            }

            return location.findIn(term, type);
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

    /** Arbitrary target search, usually for a command */
    async resolveTarget(target: string, absolute: boolean = false): Promise<GameObject | null> {
        if (target === "me") {
            return this;
        } else if (target === "here") {
            return this.getLocation();
        } else if (target === "parent") {
            return this.getParent();
        }

        if (absolute) {
            // Try direct addressing first
            try {
                const targetObj = await this.world.getObjectById(target);
                if (targetObj) {
                    return targetObj;
                }
            } catch {
                // Swallow
                // TODO: See if there's a better way to do this as a 'test' without throwing an exception
            }

            const targetPlayer = await this.world.getPlayerByName(target);
            if (targetPlayer) {
                return targetPlayer;
            }
        }

        return this.find(target, undefined, true);
    }

    async destroy(): Promise<boolean> {
        if (!await SpillContents(this.world, this)) {
            // TODO: Throw error or something
            return false;
        }

        return super.destroy();
    }

    async sendMessage(message: InteriorMessage | string): Promise<boolean> {
        return this.world.publishMessage(message, this);
    }

    quit(reason?: string) {
        this.emit("quit", reason);
    }

    async checkPassword(password: string): Promise<boolean> {
        if (!password) {
            return false;
        }

        const savedHash = this.meta.passwordHash;
        if (!savedHash) {
            return false;
        }

        return security.comparePasswords(savedHash, password);
    }
}
