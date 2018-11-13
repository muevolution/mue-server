import * as _ from "lodash";

import { CommandRequest, ExpandedCommandRequest, ShortCommandRequest } from "../client_types";
import * as builtins from "./builtins";
import { Logger } from "./logging";
import { LocalCommand } from "./netmodels";
import { Action, GameObjectTypes, Player, Room, Script, World } from "./objects";
import { ScriptManager } from "./scriptmanager";

export class CommandProcessor {
    private scriptManager: ScriptManager;

    constructor(private world: World) {
        this.scriptManager = new ScriptManager(world);
    }

    processLogin(username: string, password: string) {
        // TODO: Actual authentication
        return this.world.getPlayerByName(username);
    }

    async process(player: Player, request: CommandRequest): Promise<boolean> {
        // Parse command into the two forms
        const cmd = {} as LocalCommand;

        if ((request as ShortCommandRequest).line) {
            // TODO: Add a thing that only grabs the first word and lets you keep multiple spaces
            const split = _.split((request as ShortCommandRequest).line, " ");
            cmd.command = _.first(split);
            cmd.args = _.tail(split);
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
        }

        return false;
    }

    private async actionCommands(player: Player, command: LocalCommand): Promise<boolean> {
        const action = await player.find(command.command, GameObjectTypes.ACTION) as Action;
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
            } catch (err) {
                Logger.warn(`Script ${script.id} got error as ${player.id}`, err);
                await this.world.publishMessage(`Error evaluating script: ${err.message}`, player);
            }
            return true;
        }

        throw new Error(`Action was tied to something other than a room or script: '${action.target}'`);
    }
}
