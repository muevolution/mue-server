/// worldscript:pose
/// <reference path="sandbox.d.ts" />

const sayMessage = mue.script.command.args;
const formats = {
    "firstPerson": "{actor!name} {action}",
    "thirdPerson": `{actor!name} {action}`
};
const content = {
    "action": sayMessage,
    "actor": mue.script.thisPlayer
};

const thisRoom = await mue.world.getLocation(mue.script.thisPlayer);
mue.world.tellExtended(formats, content, thisRoom);
