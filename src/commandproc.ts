import * as _ from "lodash";

import { CommandRequest, ExpandedCommandRequest, InteriorMessage, ShortCommandRequest } from "./netmodels";
import { GameObject, Player, World } from "./objects";

interface LocalCommand {
    "command": string;
    "args"?: string[];
    "params"?: {};
}

export class CommandProcessor {
    constructor(private world: World) {}

    processLogin(username: string, password: string) {
        // TODO: Actual authentication
        return this.world.getPlayerByName(username);
    }

    async process(player: Player, request: CommandRequest) {
        // Parse command into the two forms
        const cmd = {} as LocalCommand;

        if ((request as ShortCommandRequest).line) {
            // TODO: Add a thing that only grabs the first word and lets you keep multiple spaces
            const split = _.split((request as ShortCommandRequest).line, " ");
            cmd["command"] = _.first(split);
            cmd["args"] = _.tail(split);
        } else {
            cmd["command"] = (request as ExpandedCommandRequest).command;
            cmd["params"] = (request as ExpandedCommandRequest).params;
        }

        return this.decisionTree(player, cmd);
    }

    // TODO: Manage global methods, and implement an action tree (global at root?)

    async decisionTree(player: Player, command: LocalCommand) {
        switch (command.command.toLowerCase()) {
            case "quit":
                await this.command_quit(player);
                break;
            case "who":
                await this.command_who(player, command);
                break;
            case "say":
                await this.command_say(player, command);
                break;
            case "shout":
                await this.command_shout(player, command);
                break;
            default:
                await this.command_unknown(player, command);
                break;
        }

        return true;
    }

    private command_quit(player: Player) {
        return player.quit("Quit by user request");
    }

    private async command_who(player: Player, command: LocalCommand) {
        const players = await this.world.getObjectsByIds(this.world.getConnectedPlayerIds());
        return this.world.publishMessage("Currently connected players: " + _.map(players, "name").join(", "), player);
    }

    private async command_say(player: Player, command: LocalCommand) {
        const fullstr = command.args.join(" ");
        const msg: InteriorMessage = {
            "source": player.id,
            "message": `${player.name} says, "${fullstr}"`,
            "meta": {
                "original": fullstr
            }
        };
        return this.world.publishMessage(msg, await player.parent);
    }

    private async command_shout(player: Player, command: LocalCommand) {
        const fullstr = command.args.join(" ");
        const msg: InteriorMessage = {
            "source": player.id,
            "message": `${player.name} shouts, "${fullstr}"`,
            "meta": {
                "original": fullstr
            }
        };
        return this.world.publishMessage(msg);
    }

    private command_unknown(player: Player, command: LocalCommand) {
        // TODO: Return this as its own event type (or maybe with a flag on message)
        const msg: InteriorMessage = {
            "source": player.id,
            "message": `Unknown command '${command.command}'`,
            "meta": {
                "errtype": "UNKNOWN_COMMAND",
                "orignal": command
            }
        };
        return this.world.publishMessage(msg, player);
    }
}
