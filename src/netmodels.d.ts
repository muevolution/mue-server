import { ServerToClient } from "../client_types";

export interface LocalCommand {
    command: string;
    args?: string;
    params?: {[key: string]: string};
}

export interface MessageFormats {
    firstPerson: string;
    thirdPerson: string;
}

export interface InteriorMessage {
    message?: string;
    extendedContent?: {[key: string]: string};
    extendedFormat?: MessageFormats;
    source?: string;
    script?: string;
    meta?: {};
    targetChannel?: keyof ServerToClient;
}
