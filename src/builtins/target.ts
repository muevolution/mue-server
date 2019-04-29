import * as _ from "lodash";

import { LocalCommand } from "../netmodels";
import { Action, GameObjectTypes, Player, Room, Script, World } from "../objects";

// $target action=target
export async function command_target(world: World, player: Player, command: LocalCommand) {
    let targetAction: string;
    let targetLocation: string;

    if (command.args) {
        const spl = command.args.split("=");

        targetAction = spl[0];
        if (spl.length > 1) {
            targetLocation = spl[1];
        }
    } else if (_.size(command.params)) {
        targetAction = command.params.action;
        targetLocation = command.params.location;
    }

    if (!targetAction) {
        await world.publishMessage(`Command is missing a target action.`, player);
        return;
    }

    if (!targetLocation) {
        await world.publishMessage(`Command is missing a new location.`, player);
        return;
    }

    const action = await player.resolveTarget(targetAction, true) as Action;
    if (!action) {
        await world.publishMessage(`Could not find the specified action.`, player);
    }

    if (action.type !== GameObjectTypes.ACTION) {
        await world.publishMessage(`Target [${action.id}] is not an action.`, player);
        return;
    }

    const location = await player.resolveTarget(targetLocation, true) as Room | Script;
    if (!location) {
        await world.publishMessage(`Location is not valid.`, player);
        return;
    }

    if (![GameObjectTypes.ROOM, GameObjectTypes.SCRIPT].includes(location.type)) {
        await world.publishMessage(`Location [${location.id}] is not a room or a script.`, player);
        return;
    }

    await action.setTarget(location);
    await world.publishMessage(`Action ${action.name} [${action.id}] has been targeted to ${location.name} [${location.id}].`, player);
}
