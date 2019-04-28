// tslint:disable:max-classes-per-file

import { GameObjectTypes } from "./objects";

class GameError extends Error {
    constructor(message: string, protected _metadata = {}) {
        super(message);
    }

    get metadata() {
        return this._metadata;
    }
}

export class UnusableWorldError extends GameError {
    constructor(message: string) {
        super(`The server is not in a usable state. ${message}`);
    }
}

export class WorldShutdownError extends GameError {
    constructor() {
        super("The world has been shut down.");
    }
}

export class WorldNotInitError extends GameError {
    constructor() {
        super("The world has not yet been initialized.");
    }
}

export class GameObjectIdExistsError extends GameError {
    constructor(objectId: string, type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} already exists!`, {objectId, type});
    }
}

export class GameObjectIdDoesNotExist extends GameError {
    constructor(objectId: string, type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} does not exist`, {objectId, type});
    }
}

export class GameObjectDestroyedError extends GameError {
    constructor(objectId: string, type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} has been destroyed`, {objectId, type});
    }
}

export class InvalidGameObjectNameError extends GameError {
    constructor(objectId: string, type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} does not have a proper name`, {objectId, type});
    }
}

export class InvalidGameObjectParentError extends GameError {
    constructor(objectId: string, type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} is not a valid parent`, {objectId, type});
    }
}

export class InvalidGameObjectLocationError extends GameError {
    constructor(objectId: string, type: GameObjectTypes) {
        super(`Object(${type}) with the ID ${objectId} is not a valid location for`, {objectId, type});
    }
}

export class PlayerNameAlreadyExistsError extends GameError {
    constructor(playerName: string, existingPlayerId: string) {
        super(`Player with the name ${playerName} already exists [${existingPlayerId}]`, {playerName, existingPlayerId});
    }
}

export class IllegalObjectNameError extends GameError {
    constructor(name: string, type: GameObjectTypes) {
        super(`Object(${type}) was given an illegal name "${name}"`, {name, type});
    }
}
