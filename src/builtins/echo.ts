import { LocalCommand } from "../netmodels";
import { Player, World } from "../objects";

export async function command_echo(world: World, player: Player, command: LocalCommand) {
    if (command.args && command.args.length > 0) {
        await world.publishMessage(`Echo: ${command.args.join(" ")}`, player);
        return;
    }
    if (command.params && command.params.text) {
        await world.publishMessage(`Echo: ${command.params.text}`, player);
        return;
    }
    await world.publishMessage(`Echo`, player);
}
