import { VMScript } from "vm2";

import { GameObject } from "./gameobject";
import { Item } from "./item";
import { GameObjectTypes, MetaData } from "./models";
import { Player } from "./player";
import { Room } from "./room";
import { World } from "./world";

const SCRIPT_CACHE = {} as {[id: string]: Script};

const CODE_WRAP_HEAD = `
(async function() {
    /* start */

`;

const CODE_WRAP_TAIL = `

/* end */
})();
`;

export class Script extends GameObject {
    static async create(world: World, name: string, creator: Player, parent?: Room | Player | Item) {
        const p = new Script(world, {
            name,
            "creator": creator.id,
            "parent": parent.id
        });
        await world.storage.addObject(p);
        SCRIPT_CACHE[p.id] = p;
        return p;
    }

    static async imitate(world: World, id: string) {
        if (SCRIPT_CACHE[id]) {
            return SCRIPT_CACHE[id];
        }

        const meta = await world.storage.getMeta(id);
        if (!meta) {
            throw new Error(`Script ${id} not found`);
        }

        const code = await world.storage.getScriptCode(id);

        const p = new Script(world, meta, id);
        p.loadCode(code);
        SCRIPT_CACHE[id] = p;
        return p;
    }

    private _compiled: VMScript;
    private _code: string;

    constructor(world: World, meta?: MetaData, id?: string) {
        super(world, GameObjectTypes.SCRIPT, meta, id);
    }

    public get parent(): Promise<Room | Player | Item> {
        return super.parent as Promise<Room | Player | Item>;
    }

    public get compiled() {
        return this._compiled;
    }

    public async updateCode(code: string) {
        this.loadCode(code);
        await this.world.storage.setScriptCode(this, code);
    }

    private loadCode(code: string) {
        this._code = code;
        this.compile();
    }

    private compile() {
        this._compiled = new VMScript(this._code, `scripts.${this.shortid}.js`);
        this._compiled.wrap(CODE_WRAP_HEAD, CODE_WRAP_TAIL);
        this._compiled.compile();
    }
}
