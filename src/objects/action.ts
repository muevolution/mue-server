import * as _ from "lodash";

import { GameObject } from "./gameobject";
import { ActionLocations, ActionParents } from "./model-aliases";
import { GameObjectTypes, MetaData } from "./models";
import { Player } from "./player";
import { Room } from "./room";
import { Script } from "./script";
import { World } from "./world";

export interface ActionMetaData extends MetaData {
    target?: string;
}

export class Action extends GameObject<ActionMetaData> {
    static async create(world: World, name: string, creator: Player, location?: ActionLocations) {
        const p = new Action(world, {
            name,
            "creator": creator.id,
            "parent": creator.id,
            "location": location ? location.id : creator.id
        });

        return world.objectCache.standardCreate(p, GameObjectTypes.ACTION);
    }

    static async imitate(world: World, id: string) {
        return world.objectCache.standardImitate(id, GameObjectTypes.ACTION, (meta) => new Action(world, meta, id));
    }

    protected constructor(world: World, meta?: ActionMetaData, id?: string) {
        super(world, GameObjectTypes.ACTION, meta, id);
    }

    public getParent() {
        return super.getParent() as Promise<ActionParents>;
    }

    public getLocation() {
        return super.getLocation() as Promise<ActionLocations>;
    }

    public reparent(newParent: ActionParents) {
        // TODO: This should change the owner too
        // (actually we need a re-owner system and scripts shouldn't be reparentable)
        return super._reparent(newParent, [GameObjectTypes.PLAYER]);
    }

    get target() {
        return this._meta.target || null;
    }

    setTarget(target: Room | Script): Promise<boolean> {
        if (target == null) {
            this._meta.target = null;
        } else {
            this._meta.target = target.id;
        }

        return this.world.storage.updateMeta(this, this._meta);
    }

    matchCommand(command: string): boolean {
        if (!command) {
            return false;
        }

        return _(this.name).split(";").map((t) => t.toLowerCase()).includes(command.toLowerCase());
    }
}
