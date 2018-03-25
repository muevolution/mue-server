import * as _ from "lodash";

import { LocalCommand } from "../netmodels";
import { GameObject, Player, World } from "../objects";

const ARG_REGEX = /(.+)=(.+?):(.+)?/;

// TODO: Use `$set@target key:value` syntax instead of `$set target=key:value`
export async function command_set(world: World, player: Player, command: LocalCommand) {
    let target: string; // id
    let key: string;
    let value: string;

    if (command.args && command.args.length > 0) {
        const rejoined = command.args.join(" ");
        const reg = ARG_REGEX.exec(rejoined);
        if (reg && reg.length === 4) {
            [, target, key, value] = reg;
        }
    } else if (_.size(command.params) > 0) {
        target = command.params.target;
        key = command.params.key;
        value = command.params.value;
    }

    if (!target || !key || !value) {
        await world.publishMessage("I don't know what you mean.", player);
        return;
    }

    const targetObj = await player.resolveTarget(target);
    if (!targetObj) {
        await world.publishMessage("I couldn't find what you were talking about.", player);
        return;
    }

    await targetObj.setProp(key, value);
    await world.publishMessage(`Property '${key}' was set on '${targetObj.name}' [${targetObj.id}].`, player);
}
