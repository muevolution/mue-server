/// worldscript:pose

const sayMessage = script.command.args;
const formats = {
    "firstPerson": "{actor!name} {action}",
    "thirdPerson": `{actor!name} {action}`
};
const content = {
    "action": sayMessage,
    "actor": script.thisPlayer
};

const thisRoom = await world.getLocation(script.thisPlayer);
world.tellExtended(formats, content, thisRoom);
