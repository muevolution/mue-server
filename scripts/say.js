const sayMessage = script.command.args.join(" ");
/*const formats = {
    "firstPerson": "You say, \"{{ message }}\"",
    "thirdPerson": "{{ source }} says, \"{{ message }}\""
};*/
const thisRoom = await world.getParent(script.thisPlayer);
//world.tellExtended(sayMessage, formats, thisRoom);
world.tell(`${await world.getPlayerNameFromId(script.thisPlayer)} says, "${sayMessage}"`, thisRoom);
