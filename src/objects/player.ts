import * as _ from "lodash";

import { GameObjectIdDoesNotExist } from "../errors";
import { InteriorMessage } from "../netmodels";
import { Action } from "./action";
import { Container, GetContents, SpillContents } from "./container";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { PlayerLocations, PlayerParents } from "./model-aliases";
import { GameObjectTypes, MetaData } from "./models";
import { Room } from "./room";
import { Script } from "./script";
import { World } from "./world";

const PLAYER_CACHE = {} as {[id: string]: Player};

export class Player extends GameObject implements Container {
    static async create(world: World, name: string, creator?: Player, parent?: PlayerParents, location?: PlayerLocations) {
        const p = new Player(world, {
            name,
            "creator": creator ? creator.id : null,
            "parent": parent ? parent.id : null,
            "location": location ? location.id : parent ? parent.id : null,
        });

        await world.storage.addObject(p);
        PLAYER_CACHE[p.id] = p;
        return p;
    }

    static async imitate(world: World, id: string) {
        if (PLAYER_CACHE[id]) {
            return PLAYER_CACHE[id];
        }

        const meta = await world.storage.getMeta(id);
        console.log("got", meta);
        if (!meta) {
            throw new GameObjectIdDoesNotExist(id, GameObjectTypes.PLAYER);
        }

        const p = new Player(world, meta, id);
        PLAYER_CACHE[id] = p;
        return p;
    }

    protected constructor(world: World, meta?: MetaData, id?: string) {
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

    async find(term: string, type?: GameObjectTypes, searchLoc?: boolean): Promise<GameObject> {
        // Search on player first
        const firstSearch = await this.findIn(term, type);
        if (firstSearch) {
            return firstSearch;
        }

        // Now search the player tree
        let parent: Room;
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

    /** Arbitrary target search, usually for a command */
    async resolveTarget(target: string, absolute: boolean = false): Promise<GameObject> {
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

    protected getCache() {
        return PLAYER_CACHE;
    }
}
