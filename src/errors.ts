// tslint:disable:max-classes-per-file

import { GameObjectTypes } from "./objects";

export class GameObjectIdExistsError extends Error {
    constructor(private objectId: string, private type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} already exists!`);
    }
}

export class GameObjectIdDoesNotExist extends Error {
    constructor(private objectId: string, private type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} does not exist`);
    }
}

export class GameObjectDestroyedError extends Error {
    constructor(private objectId: string, private type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} has been destroyed`);
    }
}

export class InvalidGameObjectParentError extends Error {
    constructor(private objectId: string, private type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} is not a valid parent`);
    }
}

export class InvalidGameObjectLocationError extends Error {
    constructor(private objectId: string, private type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} is not a valid location for`);
    }
}

export class PlayerNameAlreadyExistsError extends Error {
    constructor(private playerName: string, private existingPlayerId: string) {
        super(`Player with the name ${playerName} already exists [${existingPlayerId}]`);
    }
}
