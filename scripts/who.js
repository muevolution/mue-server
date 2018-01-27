/// worldscript:who

const playerList = await world.connectedPlayers();
const playerNames = await Promise.all((playerList || ["none"]).map(world.getPlayerNameFromId));

world.tell("Connected players: " + playerNames.join(", "), script.thisPlayer, { playerList });
