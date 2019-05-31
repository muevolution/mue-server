/// worldscript:say
/// <reference path="sandbox.d.ts" />

const sayMessage = mue.script.command.args;
const formats = {
    "firstPerson": "You say, \"{message}\"",
    "thirdPerson": `{speaker!name} says, \"{message}\"`
};
const content = {
    "message": sayMessage,
    "speaker": mue.script.thisPlayer
};

const thisRoom = await mue.world.getLocation(mue.script.thisPlayer);
mue.world.tellExtended(formats, content, thisRoom);
