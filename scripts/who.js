const players = await world.connectedPlayers();
world.tell("Connected players: " + (players || ["none"]).join(", "), script.thisPlayer, { players });
