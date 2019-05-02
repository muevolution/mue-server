export interface MessageEvent {
    "echo": string;
    "fatal": ErrorResponse;
    "error": any; // EventEmitter
    "close": string;
}

export interface ClientToServer extends MessageEvent {
    "connection": void; // socket.io
    "disconnect": void; // socket.io
    "auth": AuthRequest;
    "command": CommandRequest;
}

export interface ServerToClient extends MessageEvent {
    "welcome": string;
    "auth": AuthResponse;
    "message": CommunicationMessage;
}

export interface GenericResponse {
    success: boolean;
}

export interface ErrorResponse {
    message: string;
    code: number;
}

export interface AuthRequest {
    username: string;
    password: string;
}

export interface AuthResponse extends GenericResponse {
    message: string;
}

export type CommandRequest = ShortCommandRequest | ExpandedCommandRequest;

export interface ShortCommandRequest {
    line: string;
}

export interface ExpandedCommandRequest {
    command: string;
    params: {[key: string]: string};
}

export interface CommunicationMessage {
    source?: string;
    target: string;
    message?: string;
    extendedFormat?: string;
    extendedContent?: {[key: string]: string};
    meta?: {};
}
