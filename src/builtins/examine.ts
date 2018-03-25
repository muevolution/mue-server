import * as _ from "lodash";

import { Player, World } from "../objects";

export async function command_examine(world: World, player: Player) {
    await world.publishMessage(`Player: ${player.name} [${player.id}]`, player);
    const props = await player.getProps();
    await Promise.all(_.map(props, async (v, k) => {
        await world.publishMessage(` - ${k}: ${v}`);
    }));
}
