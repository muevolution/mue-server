import { Action } from "./action";
import { Item } from "./item";
import { Player } from "./player";
import { Room } from "./room";
import { Script } from "./script";

export type AllContainers = Room | Player | Item;
export type AllLocations = Room | Player | Item;

export type ActionParents = Player;
export type ActionLocations = AllLocations;
export type ItemParents = AllContainers;
export type ItemLocations = AllLocations;
export type PlayerParents = Room;
export type PlayerLocations = Room | Item;
export type RoomParents = Room;
export type RoomLocations = Room;
export type ScriptParents = Player;
export type ScriptLocations = AllLocations;
