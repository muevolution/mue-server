import { GameObject } from "./gameobject";
import { GameObjectTypes, MetaData } from "./models";
import { Room } from "./room";
import { World } from "./world";

const PLAYER_CACHE = {} as {[id: string]: Player};

export class Player extends GameObject {
    static async create(world: World, name: string, creator: Player, parent: Room) {
        const p = new Player(world, {
            name,
            "creator": creator ? creator.id : null,
            "parent": parent ? parent.id : null
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

    public get name() {
        return this.meta.name;
    }

    public quit(reason?: string) {
        this.emit("quit", reason);
    }
}
