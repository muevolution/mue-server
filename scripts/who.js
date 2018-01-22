/// worldscript:who

const players = await world.connectedPlayers();
world.tell("Connected players: " + (await Promise.all((players || ["none"]).map(await world.getPlayerNameFromId))).join(", "), script.thisPlayer, { players });
