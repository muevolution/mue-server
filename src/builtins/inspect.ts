import { Player, World } from "../objects";

export async function command_inspect(world: World, player: Player) {
    await world.publishMessage(`Player: ${player.name} [${player.id}]`, player);

    const parent = await player.getParent();
    if (parent) {
        await world.publishMessage(`Player parent: ${parent.name} [${player.parent}]`, player);
    } else {
        await world.publishMessage(`Player parent: none`, player);
    }

    const contents = await player.getContents();
    if (contents) {
        await world.publishMessage(`Player contents: [${contents.map((c) => c.name).join(", ")}]`, player);
    } else {
        await world.publishMessage(`Player contents: none`, player);
    }

    const room = await player.getLocation();
    await world.publishMessage(`Player location: ${room.name} [${room.id}]`, player);

    const roomContents = await room.getContents();
    if (roomContents) {
        await world.publishMessage(`Room contents: [${roomContents.join(", ")}]`, player);
    } else {
        await world.publishMessage(`Room contents: none`, player);
    }
}
