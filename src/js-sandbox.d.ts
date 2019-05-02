import { MessageFormats, LocalCommand } from "./netmodels";
import { PropValues } from "./storage";

// This is the js sandbox contract
interface JsSandbox {
    "world": {
        "tell": (message: string, target?: string, meta?: {[key: string]: any}) => void;
        "tellExtended": (extendedFormat: MessageFormats, extendedContent: {[key: string]: any}, target?: string, meta?: {[key: string]: any}) => void;
        "connectedPlayers": () => Promise<string[]>;
        "getPlayerNameFromId": (playerId: string) => Promise<string | undefined>;
        "getPlayerIdFromName": (playerName: string) => Promise<string | undefined>;
        "getParent": (objectId: string) => Promise<string | undefined>;
        "getLocation": (objectId: string) => Promise<string | undefined>;
        "find": (item: string) => Promise<string | undefined>;
        "getDetails": (target: string) => Promise<{[key: string]: string}>;
        "getProp": (target: string, path: string) => Promise<PropValues>;
        "getContents": (target: string) => Promise<string[]>;
    };
    "script": {
        "thisScript": string;
        "thisPlayer": string;
        "command": LocalCommand;
    };
    "Util": {
        "splitId": (objectId: string) => {"id": string, "shortid": string, "type": string};
    };
    "Log": {
        "debug": (...args: any[]) => void;
        "info": (...args: any[]) => void;
        "error": (...args: any[]) => void;
    };
    // Expose the object types
    "Types": {[key: string]: string};
    // Expose some safe JS convienience libraries
    "Library": {
        "lodash": {}; // lodash
    };
}
