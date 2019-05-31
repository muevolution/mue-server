/// worldscript:who
/// <reference path="sandbox.d.ts" />

const bluebird = mue.Library.bluebird;

const playerList = await mue.world.connectedPlayers();
if (playerList.length < 1) {
    // Shouldn't be possible to execute this with zero connected players!
    mue.Log.warn("Somehow the server is empty");
    return;
}

const playerNames = await bluebird.map(playerList, mue.world.getPlayerNameFromId);

mue.world.tell("Connected players: " + playerNames.join(", "), mue.script.thisPlayer, { playerList });
