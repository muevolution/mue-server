import { LocalCommand, MessageFormats } from "./netmodels";
import { MetaData } from "./objects";
import { PropValues } from "./storage";

export enum ObjectTypes {
    Room = "r",
    Player = "p",
    Item = "i",
    Script = "s",
    Action = "a"
}

// This is the js sandbox contract
export interface JsSandbox {
    /** Communicate with the world around you. */
    "world": {
        /**
         * Tell someone something.
         * @param message Message to send
         * @param target Target ID to send to. Can be room, player, etc. Defaults to caller.
         * @param meta Metadata to attach to message
         */
        "tell": (message: string, target?: string, meta?: { [key: string]: any }) => void;
        /**
         * Tell someone something.
         * @param extendedFormat Message format string to send
         * @param extendedContent Associated message data
         * @param target Target ID to send to. Can be room, player, etc. Defaults to caller.
         * @param meta Metadata to attach to message
         */
        "tellExtended": (extendedFormat: MessageFormats, extendedContent: { [key: string]: any }, target?: string, meta?: { [key: string]: any }) => void;
        /**
         * Get a list of currently connected players.
         * @returns Array of player IDs
         */
        "connectedPlayers": () => Promise<string[]>;
        /**
         * Resolve a player name to an ID.
         * @param playerName Player name
         * @returns Player ID
         */
        "getPlayerIdFromName": (playerName: string) => Promise<string | undefined>;
        /**
         * Gets the parent of an object ID.
         * @param objectId Object ID
         * @returns Parent object ID
         */
        "getParent": (objectId: string) => Promise<string | undefined>;
        /**
         * Gets the location of an object ID.
         * @param objectId Object ID
         * @returns Location object ID
         */
        "getLocation": (objectId: string) => Promise<string | undefined>;
        /**
         * Finds an object by search string.
         * @param item Search string
         * @returns Object ID
         */
        "find": (item: string) => Promise<string | undefined>;
        /**
         * Get an object's details.
         * @param objectId Object ID
         * @returns Object meta
         */
        "getDetails": (objectId: string) => Promise<SandboxMetadata | undefined>;
        /**
         * Get an object property by path.
         * @param objectId Object ID
         * @param path Property path
         * @returns Property value
         */
        "getProp": (objectId: string, path: string) => Promise<PropValues>;
        /**
         * Get object properties, optionally by path.
         * @param objectId Object ID
         * @param path Property paths
         * @returns Property values indexed by path
         */
        "getProps": (objectId: string, path?: string[]) => Promise<{[key: string]: PropValues} | undefined>;
        /**
         * Get the contents of an object.
         * @param objectId Object ID
         * @param type Filter by type
         * @returns Array of object IDs
         */
        "getContents": (objectId: string, type?: ObjectTypes) => Promise<string[]>;
    };
    /** Find out about this script. */
    "script": {
        /** This script's ID. */
        "thisScript": string;
        /** The calling player's ID. */
        "thisPlayer": string;
        /** The command that called this script. */
        "command": LocalCommand;
    };
    /** Utility methods. */
    "Util": {
        /**
         * Splits an ID into its component parts.
         * @param objectId Object ID
         * @returns Object with split information
         */
        "splitId": (objectId: string) => { "id": string, "shortid": string, "type": ObjectTypes };
        /**
         * Create a table for sending to the user.
         * @param header Header row data, including optional widths
         * @param data[] Data rows
         * @returns Object containing both the raw formatted text, and the raw 2d table
         */
        "createTable": (
            header: Array<string | { text: string; width?: number }>,
            ...data: string[][]
        ) => {
            text: string;
            rawTable: string[][]
        };
    };
    /** Log methods. */
    "Log": {
        /** Debug */
        "debug": (...args: any[]) => void;
        /** Info */
        "info": (...args: any[]) => void;
        /** Error */
        "error": (...args: any[]) => void;
    };
    /** Object types */
    "Types": typeof ObjectTypes;
    /** Convenience libraries */
    "Library": {
        "lodash": typeof import("lodash");
        "bluebird": typeof import("bluebird");
    };
}

export interface SandboxMetadata extends MetaData {
    type?: ObjectTypes;
}
