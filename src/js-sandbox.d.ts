import { MessageFormats } from "../client_types";

// This is the js sandbox contract
interface JsSandbox {
    "world": {
        "tell": (message: string, target?: string, meta?: {[key: string]: any}) => void;
        "tellExtended": (extendedContent: string, extendedFormat: string | MessageFormats, target?: string, meta?: {[key: string]: any}) => void;
        "connectedPlayers": () => Promise<string[]>;
        "getPlayerNameFromId": (playerId: string) => Promise<string>;
        "getPlayerIdFromName": (playerName: string) => Promise<string>;
        "getParent": (objectId: string) => Promise<string>;
    },
    "script": {
        "thisScript": string;
        "thisPlayer": string;
        "command": {};
    },
    "Log": {
        "debug": (...args: any[]) => void;
        "info": (...args: any[]) => void;
        "error": (...args: any[]) => void;
    }
}