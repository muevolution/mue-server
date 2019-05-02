import * as bluebird from "bluebird";
import * as _ from "lodash";

import { CommandRequest } from "../../client_types";
import { CommandProcessor } from "../commandproc";
import { generateId } from "../common";
import { WorldNotInitError, WorldShutdownError, IllegalObjectIdError } from "../errors";
import { Logger } from "../logging";
import { InteriorMessage } from "../netmodels";
import { ObjectCache } from "../objectcache";
import { RedisConnection } from "../redis";
import { Storage } from "../storage";
import { Action } from "./action";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { expectExtendedId, GameObjectTypes, InterServerMessage, RootFields, splitExtendedId } from "./models";
import { Player } from "./player";
import { Room } from "./room";
import { Script } from "./script";

export class World {
    protected hasInit: boolean = false;
    protected hasShutdown: boolean = false;
    protected worldInstanceId: string;
    protected cmdproc = new CommandProcessor(this);
    protected isc: RedisConnection;
    protected cache = new ObjectCache(this);

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
            await this.isc.client.quit();
        }

        await this.opts.redisConnection.client.quit();
    }

    public get storage(): Storage {
        this.stateEnforce();
        return new Storage(this.opts.redisConnection);
    }

    public get objectCache(): ObjectCache {
        this.stateEnforce();
        return this.cache;
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
            outboundMessage = { "message": message, meta };
        } else if (message) {
            outboundMessage = message;
            if (meta) {
                outboundMessage.meta = _.defaults(outboundMessage.meta, meta);
            }
        } else {
            return false;
        }

        Logger.debug(`World ${this.worldInstanceId} publishing message to [${channel}]`, { outboundMessage });
        await this.opts.redisConnection.client.publish(channel, JSON.stringify(outboundMessage));
        return true;
    }

    public async command(player: Player, command: CommandRequest): Promise<boolean> {
        this.stateEnforce();
        return this.cmdproc.process(player, command);
    }

    public async getPlayerById(id: string): Promise<Player | null> {
        this.stateEnforce();

        const fullId = expectExtendedId(id, GameObjectTypes.PLAYER);
        if (!fullId) {
            return null;
        }

        return Player.imitate(this, fullId);
    }

    public async getPlayerByName(name: string): Promise<Player | null> {
        this.stateEnforce();

        const playerId = await this.storage.findPlayerByName(name);
        if (!playerId) {
            return null;
        }

        return this.getPlayerById(playerId);
    }

    public async getRoomById(id: string): Promise<Room | null> {
        this.stateEnforce();

        const fullId = expectExtendedId(id, GameObjectTypes.ROOM);
        if (!fullId) {
            return null;
        }

        return Room.imitate(this, fullId);
    }

    public async getRootRoom(): Promise<Room> {
        this.stateEnforce();

        const rootRoomId = await this.storage.getRootValue(RootFields.ROOT_ROOM);
        if (!rootRoomId) {
            throw new Error("Unable to find root room.");
        }

        const rootRoom = await this.getRoomById(rootRoomId);
        if (!rootRoom) {
            throw new Error("Unable to find root room.");
        }

        return rootRoom;
    }

    public async getStartRoom(): Promise<Room> {
        this.stateEnforce();

        const startRoomId = await this.storage.getRootValue(RootFields.START_ROOM);
        if (!startRoomId) {
            return this.getRootRoom();
        }

        const startRoom = await this.getRoomById(startRoomId);
        if (!startRoom) {
            return this.getRootRoom();
        }

        return startRoom;
    }

    public async getItemById(id: string): Promise<Item | null> {
        this.stateEnforce();

        const fullId = expectExtendedId(id, GameObjectTypes.ITEM);
        if (!fullId) {
            return null;
        }

        return Item.imitate(this, fullId);
    }

    public async getScriptById(id: string): Promise<Script | null> {
        this.stateEnforce();

        const fullId = expectExtendedId(id, GameObjectTypes.SCRIPT);
        if (!fullId) {
            return null;
        }

        return Script.imitate(this, fullId);
    }

    public async getActionById(id: string): Promise<Action | null> {
        this.stateEnforce();

        const fullId = expectExtendedId(id, GameObjectTypes.ACTION);
        if (!fullId) {
            return null;
        }

        return Action.imitate(this, fullId);
    }

    public async getObjectById(id: string | undefined, type: GameObjectTypes.ROOM): Promise<Room | null>;
    public async getObjectById(id: string | undefined, type: GameObjectTypes.PLAYER): Promise<Player | null>;
    public async getObjectById(id: string | undefined, type: GameObjectTypes.ITEM): Promise<Item | null>;
    public async getObjectById(id: string | undefined, type: GameObjectTypes.SCRIPT): Promise<Script | null>;
    public async getObjectById(id: string | undefined, type: GameObjectTypes.ACTION): Promise<Action | null>;
    public async getObjectById(id: string | undefined, type?: GameObjectTypes): Promise<GameObject | null>;
    public async getObjectById(id: string | undefined, type?: GameObjectTypes): Promise<GameObject | null> {
        if (!id) {
            return null;
        }

        const split = splitExtendedId(id);
        if (!split) {
            throw new IllegalObjectIdError(id);
        }

        if (!type) {
            if (!split.type) {
                throw new Error(`ID ${id} was not extended`);
            }

            type = split.type;
        }

        if (type && type !== split.type) {
            throw new Error(`Types do not match. With ${id}, got ${split.type}, expected ${type}`);
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

    public async getObjectsByIds(ids: Promise<string[]> | string[], type: GameObjectTypes.ROOM): Promise<Array<Room | null>>;
    public async getObjectsByIds(ids: Promise<string[]> | string[], type: GameObjectTypes.PLAYER): Promise<Array<Player | null>>;
    public async getObjectsByIds(ids: Promise<string[]> | string[], type: GameObjectTypes.ITEM): Promise<Array<Item | null>>;
    public async getObjectsByIds(ids: Promise<string[]> | string[], type: GameObjectTypes.SCRIPT): Promise<Array<Script | null>>;
    public async getObjectsByIds(ids: Promise<string[]> | string[], type: GameObjectTypes.ACTION): Promise<Array<Action | null>>;
    public async getObjectsByIds(ids: Promise<string[]> | string[], type?: GameObjectTypes): Promise<Array<GameObject | null>>;
    public async getObjectsByIds(ids: Promise<string[]> | string[], type?: GameObjectTypes): Promise<Array<GameObject | null>> {
        return bluebird.map(ids, (id) => this.getObjectById(id, type));
    }

    public async getActiveServers(): Promise<number> {
        this.stateEnforce();

        const worlds = await this.opts.redisConnection.numsub("c:isc");
        return worlds["c:isc"];
    }

    public async getActiveRoomIds(): Promise<string[]> {
        this.stateEnforce();

        const rooms = await this.opts.redisConnection.channels("c:r:*");
        return _.map(rooms, (ch) => ch.substring(2));
    }

    public async getConnectedPlayerIds(): Promise<string[]> {
        this.stateEnforce();

        const players = await this.opts.redisConnection.channels("c:p:*");
        return _.map(players, (ch) => ch.substring(2));
    }

    public async invalidateScriptCache(): Promise<void> {
        await this.cache.invalidateAll(GameObjectTypes.SCRIPT);
        await this.sendInterServer("invalidate_script");
    }

    public async sendObjectUpdate(id: string, message: "invalidate" | "destroyed"): Promise<void> {
        await this.sendInterServer("update_object", { id, message, "instance": this.worldInstanceId });
    }

    private async configureInterServer() {
        this.stateEnforce();

        this.isc = this.opts.redisConnection.duplicate();
        await this.sendInterServer("joined", { "instance": this.worldInstanceId });
        await this.isc.client.subscribe("c:isc");

        // TODO: Move the handler elsewhere
        this.isc.client.on("message", async (channel: string, message: string) => {
            const msg = JSON.parse(message) as InterServerMessage;
            if (msg.instance === this.worldInstanceId) {
                // Ignore messages from our own instance
                return;
            }

            if (msg.event === "joined") {
                Logger.info(`ISC> [${this.worldInstanceId}] New server joined cluster: ${msg.instance}`);
            } else if (msg.event === "invalidate_script") {
                Logger.info(`ISC> [${this.worldInstanceId}] Script cache invalidated was requested by ${msg.instance}`);
                this.cache.invalidateAll(GameObjectTypes.SCRIPT).catch((err) => {
                    Logger.error("Failed to invalidate scripts", err);
                });
            } else if (msg.event === "update_object") {
                Logger.info(`ISC> [${this.worldInstanceId}] Object ${msg.meta.id} ${msg.meta.message} update requested by ${msg.instance}`);
                if (msg.meta.message === "invalidate") {
                    this.cache.invalidateLocal(msg.meta.id).catch((err) => {
                        Logger.error(`Failed to invalidate object ID ${msg.meta.id}`, err);
                    });
                } else if (msg.meta.message === "destroyed") {
                    this.cache.postDestroy(msg.meta.id);
                }
            }
        });
    }

    private async sendInterServer(event: InterServerMessage["event"], meta?: InterServerMessage["meta"]) {
        this.stateEnforce();
        return this.opts.redisConnection.client.publish("c:isc", JSON.stringify({ event, meta, "instance": this.worldInstanceId } as InterServerMessage));
    }

    private stateEnforce(): void {
        if (!this.hasInit) throw new WorldNotInitError();
        if (this.hasShutdown) throw new WorldShutdownError();
    }
}
