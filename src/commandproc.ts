import * as _ from "lodash";

import { CommandRequest, ExpandedCommandRequest, ShortCommandRequest } from "../client_types";
import * as builtins from "./builtins";
import { Logger } from "./logging";
import { LocalCommand } from "./netmodels";
import { GameObjectTypes, Player, Room, Script, World } from "./objects";
import { PlayerLocations, PlayerParents } from "./objects/model-aliases";
import { ScriptManager } from "./scriptmanager";

export class CommandProcessor {
    private scriptManager: ScriptManager;

    constructor(private world: World) {
        this.scriptManager = new ScriptManager(world);
    }

    async processLogin(username: string, password: string): Promise<{ player?: Player, error?: string }> {
        const player = await this.world.getPlayerByName(username);
        if (!player) {
            return { "error": "Could not find login user." };
        }

        const passwordTest = await player.checkPassword(password);
        if (!passwordTest) {
            return { "error": "Invalid password." };
        }

        return { player };
    }

    async registerPlayer(username: string, password: string, creator?: Player, parent?: PlayerParents, location?: PlayerLocations): Promise<{ player?: Player, error?: string }> {
        // TODO: Check server settings for player registration origin

        // TODO: Check username rules
        if (!username) {
            return { "error": "A username must be provided." };
        }

        if (!password) {
            return { "error": "A password must be provided." };
        }

        let player = await this.world.getPlayerByName(username);
        if (player) {
            return { "error": "That player already exists." };
        }

        // TODO: Make the defaults configurable
        if (!creator) {
            creator = await this.world.getRootPlayer();
        }
        if (!parent) {
            parent = await this.world.getRootRoom();
        }
        if (!location) {
            location = await this.world.getStartRoom();
        }

        player = await Player.create(this.world, username, password, creator, parent, location);

        return { player };
    }

    async process(player: Player, request: CommandRequest): Promise<boolean> {
        // Parse command into the two forms
        const cmd = {} as LocalCommand;

        if ((request as ShortCommandRequest).line) {
            const line = (request as ShortCommandRequest).line;
            if (!line || line.trim().length === 0) {
                // We got a blank line. This may be useful somewhere else but not at root
                return false;
            }

            const hasSpace = line.indexOf(" ");
            if (hasSpace > -1) {
                cmd.command = line.substring(0, hasSpace);
                cmd.args = line.substring(hasSpace + 1);
            } else {
                cmd.command = line;
            }
        } else {
            cmd.command = (request as ExpandedCommandRequest).command;
            cmd.params = (request as ExpandedCommandRequest).params;
        }

        let hasEvaluated = false;
        if (!cmd || !cmd.command) {
            throw new Error("null command");
        }

        // Run hardcoded commands
        hasEvaluated = await this.hardcodedCommands(player, cmd);
        if (hasEvaluated) {
            return true;
        }

        // Search action tree
        hasEvaluated = await this.actionCommands(player, cmd);
        if (hasEvaluated) {
            return true;
        }

        await builtins.command_unknown(this.world, player, cmd);
        return false;
    }

    private async hardcodedCommands(player: Player, command: LocalCommand): Promise<boolean> {
        // Super special awesome hardcoded aliases
        if (command.command.startsWith("\"")) {
            const spl = command.command.substring(1);
            command.command = "say";
            if (command.args) {
                command.args = spl + " " + command.args;
            } else {
                command.args = spl;
            }
            return false;
        } else if (command.command.startsWith(":")) {
            const spl = command.command.substring(1);
            command.command = "pose";
            if (command.args) {
                command.args = spl + " " + command.args;
            } else {
                command.args = spl;
            }
            return false;
        }

        // TODO: Implement hardcoded commands with decorators
        switch (command.command.toLowerCase()) {
            case "$echo":
                await builtins.command_echo(this.world, player, command);
                return true;
            case "$quit":
                await builtins.command_quit(player);
                return true;
            case "$inspect":
                await builtins.command_inspect(this.world, player);
                return true;
            case "$examine":
                await builtins.command_examine(this.world, player);
                return true;
            case "$set":
                await builtins.command_set(this.world, player, command);
                return true;
            case "$createaction":
            case "$createitem":
            case "$createplayer":
            case "$createroom":
            case "$createscript":
                await builtins.command_create(this.world, player, command);
                return true;
            case "$target":
                await builtins.command_target(this.world, player, command);
                return true;
        }

        return false;
    }

    private async actionCommands(player: Player, command: LocalCommand): Promise<boolean> {
        const action = await player.find(command.command, GameObjectTypes.ACTION);
        if (!action || !action.target) {
            return false;
        }

        const target = await this.world.getObjectById(action.target);
        if (!target) {
            throw new Error(`Action was tied to invalid target: ${action.target}`);
        }

        if (target.type === GameObjectTypes.ROOM) {
            const room = target as Room;
            await player.move(room);
            return true;
        } else if (target.type === GameObjectTypes.SCRIPT) {
            const script = target as Script;
            try {
                await this.scriptManager.runScript(script, player, command);
                return true;
            } catch (err) {
                Logger.warn(`Script ${script.id} got error as ${player.id}`, err);
                await this.world.publishMessage(`Error evaluating script: ${err.message}`, player);
                return true;
            }
        }

        throw new Error(`Action was tied to something other than a room or script: '${action.target}'`);
    }
}
