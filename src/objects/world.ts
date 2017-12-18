import * as _ from "lodash";

import { CommandProcessor } from "../commandproc";
import { CommandRequest, InteriorMessage } from "../netmodels";
import { AsyncRedisClient, RedisConnection } from "../redis";
import { Storage } from "../storage";
import { GameObject } from "./gameobject";
import { Item } from "./item";
import { GameObjectTypes, splitExtendedId } from "./models";
import { Player } from "./player";
import { Room } from "./room";

export class World {
    private cmdproc = new CommandProcessor(this);

    constructor(private opts: {
        redisConnection: RedisConnection
    }) {
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

    public getItemById(id: string): Promise<Item> {
        return Item.imitate(this, id);
    }

    public getObjectById(id: string, type?: GameObjectTypes): Promise<GameObject> {
        if (!id) {
            return null;
        }

        if (!type) {
            const split = splitExtendedId(id);
            if (!split.type) {
                throw new Error("ID was not extended");
            }
            type = split.type;
        }

        switch (type) {
            case GameObjectTypes.PLAYER:
                return this.getPlayerById(id);
            case GameObjectTypes.ROOM:
                return this.getRoomById(id);
            case GameObjectTypes.ITEM:
                return this.getItemById(id);
        }
    }

    public async getObjectsByIds(ids: Promise<string[]> | string[], type?: GameObjectTypes): Promise<GameObject[]> {
        return Promise.all(_.map(await ids, (id) => this.getObjectById(id)));
    }

    public async getActiveRoomIds(): Promise<string[]> {
        const rooms = await this.opts.redisConnection.client.pubsubAsync("channels", "c:r:*");
        return _.map(rooms, (ch) => ch.substring(2));
    }

    public async getConnectedPlayerIds(): Promise<string[]> {
        const players = await this.opts.redisConnection.client.pubsubAsync("channels", "c:p:*");
        return _.map(players, (ch) => ch.substring(2));
    }
}
