import { Player, World } from "../objects";

export async function command_inspect(world: World, player: Player) {
    await world.publishMessage(`Player: ${player.name} [${player.id}]`, player);
    await world.publishMessage(`Player parent: ${(await player.getParent()).name} [${player.parent}]`, player);
    await world.publishMessage(`Player contents: [${(await player.getContents()).map((c) => c.name).join(", ")}]`, player);
    const room = await player.getLocation();
    await world.publishMessage(`Player location: ${room.name} [${room.id}]`, player);
    await world.publishMessage(`Room contents: [${(await room.getContents()).join(", ")}]`, player);
}
