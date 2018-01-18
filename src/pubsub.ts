import {
    AuthRequest,
    AuthResponse,
    ClientToServer,
    CommandRequest,
    ErrorResponse,
    InteriorMessage,
    ServerToClient
} from "../client_types";
import { CommandProcessor } from "./commandproc";
import { BaseTypedEmitter, TypedEmitter } from "./common";
import { Logger } from "./logging";
import { ObjectMoveEvent, Player, PlayerMessage, World } from "./objects";
import { AsyncRedisClient } from "./redis";

export class PubSub {
    private _player: Player;
    private client: AsyncRedisClient;
    private tsock: TypedEmitter<ServerToClient, ClientToServer>;
    private tupdater: BaseTypedEmitter<PlayerMessage, PlayerMessage>;
    private boundPlayerMoveEvent: (...args: any[]) => void;
    private boundPlayerQuitEvent: (...args: any[]) => void;

    constructor(
        private baseclient: AsyncRedisClient,
        private socket: SocketIO.Socket,
        private world: World
    ) {
        this.client = baseclient.duplicate();
        this.tsock = new TypedEmitter(socket);

        this.boundPlayerMoveEvent = this.playerMoveEvent.bind(this);
        this.boundPlayerQuitEvent = this.quit.bind(this);
    }

    public get player() {
        return this._player;
    }

    subscribe(player: Player, ...channels: string[]) {
        this._player = player;
        this.tupdater = new BaseTypedEmitter(player);
        const result = this.client.subscribeAsync(channels);
        if (!result) {
            return false;
        }

        this.tupdater.on("move", this.boundPlayerMoveEvent);
        this.tupdater.on("quit", this.boundPlayerQuitEvent);

        return true;
    }

    async quit(reason?: string) {
        if (this.player) {
            this.player.removeListener("move", this.boundPlayerMoveEvent);
            this.player.removeListener("quit", this.boundPlayerQuitEvent);
            await this.world.publishMessage(`${this.player.name} has disconnected`);
        }

        if (this.socket.connected) {
            this.tsock.emit("close", reason ? reason : "No reason given");
            this.socket.disconnect();
        }

        if (this.client.connected) {
            this.client.quit();
        }
    }

    init() {
        this.tsock.emit("welcome", "MOTD goes here");

        this.client.on("message", (channel, message: string) => {
            let displayedChannel = channel.substring(2);
            if (displayedChannel === this.player.id) {
                displayedChannel = "you";
            }

            const msgObj = JSON.parse(message);
            const msgString = msgObj.message;
            const eventTarget = msgObj.targetChannel ? msgObj.targetChannel : "message";

            switch (eventTarget) {
                case "message":
                    this.tsock.emit("message", {
                        "target": displayedChannel,
                        "message": msgString,
                        "source": msgObj.source,
                        "meta": msgObj.meta
                    });
                    break;
                case "echo":
                    this.tsock.emit("echo", msgString);
                    break;
            }
        });

        this.tsock.on("connection", () => {
            Logger.verbose("Socket was connected");
            this.tsock.emit("message", {"target": "you", "message": "Welcome!"});
        });

        this.tsock.on("auth", async (data) => {
            const cp = new CommandProcessor(this.world);
            const player = await cp.processLogin(data.username, data.password);
            if (!player) {
                this.tsock.emit("auth", { "success": false, "message": "Could not find login user.", "code": 100 });
                this.socket.disconnect();
            } else {
                const result = await this.subscribe(player, "c:world", `c:${player.meta.parent}`, `c:${player.id}`);
                if (result) {
                    this.tsock.emit("auth", {"success": true, "message": `Welcome ${player.name} [${player.shortid}]`});
                    await this.world.publishMessage(`${player.name} has connected`);
                } else {
                    this.tsock.emit("fatal", { "message": "Unable to subscribe to channels.", "code": 201 } as ErrorResponse);
                    await this.quit();
                }
            }
        });

        this.tsock.on("command", (data) => {
            return this.world.command(this.player, data);
        });

        this.tsock.on("echo", (data) => {
            this.tsock.emit("echo", data);
        });

        this.tsock.on("disconnect", () => {
            return this.quit();
        });
    }

    private async playerMoveEvent(e: ObjectMoveEvent) {
        if (!this.client.connected) {
            return;
        }

        if (e.oldOwner) {
            await this.client.unsubscribeAsync(`c:${e.oldOwner.id}`);
        }

        await this.client.subscribeAsync(`c:${e.newOwner.id}`);
    }
}
