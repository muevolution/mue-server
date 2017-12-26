import "source-map-support/register";

import * as net from "net";
import * as readline from "readline";
import * as socketio from "socket.io-client";

import { TypedEmitter } from "./common";
import { config } from "./config";
import { initLogger, Logger } from "./logging";
import { AuthRequest, AuthResponse, ClientToServer, CommandRequest, ErrorResponse, ServerToClient } from "./netmodels";

initLogger();

const server = net.createServer((cSocket) => {
    const address = cSocket.address().address;
    Logger.debug("CONNECT >", address);

    let isAuthenticated = false;

    const sSocket = socketio(config.telnet.target_url);
    const tsock = new TypedEmitter<ClientToServer, ServerToClient>(sSocket);

    const rl = readline.createInterface({
        "input": cSocket
    });

    cSocket.on("end", () => {
        Logger.debug("DISCONNECT >", address);
        tsock.emit("close", "User disconnected");
        sSocket.close();
    });

    cSocket.on("error", (err) => {
        Logger.debug("Socket got error", err);
        tsock.emit("close", "User connection encountered an error");
        sSocket.close();
    });

    rl.on("line", (data: string) => {
        if (!isAuthenticated) {
            if (data.startsWith("auth ") || data.startsWith("connect ")) {
                // Authenticate the user
                const split = data.split(" ");
                if (split.length < 3) {
                    return cSocket.write("TS> Not enough auth arguments\n");
                }

                return tsock.emit("auth", {"username": split[1], "password": split[2]});
            } else if (data.startsWith("quit")) {
                cSocket.write("TS> Goodbye.\n");
                tsock.emit("close", "Client closed");
                sSocket.close();
                cSocket.destroy();
            }
        } else if (isAuthenticated) {
            return tsock.emit("command", {"line": data});
        }
    });

    tsock.on("welcome", (motd) => {
        cSocket.write("SYS> Connected to telnet bridge\n");
        cSocket.write(`MOTD> ${motd}\n`);
    });

    tsock.on("auth", (data) => {
        if (data.success) {
            cSocket.write(`AUTH> Success: ${data.message}\n`);
            isAuthenticated = true;
        } else {
            cSocket.write(`AUTH> Failed: ${data.message}\n`);
            isAuthenticated = false;
        }
    });

    tsock.on("message", (data) => {
        cSocket.write(`[${data.target}] ${data.message}\n`);
        if (data.meta) {
            cSocket.write(`>META> ${JSON.stringify(data.meta)}\n`);
        }
    });

    tsock.on("close", (reason) => {
        Logger.debug("QUIT >", cSocket.address().address);
        cSocket.write(`QUIT> ${reason ? reason : "No reason given"}`);
        sSocket.close();
        cSocket.destroy();
    });

    tsock.on("fatal", (data) => {
        cSocket.write(`ERR> Got fatal error: ${data}\n`);
        sSocket.close();
        cSocket.destroy();
    });

    tsock.on("error", (err) => {
        cSocket.write(`ERR> Got connection error: ${err}\n`);
        sSocket.close();
        cSocket.destroy();
    });

});

server.on("error", (err) => {
    Logger.error("Server got error", err);
});

Logger.info(`Listening on port ${config.telnet.port}`);
server.listen(config.telnet.port);
