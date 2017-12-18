import { Player } from "../objects";

export function command_quit(player: Player) {
    return player.quit("Quit by user request");
}
