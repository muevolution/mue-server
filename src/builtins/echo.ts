import { LocalCommand } from "../netmodels";
import { Player, World } from "../objects";

export async function command_echo(world: World, player: Player, command: LocalCommand) {
    if (command.args) {
        await world.publishMessage(`Echo: ${command.args}`, player);
        return;
    }
    if (command.params && command.params.text) {
        await world.publishMessage(`Echo: ${command.params.text}`, player);
        return;
    }
    await world.publishMessage(`Echo`, player);
}
