/// worldscript:say

const sayMessage = script.command.args.join(" ");
// TODO: Implement server-side name substition
const formats = {
    "firstPerson": "You say, \"{message}\"",
    "thirdPerson": `${await world.getPlayerNameFromId(script.thisPlayer)} says, \"{message}\"`
};
const content = {
    "message": sayMessage
};

const thisRoom = await world.getParent(script.thisPlayer);
world.tellExtended(formats, content, thisRoom);
//world.tell(`${await world.getPlayerNameFromId(script.thisPlayer)} says, "${sayMessage}"`, thisRoom);
