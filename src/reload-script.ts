import * as bluebird from "bluebird";
import * as fs from "fs";
import * as glob from "glob";
import * as _ from "lodash";

import { Action, GameObjectTypes, Item, Player, Room, Script, World } from "./objects";

const gg = bluebird.promisify(glob);
const readFile = (filename: string, encoding: string): Promise<string> => new Promise((resolve, reject) => {
    fs.readFile(filename, encoding, (err, res) => {
        if (err) {
            return reject(err);
        }
        resolve(res);
    });
});

export async function getScripts() {
    const g = await gg("scripts/*.js") as string[];
    return g.map((s) => s.substring(8));
}

async function updateScript(world: World, filename: string, creator: Player, location: Player | Room | Item, actionDestination?: Player | Room | Item) {
    let scriptCreated = false;
    let script = await world.find(filename, GameObjectTypes.SCRIPT) as Script;
    if (!script) {
        script = await Script.create(world, filename, creator, location);
        scriptCreated = true;
    }

    const fileContents = await readFile(`scripts/${filename}`, "utf-8");
    await script.updateCode(fileContents);

    if (scriptCreated && actionDestination) {
        const actionRegex = /^\/\/\/ worldscript:([\w|;]+)$/m;
        const result = actionRegex.exec(fileContents);
        if (!result || result.length < 2) {
            return;
        }

        const actionName = result[1];
        const action = await Action.create(world, actionName, creator, actionDestination);
        await action.setTarget(script);
    }
}

export async function updateScripts(world: World, creator: Player, location: Player | Room | Item, actionDestination?: Player | Room | Item) {
    const scripts = await getScripts();
    await Promise.all(_.map(scripts, (s) => updateScript(world, s, creator, location, actionDestination)));
    await world.invalidateScriptCache();
}
