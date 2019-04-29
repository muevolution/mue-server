/// worldscript:say

const sayMessage = script.command.args;
const formats = {
    "firstPerson": "You say, \"{message}\"",
    "thirdPerson": `{speaker!name} says, \"{message}\"`
};
const content = {
    "message": sayMessage,
    "speaker": script.thisPlayer
};

const thisRoom = await world.getLocation(script.thisPlayer);
world.tellExtended(formats, content, thisRoom);
