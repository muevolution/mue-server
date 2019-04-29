import * as _ from "lodash";

import { LocalCommand } from "../netmodels";
import { Action, ALL_CONTAINER_TYPES, GameObject, GameObjectTypes, Item, Player, Room, Script, World } from "../objects";
import { AllContainers } from "../objects/model-aliases";

// $createaction look
// $createitem Magic wand
// $createplayer Kauko
// $createroom Kauko's Bedroom
// $createscript wand.js
export async function command_create(world: World, player: Player, command: LocalCommand) {
    let type: GameObjectTypes;
    let name: string;
    let targetLocation: string;
    let targetParent: string;

    // Convert command name into type for convienience
    switch (command.command) {
        case "$createaction":
            type = GameObjectTypes.ACTION;
            break;
        case "$createitem":
            type = GameObjectTypes.ITEM;
            break;
        case "$createplayer":
            type = GameObjectTypes.PLAYER;
            // TODO: Validate permission to actually do this
            break;
        case "$createroom":
            type = GameObjectTypes.ROOM;
            break;
        case "$createscript":
            type = GameObjectTypes.SCRIPT;
            break;
        default:
            throw new Error(`Command "${command.command}" mismatched with builtin command_create`);
    }

    if (command.args) {
        const full = command.args;
        const spl = full.split("=");
        name = spl[0];
        if (spl.length > 1) {
            targetLocation = spl[1];
        }
    } else if (_.size(command.params)) {
        name = command.params.name;
        targetLocation = command.params.location;
        targetParent = command.params.parent;
    }

    if (!name) {
        await world.publishMessage(`Command ${command.command} was missing a name.`, player);
        return;
    }

    let parent: AllContainers;
    let location: AllContainers;

    if (targetParent) {
        const result = await player.resolveTarget(targetLocation, true);
        if (!result) {
            await world.publishMessage(`Could not find the specified parent.`, player);
        }

        if (ALL_CONTAINER_TYPES.includes(result.type)) {
            parent = result as AllContainers;
        } else {
            await world.publishMessage(`Target [${result.id}] is not a valid parent.`, player);
            return;
        }
    } else {
        switch (type) {
            case GameObjectTypes.ACTION:
                break;
            case GameObjectTypes.ITEM:
                parent = player;
                break;
            case GameObjectTypes.PLAYER:
                parent = await world.getRootRoom();
                break;
            case GameObjectTypes.ROOM:
                parent = await player.getLocation();
                break;
            case GameObjectTypes.SCRIPT:
                break;
        }
    }

    if (targetLocation) {
        const result = await player.resolveTarget(targetLocation, true);
        if (!result) {
            await world.publishMessage(`Could not find the specified location.`, player);
        }

        if (ALL_CONTAINER_TYPES.includes(result.type)) {
            location = result as AllContainers;
        } else {
            await world.publishMessage(`Target [${result.id}] is not a valid location.`, player);
            return;
        }
    } else {
        switch (type) {
            case GameObjectTypes.ACTION:
                location = player;
                break;
            case GameObjectTypes.ITEM:
                location = parent;
                break;
            case GameObjectTypes.PLAYER:
                location = await world.getStartRoom();
                break;
            case GameObjectTypes.ROOM:
                location = parent;
                break;
            case GameObjectTypes.SCRIPT:
                location = player;
                break;
        }
    }

    let newObjP: Promise<GameObject>;
    switch (type) {
        case GameObjectTypes.ACTION:
            newObjP = Action.create(world, name, player, location);
            break;
        case GameObjectTypes.ITEM:
            newObjP = Item.create(world, name, player, parent, location);
            break;
        case GameObjectTypes.PLAYER:
            newObjP = Player.create(world, name, player, parent, location);
            break;
        case GameObjectTypes.ROOM:
            newObjP = Room.create(world, name, player, parent, location);
            break;
        case GameObjectTypes.SCRIPT:
            newObjP = Script.create(world, name, player, location);
            break;
    }

    try {
        const newObj = await newObjP;
        await world.publishMessage(`Created ${name} [${newObj.id}] in ${location.name} [${location.id}]`, player);
    } catch (err) {
        // TODO: Don't send users hard errors, soften standard errors
        await world.publishMessage(`Problem creating object: ${err.message}`, player);
    }
}
