import * as _ from "lodash";

import { CommandRequest } from "../../client_types";
import { CommandProcessor } from "../commandproc";
import { generateId } from "../common";
import { WorldNotInitError, WorldShutdownError } from "../errors";
import { Logger } from "../logging";
import { InteriorMessage } from "../netmodels";
import { AsyncRedisClient, RedisConnection } from "../redis";
import { Storage } from "../storage";
import { Action } from "./action";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { GameObjectTypes, InterServerMessage, RootFields, splitExtendedId } from "./models";
import { Player } from "./player";
import { Room } from "./room";
import { Script } from "./script";

export class World {
    protected hasInit: boolean = false;
    protected hasShutdown: boolean = false;
    protected worldInstanceId: string;
    protected cmdproc = new CommandProcessor(this);
    protected isc: AsyncRedisClient;

    constructor(protected opts: {
        redisConnection: RedisConnection
    }) {
        this.worldInstanceId = generateId();
    }

    get [Symbol.toStringTag]() {
        return "World";
    }

    public async init(): Promise<void> {
        if (this.hasInit) {
            return;
        }

        this.hasInit = true;
        Logger.info(`ISC> [${this.worldInstanceId}] Joining cluster with ${await this.getActiveServers()} active servers`);
        await this.configureInterServer();
    }

    public async shutdown(): Promise<void> {
        if (this.hasShutdown) {
            return;
        }

        this.hasShutdown = true;

        Logger.info(`World ${this.worldInstanceId} shutting down server upon request`);

        if (this.isc) {
            await this.isc.quitAsync();
        }

        await this.opts.redisConnection.client.quitAsync();
    }

    public get storage(): Storage {
        this.stateEnforce();
        return new Storage(this.opts.redisConnection.client);
    }

    public async publishMessage(message: InteriorMessage | string, target?: GameObject, meta?: {}): Promise<boolean> {
        this.stateEnforce();

        let channel;
        if (target) {
            let targetId = target.id;
            if (target instanceof Item) {
                targetId = target.parent;
            }

            channel = `c:${targetId}`;
        } else {
            channel = "c:world";
        }

        let outboundMessage: InteriorMessage;
        if (typeof message === "string") {
            outboundMessage = {"message": message, meta};
        } else if (message) {
            outboundMessage = message;
            if (meta) {
                outboundMessage.meta = _.defaults(outboundMessage.meta, meta);
            }
        } else {
            return false;
        }

        Logger.debug(`World ${this.worldInstanceId} publishing message to [${channel}]`, outboundMessage);
        await this.opts.redisConnection.client.publishAsync(channel, JSON.stringify(outboundMessage));
        return true;
    }

    public command(player: Player, command: CommandRequest): Promise<boolean> {
        this.stateEnforce();
        return this.cmdproc.process(player, command);
    }

    public getPlayerById(id: string): Promise<Player> {
        this.stateEnforce();
        return Player.imitate(this, id);
    }

    public async getPlayerByName(name: string): Promise<Player> {
        this.stateEnforce();

        const playerId = await this.storage.findPlayerByName(name);
        if (!playerId) {
            return null;
        }

        return this.getPlayerById(playerId);
    }

    public getRoomById(id: string): Promise<Room> {
        this.stateEnforce();
        return Room.imitate(this, id);
    }

    public async getRootRoom(): Promise<Room> {
        this.stateEnforce();

        const rootRoomId = await this.storage.getRootValue(RootFields.ROOT_ROOM);
        if (!rootRoomId) {
            throw new Error("Unable to find root room.");
        }

        return this.getRoomById(rootRoomId);
    }

    public getItemById(id: string): Promise<Item> {
        this.stateEnforce();
        return Item.imitate(this, id);
    }

    public getScriptById(id: string): Promise<Script> {
        this.stateEnforce();
        return Script.imitate(this, id);
    }

    public getActionById(id: string): Promise<Action> {
        this.stateEnforce();
        return Action.imitate(this, id);
    }

    public getObjectById(id: string, type?: GameObjectTypes): Promise<GameObject> {
        if (!id) {
            return null;
        }

        const split = splitExtendedId(id);
        if (!type) {
            if (!split.type) {
                throw new Error("ID was not extended");
            }

            type = split.type;
        }

        if (type !== split.type) {
            throw new Error(`Types do not match. Got ${split.type}, expected ${type}`);
        }

        switch (type) {
            case GameObjectTypes.PLAYER:
                return this.getPlayerById(id);
            case GameObjectTypes.ROOM:
                return this.getRoomById(id);
            case GameObjectTypes.ITEM:
                return this.getItemById(id);
            case GameObjectTypes.SCRIPT:
                return this.getScriptById(id);
            case GameObjectTypes.ACTION:
                return this.getActionById(id);
        }
    }

    public async getObjectsByIds(ids: Promise<string[]> | string[], type?: GameObjectTypes): Promise<GameObject[]> {
        return Promise.all(_.map(await ids, (id) => this.getObjectById(id)));
    }

    public async getActiveServers(): Promise<number> {
        this.stateEnforce();

        const worlds = await this.opts.redisConnection.numsub("c:isc");
        return worlds["c:isc"];
    }

    public async getActiveRoomIds(): Promise<string[]> {
        this.stateEnforce();

        const rooms = await this.opts.redisConnection.client.pubsubAsync("channels", "c:r:*");
        return _.map(rooms, (ch) => ch.substring(2));
    }

    public async getConnectedPlayerIds(): Promise<string[]> {
        this.stateEnforce();

        const players = await this.opts.redisConnection.client.pubsubAsync("channels", "c:p:*");
        return _.map(players, (ch) => ch.substring(2));
    }

    public async find(term: string, type?: GameObjectTypes): Promise<GameObject> {
        this.stateEnforce();

        const rootRoom = await this.getRootRoom();
        return rootRoom.find(term, type);
    }

    public async invalidateScriptCache(): Promise<void> {
        await this.sendInterServer("invalidate_script");
    }

    private async configureInterServer() {
        this.stateEnforce();

        this.isc = this.opts.redisConnection.client.duplicate();
        await this.sendInterServer("joined", {"instance": this.worldInstanceId});
        await this.isc.subscribeAsync("c:isc");

        // TODO: Move the handler elsewhere
        this.isc.on("message", async (channel, message) => {
            const msg = JSON.parse(message) as InterServerMessage;
            if (msg.event === "joined") {
                Logger.info(`ISC> [${this.worldInstanceId}] New server joined cluster: ${msg.meta.instance}`);
            } else if (msg.event === "invalidate_script") {
                Logger.info("ISC> [${this.worldInstanceId}] Script cache invalidated was requested by ${msg.meta.instance}");
                Script.invalidateCache();
            }
        });
    }

    private async sendInterServer(event: InterServerMessage["event"], meta?: InterServerMessage["meta"]) {
        this.stateEnforce();
        return this.opts.redisConnection.client.publishAsync("c:isc", JSON.stringify({event, meta} as InterServerMessage));
    }

    private stateEnforce(): void {
        if (!this.hasInit) throw new WorldNotInitError();
        if (this.hasShutdown) throw new WorldShutdownError();
    }
}
