/// worldscript:l;look;lookat
/// <reference path="sandbox.d.ts" />

const _ = mue.Library.lodash;
const bluebird = mue.Library.bluebird;

// Parse commands
const command = mue.script.command;
let lookTarget;
if (command.params && command.params.target) {
    lookTarget = command.params.target;
} else if (command.args) {
    lookTarget = command.args;
}

let lookObj;
if (!lookTarget) {
    // Look at the room
    lookObj = await mue.world.getLocation(mue.script.thisPlayer);
} else {
    // Find the named target
    lookObj = await mue.world.find(lookTarget);
}

if (!lookObj) {
    return mue.world.tell("I couldn't find that.");
}

// Construct the output
const outputLines = [];

// Get the name if it's supposed to be shown
if (mue.Util.splitId(lookObj).type === mue.Types.Room) {
    const roomDetails = await mue.world.getDetails(lookObj);
    outputLines.push(roomDetails.name);
}

// Add the description
const desc = await mue.world.getProp(lookObj, "description");
if (!desc) {
    outputLines.push("You see nothing special.");
} else {
    outputLines.push(desc);
}

// Collect the visibile contents
const contents = await mue.world.getContents(lookObj);
if (contents && contents.length > 0) {
    outputLines.push("Contents:");
    await bluebird.each(contents, async (f) => {
        const item = await mue.world.getDetails(f);
        if (!_.includes([mue.Types.Room, mue.Types.Action], item.type)) {
            outputLines.push(` - ${item.name} [${f}]`);
        }
    });
}

// Finally, send to the player!
mue.world.tell(outputLines.join("\n"), undefined, {"target": lookObj});
