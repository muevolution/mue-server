/// worldscript:say

const sayMessage = script.command.args.join(" ");
// TODO: Implement server-side name substition
const formats = {
    "firstPerson": "You say, \"{message}\"",
//    "thirdPerson": `${await world.getPlayerNameFromId(script.thisPlayer)} says, \"{message}\"`
    "thirdPerson": `{speaker!name} says, \"{message}\"`
};
const content = {
    "message": sayMessage,
    "speaker": script.thisPlayer
};

const thisRoom = await world.getParent(script.thisPlayer);
world.tellExtended(formats, content, thisRoom);
//world.tell(`${await world.getPlayerNameFromId(script.thisPlayer)} says, "${sayMessage}"`, thisRoom);
