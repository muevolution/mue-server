import * as _ from "lodash";

import { InteriorMessage } from "../netmodels";
import { Action } from "./action";
import { Container, GetContents } from "./container";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { PlayerLocations, PlayerParents } from "./model-aliases";
import { GameObjectTypes, MetaData } from "./models";
import { Room } from "./room";
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

        // Make sure a player with this name doesn't already exist
        const exPlayer = await world.storage.findPlayerByName(name);
        if (exPlayer) {
            throw new Error("Player with this name already exists");
        }

        await world.storage.addObject(p);
        PLAYER_CACHE[p.id] = p;
        return p;
    }

    static async imitate(world: World, id: string) {
        if (PLAYER_CACHE[id]) {
            return PLAYER_CACHE[id];
        }

        const meta = await world.storage.getMeta(id);
        if (!meta) {
            throw new Error(`Player ${id} not found`);
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

    async move(newLocation: PlayerLocations): Promise<{oldLocation?: GameObject, newLocation: GameObject}> {
        const result = await super.move(newLocation);

        // Notify rooms of change
        // TODO: Make sure the current user doesn't the third person join/part messages
        if (result) {
            if (result.oldLocation) {
                await this.world.publishMessage(`${this.name} has left.`, result.oldLocation);
            }

            await this.sendMessage(`You arrive in ${result.newLocation.name}.`);
            await this.world.publishMessage(`${this.name} has arrived.`, result.newLocation);
        }

        return result;
    }

    getContents(type?: GameObjectTypes) {
        return GetContents(this.world, this, type);
    }

    async find(term: string, type?: GameObjectTypes): Promise<GameObject> {
        // Search on player first
        const firstSearch = await this.findIn(term, type);
        if (firstSearch) {
            return firstSearch;
        }

        if (type === GameObjectTypes.ACTION) {
            // Now search the player tree
            const parent = await this.getParent();
            const pRes = await parent.find(term, type);
            if (pRes) {
                return pRes;
            }

            // Now search the room tree
            const location = await this.getLocation();
            return location.find(term, type);
        }
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
        const inv = _.find(contents, (c) => c.type === type && c.matchName(term));
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
            const targetObj = await this.world.getObjectById(target);
            if (targetObj) {
                return targetObj;
            }

            const targetPlayer = await this.world.getPlayerByName(target);
            if (targetPlayer) {
                return targetPlayer;
            }
        }

        return this.find(target);
    }

    async sendMessage(message: InteriorMessage | string): Promise<boolean> {
        return this.world.publishMessage(message, this);
    }

    quit(reason?: string) {
        this.emit("quit", reason);
    }
}
