import { VMScript } from "vm2";

import { GameObjectIdDoesNotExist, GameObjectIdExistsError } from "../errors";
import { GameObject } from "./gameobject";
import { ScriptLocations, ScriptParents } from "./model-aliases";
import { GameObjectTypes, MetaData } from "./models";
import { Player } from "./player";
import { World } from "./world";

let SCRIPT_CACHE = {} as {[id: string]: Script};

const CODE_WRAP_HEAD = `
(async function() {
    /* start */

`;

const CODE_WRAP_TAIL = `

    /* end */
})();
`;

export class Script extends GameObject {
    static async create(world: World, name: string, creator: Player, location?: ScriptLocations) {
        const p = new Script(world, {
            name,
            "creator": creator.id,
            "parent": creator.id,
            "location": location ? location.id : creator.id
        });
        if (SCRIPT_CACHE[p.id]) {
            throw new GameObjectIdExistsError(p.id, GameObjectTypes.SCRIPT);
        }
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
            throw new GameObjectIdDoesNotExist(id, GameObjectTypes.SCRIPT);
        }

        const code = await world.storage.getScriptCode(id);

        const p = new Script(world, meta, id);
        p.loadCode(code);
        SCRIPT_CACHE[id] = p;
        return p;
    }

    static invalidateCache() {
        SCRIPT_CACHE = {};
    }

    private _compiled: VMScript;
    private _code: string;

    constructor(world: World, meta?: MetaData, id?: string) {
        super(world, GameObjectTypes.SCRIPT, meta, id);
    }

    public getParent() {
        return super.getParent() as Promise<ScriptParents>;
    }

    public getLocation() {
        return super.getLocation() as Promise<ScriptLocations>;
    }

    public reparent(newParent: ScriptParents) {
        // TODO: This should change the owner too
        // (actually we need a re-owner system and scripts shouldn't be reparentable)
        return super._reparent(newParent, [GameObjectTypes.PLAYER]);
    }

    public get compiled() {
        return this._compiled;
    }

    public async updateCode(code: string) {
        this.loadCode(code);
        await this.world.storage.setScriptCode(this, code);
    }

    protected getCache() {
        return SCRIPT_CACHE;
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
