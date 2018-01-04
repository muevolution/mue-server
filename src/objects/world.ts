import * as _ from "lodash";

import { CommandProcessor } from "../commandproc";
import { BaseTypedEmitter } from "../common";
import { Logger } from "../logging";
import { CommandRequest, InteriorMessage } from "../netmodels";
import { AsyncRedisClient, RedisConnection } from "../redis";
import { Storage } from "../storage";
import { Action } from "./action";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { GameObjectTypes, InterServerMessage, MetaData, RootFields, splitExtendedId } from "./models";
import { Player } from "./player";
import { Room } from "./room";
import { Script } from "./script";

export class World {
    private cmdproc = new CommandProcessor(this);
    private isc: AsyncRedisClient;

    constructor(private opts: {
        redisConnection: RedisConnection
    }) {
    }

    public async init() {
        this.isc = this.opts.redisConnection.client.duplicate();
        await this.isc.publishAsync("c:isc", JSON.stringify({"event": "joined"} as InterServerMessage));
        await this.isc.subscribeAsync("c:isc");

        // TODO: Move the handler elsewhere
        this.isc.on("message", (channel, message: InterServerMessage) => {
            if (message.event === "joined") {
                Logger.info("Server joined cluster");
            }
        });
    }

    public get storage(): Storage {
        return new Storage(this.opts.redisConnection.client);
    }

    public async publishMessage(message: InteriorMessage | string, target?: GameObject): Promise<boolean> {
        let channel;
        if (target) {
            let targetId = target.id;
            if (target instanceof Item) {
                targetId = target.meta.parent;
            }

            channel = `c:${targetId}`;
        } else {
            channel = "c:world";
        }

        let outboundMessage: InteriorMessage;
        if (typeof message === "string") {
            outboundMessage = {"message": message};
        } else {
            outboundMessage = message;
        }

        await this.opts.redisConnection.client.publishAsync(channel, JSON.stringify(outboundMessage));
        return true;
    }

    public command(player: Player, command: CommandRequest): Promise<boolean> {
        return this.cmdproc.process(player, command);
    }

    public getPlayerById(id: string): Promise<Player> {
        return Player.imitate(this, id);
    }

    public async getPlayerByName(name: string): Promise<Player> {
        const playerId = await this.storage.findPlayerByName(name);
        if (!playerId) {
            return null;
        }

        return this.getPlayerById(playerId);
    }

    public getRoomById(id: string): Promise<Room> {
        return Room.imitate(this, id);
    }

    public async getRootRoom(): Promise<Room> {
        const rootRoomId = await this.storage.getRootValue(RootFields.ROOT_ROOM);
        if (!rootRoomId) {
            throw new Error("Unable to find root room.");
        }

        return this.getRoomById(rootRoomId);
    }

    public getItemById(id: string): Promise<Item> {
        return Item.imitate(this, id);
    }

    public getScriptById(id: string): Promise<Script> {
        return Script.imitate(this, id);
    }

    public getActionById(id: string): Promise<Action> {
        return Action.imitate(this, id);
    }

    public getObjectById(id: string, type?: GameObjectTypes): Promise<GameObject<any>> {
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
        const worlds = await this.opts.redisConnection.numsub("c:isc");
        return worlds["c:isc"];
    }

    public async getActiveRoomIds(): Promise<string[]> {
        const rooms = await this.opts.redisConnection.client.pubsubAsync("channels", "c:r:*");
        return _.map(rooms, (ch) => ch.substring(2));
    }

    public async getConnectedPlayerIds(): Promise<string[]> {
        const players = await this.opts.redisConnection.client.pubsubAsync("channels", "c:p:*");
        return _.map(players, (ch) => ch.substring(2));
    }

    public async find(term: string, type?: GameObjectTypes): Promise<GameObject> {
        const rootRoom = await this.getRootRoom();
        return rootRoom.find(term, type);
    }
}
