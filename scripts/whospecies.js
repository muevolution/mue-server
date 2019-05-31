/// worldscript:whospecies;whospe;ws
/// <reference path="sandbox.d.ts" />

const bluebird = mue.Library.bluebird;

const thisRoom = await mue.world.getLocation(mue.script.thisPlayer);

const playerList = await mue.world.getContents(thisRoom, mue.Types.Player);
if (playerList.length < 1) {
    // Someone should always be in the room, even if it's you
    Log.warn("Somehow this room was empty");
    return;
}

const playerDetails = await bluebird.map(playerList, async (p) => ({
    "details": await mue.world.getDetails(p),
    "gender": await mue.world.getProp(p, "gender") || "--",
    "species": await mue.world.getProp(p, "species") || "--",
}));

const table = mue.Util.createTable(
    ["Name", { "text": "Gender", width: 8 }, "Species"],
    ["-----", "-------", "--------"],
    ...playerDetails.map(m => [m.details.name, m.gender, m.species])
);

mue.world.tell("Players in room\n" + table.text, mue.script.thisPlayer, { table: table.rawTable });
