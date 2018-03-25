import { InteriorMessage, LocalCommand } from "../netmodels";
import { Player, World } from "../objects";

export function command_unknown(world: World, player: Player, command: LocalCommand) {
    // TODO: Return this as its own event type (or maybe with a flag on message)
    const msg: InteriorMessage = {
        "source": player.id,
        "message": `Unknown command '${command.command}'`,
        "meta": {
            "errtype": "UNKNOWN_COMMAND",
            "orignal": command
        }
    };
    return world.publishMessage(msg, player);
}
