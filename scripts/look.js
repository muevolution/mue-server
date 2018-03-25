/// worldscript:l;look;lookat

const _ = Library.lodash;

// Parse commands
const command = script.command;
let lookTarget;
if (command.params && command.params.target) {
    lookTarget = command.params.target;
} else if (command.args && command.args.length > 0) {
    lookTarget = command.args[0];
}

let isRoom = false;
let lookObj;
if (!lookTarget) {
    // Look at the room
    lookObj = await world.getLocation(script.thisPlayer);
    isRoom = true;
} else {
    // Find the named target
    lookObj = await world.find(lookTarget);
}

if (!lookObj) {
    return world.tell("I couldn't find that.");
}

// Construct the output
let outputLines = [];

// Get the name if it's supposed to be shown
if (isRoom) {
    const roomDetails = await world.getDetails(lookObj);
    outputLines.push(roomDetails.name);
}

// Add the description
const desc = await world.getProp(lookObj, "description");
if (!desc) {
    outputLines.push("You see nothing special.");
} else {
    outputLines.push(desc);
}

// Collect the visibile contents
const contents = await world.getContents(lookObj);
if (contents && contents.length > 0) {
    outputLines.push("Contents:");
    await Promise.all(contents.map(async (f) => {
        const item = await world.getDetails(f);
        if (!_.includes([Types.Room, Types.Action], item.type)) {
            outputLines.push(` - ${item.name} [${f}]`);
        }
    }));
}

// Finally, send to the player!
world.tell(outputLines.join("\n"), undefined, {"target": lookObj});
