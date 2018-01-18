import { World } from "./objects";

export class BridgeArbitrator {
    static handle(world: World, socket: SocketIO.Socket) {
        return new BridgeArbitrator(world, socket);
    }

    constructor(private world: World, private socket: SocketIO.Socket) {
        socket.on("clientmsg", (message) => {
            // Pass the message somewhere
        });
    }
}
