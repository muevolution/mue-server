import * as _ from "lodash";
import type { Socket } from "socket.io";

import {
    ClientToServer,
    CommunicationMessage,
    ServerToClient
} from "../client_types";
import { CommandProcessor } from "./commandproc";
import { BaseTypedEmitter, TypedEmitter } from "./common";
import * as formatter from "./formatter";
import { FormattedMessage } from "./formatter";
import { InteriorMessage } from "./netmodels";
import { ObjectMoveEvent, Player, PlayerMessage, World } from "./objects";
import { RedisConnection } from "./redis";

export class PubSub {
    private _player: Player;
    private baseclient: import("ioredis").Redis;
    private client: import("ioredis").Redis;
    private connected: boolean;
    private tsock: TypedEmitter<ServerToClient, ClientToServer>;
    private tupdater: BaseTypedEmitter<PlayerMessage, PlayerMessage>;
    private boundPlayerMoveEvent: (...args: any[]) => void;
    private boundPlayerQuitEvent: (...args: any[]) => void;

    constructor(
        baseclient: RedisConnection,
        private socket: Socket,
        private world: World
    ) {
        this.baseclient = baseclient.client;
        this.client = baseclient.duplicate().client;
        this.client.on("ready", () => {
            this.connected = true;
        });
        this.client.on("end", () => {
            this.connected = false;
        });

        this.tsock = new TypedEmitter(socket, this.baseclient);

        this.boundPlayerMoveEvent = this.playerMoveEvent.bind(this);
        this.boundPlayerQuitEvent = this.quit.bind(this);
    }

    public get player() {
        return this._player;
    }

    subscribe(player: Player, ...channels: string[]) {
        this._player = player;
        this.tupdater = new BaseTypedEmitter(player, this.baseclient);
        const result = this.client.subscribe(channels);
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

        if (this.connected) {
            await this.client.quit();
        }
    }

    init() {
        // TODO: Pull this from global settings
        this.tsock.emit("welcome", MOTD);

        this.client.on("message", async (channel, message: string) => {
            let displayedChannel = channel.substring(2);
            if (displayedChannel === this.player.id) {
                displayedChannel = "you";
            }

            const msgObj = JSON.parse(message) as InteriorMessage;
            const eventTarget = msgObj.targetChannel ? msgObj.targetChannel : "message";

            switch (eventTarget) {
                case "message":
                    const msgString = await this.getLocalMessage(msgObj);
                    if (!msgString || (!msgString.message && !msgString.format)) {
                        break;
                    }

                    const extendedContent = msgObj.extendedContent || {};
                    _.merge(extendedContent, msgString.substitutions || {});

                    const output: CommunicationMessage = {
                        "target": displayedChannel,
                        "extendedFormat": msgString.format,
                        extendedContent,
                        "message": msgString.message,
                        "source": msgObj.source,
                        "meta": msgObj.meta
                    };
                    this.tsock.emit("message", output);
                    break;
                case "echo":
                    if (msgObj.message) {
                        this.tsock.emit("echo", msgObj.message);
                    }
                    break;
            }
        });

        this.tsock.on("auth", async (data) => {
            const cp = new CommandProcessor(this.world);
            let loginResult: { error?: string; player?: Player; };
            let loginAction: string;

            if (data.isRegistration) {
                loginResult = await cp.registerPlayer(data.username, data.password);
                loginAction = "registering";
            } else {
                loginResult = await cp.processLogin(data.username, data.password);
                loginAction = "logging in"
            }

            if (loginResult.error) {
                this.tsock.emit("auth", { "success": false, "message": `Problem while ${loginAction}: ${loginResult.error}`, "code": 100 });
            } else if (loginResult.player) {
                const player = loginResult.player;
                const channels = ["c:world", `c:${player.location}`, `c:${player.id}`];
                const result = await this.subscribe(player, ...channels);
                if (result) {
                    this.tsock.emit("auth", { "success": true, "message": `Welcome ${player.name} [${player.shortid}]` });
                    await this.world.publishMessage(`${player.name} has connected`);
                } else {
                    this.tsock.emit("fatal", { "message": "Unable to subscribe to channels.", "code": 201 });
                    await this.quit();
                }
            } else {
                this.tsock.emit("auth", { "success": false, "message": "Failed to perform login. Contact an administrator.", "code": 101 });
            }
        });

        this.tsock.on("command", (data) => {
            if (!this._player) {
                return this.tsock.emit("auth", { "success": false, "message": "You have not yet authenticated.", "code": 101 });
            }

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
        if (!this.connected) {
            return;
        }

        if (e.oldLocation) {
            await this.client.unsubscribe(`c:${e.oldLocation.id}`);
        }

        await this.client.subscribe(`c:${e.newLocation.id}`);
    }

    private async getLocalMessage(msg: InteriorMessage): Promise<FormattedMessage & { format?: string }> {
        let format;

        if (msg.extendedFormat && msg.extendedContent) {
            format = (msg.source === this.player.id) ? msg.extendedFormat.firstPerson : msg.extendedFormat.thirdPerson;
            const formatted = await formatter.format(this.world, format, msg.extendedContent);
            return { "message": formatted.message, "substitutions": formatted.substitutions, format };
        }

        return { "message": msg.message, "substitutions": {}, "format": undefined };
    }
}

// TODO: Move this somewhere better
// 45678901234567890123456789012345678901234567890123456789012345678901234567890
const MOTD = `/*/*/*
Welcome to mue (multi-user evolution)! This system is still under development.

  █▀▄▀█   ▄   █      ▄▄▄▄▀ ▄█   ▄      ▄▄▄▄▄   ▄███▄   █▄▄▄▄
  █ █ █    █  █   ▀▀▀ █    ██    █    █     ▀▄ █▀   ▀  █  ▄▀
  █ ▄ █ █   █ █       █    ██ █   █ ▄  ▀▀▀▀▄   ██▄▄    █▀▀▌
  █   █ █   █ ███▄   █     ▐█ █   █  ▀▄▄▄▄▀    █▄   ▄▀ █  █
     █  █▄ ▄█     ▀ ▀       ▐ █▄ ▄█            ▀███▀     █
    ▀    ▀▀▀                   ▀▀▀                      ▀
  ▄███▄      ▄   ████▄ █       ▄     ▄▄▄▄▀ ▄█ ████▄    ▄
  █▀   ▀      █  █   █ █        █ ▀▀▀ █    ██ █   █     █
  ██▄▄   █     █ █   █ █     █   █    █    ██ █   █ ██   █
  █▄   ▄▀ █    █ ▀████ ███▄  █   █   █     ▐█ ▀████ █ █  █
  ▀███▀    █  █            ▀ █▄ ▄█  ▀       ▐       █  █ █
            █▐                ▀▀▀                   █   ██
            ▐

          🚧 This is a development server. Help us develop! 🚧
                       https://github.com/mue/mue-server

Telnet bridge commands:
  - auth <username> <password>
  - register <username> <password>

*\\*\\*\\`;
