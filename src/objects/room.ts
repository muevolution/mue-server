import { GameObject } from "./gameobject";
import { GameObjectTypes, MetaData, MetaKeys } from "./models";
import { Player } from "./player";
import { World } from "./world";

const ROOM_CACHE = {} as {[id: string]: Room};

export class Room extends GameObject {
    static async create(world: World, name: string, creator: Player, parent?: Room) {
        const p = new Room(world, {
            name,
            "creator": creator.id,
            "parent": parent ? parent.id : null
        });
        await world.storage.addObject(p);
        ROOM_CACHE[p.id] = p;
        return p;
    }

    static async imitate(world: World, id: string) {
        if (ROOM_CACHE[id]) {
            return ROOM_CACHE[id];
        }

        const meta = await world.storage.getMeta(id);
        if (!meta) {
            throw new Error(`Room ${id} not found`);
        }

        const p = new Room(world, meta, id);
        ROOM_CACHE[id] = p;
        return p;
    }

    protected constructor(world: World, meta?: MetaData, id?: string) {
        super(world, GameObjectTypes.ROOM, meta, id);
    }

    public get name() {
        return this.meta.name;
    }
}
