import { Player, World } from "../objects";

export async function command_inspect(world: World, player: Player) {
    await world.publishMessage(`Player ID: ${player.id}`, player);
    await world.publishMessage(`Player contents: [${(await player.getContents()).map((c) => c.name).join(", ")}]`, player);
    const room = await player.parent;
    await world.publishMessage(`Room ID: ${room.id}`, player);
    await world.publishMessage(`Room contents: [${(await room.getContents()).join(", ")}]`, player);
}
