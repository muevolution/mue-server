import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised = require("chai-as-promised");
import chaiSubset = require("chai-subset");
import { CommandRequest } from "../src/../client_types";
import { CommandProcessor } from "../src/commandproc";
import { initLogger } from "../src/logging";
import { Player, Room } from "../src/objects";
import { afterTestGroup, beforeTestGroup, init } from "./common";

initLogger();

const { redis, world } = init();

chai.use(chaiSubset);
chai.use(chaiAsPromised);

describe("CommandProcessor", () => {
    let rootPlayer: Player;
    let rootRoom: Room;

    before(async () => {
        const results = await beforeTestGroup(redis, world);
        rootPlayer = results.rootPlayer;
        rootRoom = results.rootRoom;
        await rootPlayer.move(results.rootRoom); // Move them into the root room so commands work
    });

    after(async () => {
        await afterTestGroup(world);
    });

    // Actual methods

    describe(".processLogin", () => {
        let loginTestPlayer: Player;

        before(async () => {
            loginTestPlayer = await Player.create(world, "CPPL", "testpass", rootPlayer, rootRoom);
        });

        describe("password authentication", () => {
            it("should successfully log in a user", async () => {
                const cp = new CommandProcessor(world);

                const actual = await cp.processLogin(loginTestPlayer.name, "testpass");
                expect(actual).to.exist.and.have.property("player").have.property("id").to.equal(loginTestPlayer.id);
                expect(actual).to.exist.and.not.have.property("error");
            });

            it("should not log in a user with a bad password", async () => {
                const cp = new CommandProcessor(world);

                const actual = await cp.processLogin(loginTestPlayer.name, "wrongpass");
                expect(actual).to.exist.and.not.have.property("player");
                expect(actual).to.exist.and.have.property("error").to.equal("Invalid password.");
            });

            it("should not log in a user that does not exist", async () => {
                const cp = new CommandProcessor(world);

                const actual = await cp.processLogin("invalidUsername", "asdf");
                expect(actual).to.exist.and.not.have.property("player");
                expect(actual).to.exist.and.have.property("error").to.equal("Could not find login user.");
            });
        });
    });

    describe(".process", () => {
        async function standardCommand(send: CommandRequest, expected: string) {
            const { monitor, marker } = await world.addMonitor(expected);
            const cp = new CommandProcessor(world);

            const actual = await cp.process(rootPlayer, send);
            expect(actual).to.be.true;

            await expect(monitor).to.be.fulfilled;
            world.removeMonitor(marker);
        }

        it("should fail if a command doesn't exist", async () => {
            const { monitor, marker } = await world.addMonitor("Unknown command 'notARealCommand'");
            const cp = new CommandProcessor(world);

            const actual = await cp.process(rootPlayer, {"line": "notARealCommand"});
            expect(actual).to.be.false;

            await expect(monitor).to.be.fulfilled;
            world.removeMonitor(marker);
        });

        it("should fail with an empty command", async () => {
            const cp = new CommandProcessor(world);
            const actual = cp.process(rootPlayer, null as any);
            await expect(actual).to.be.rejectedWith(Error);
        });

        describe("hardcoded commands", () => {
            describe("echo", () => {
                it("short", async () => await standardCommand({"line": "$echo echo test"}, "echo test"));
                it("expanded", async () => await standardCommand({"command": "$echo", "params": {"text": "echo test"}}, "echo test"));
            });

            // This should probably more be tested from pubsub and not here
            xdescribe("quit", () => { /**/ });

            describe("inspect", () => {
                it("returns player name", async () => await standardCommand({"line": "$inspect"}, `Player: ${rootPlayer.name}`));
            });

            describe("examine", () => {
                it("returns player name", async () => await standardCommand({"line": "$examine"}, `Player: ${rootPlayer.name}`));
            });

            describe("set", () => {
                it("should set a variable (short)", async () => {
                    const target = "me";
                    const key = "asdf_becd";
                    const value = "bfeeeff1";
                    await standardCommand({"line": `$set ${target}=${key}:${value}`}, `Property '${key}' was set on '${rootPlayer.name}' [${rootPlayer.id}].`);

                    // TODO: Check setProp actually worked
                });

                it("should set a variable (expanded)", async () => {
                    const target = "me";
                    const key = "asdf_becd";
                    const value = "bfeeeff2";
                    await standardCommand({"command": "$set", "params": {target, key, value}}, `Property '${key}' was set on '${rootPlayer.name}' [${rootPlayer.id}].`);

                    // TODO: Check setProp actually worked
                });

                // TODO: Test expanded commands
                it("should not work with no value set", async () => await standardCommand({"line": "$set"}, `I don't know what you mean.`));
                it("should not find something that isn't nearby", async () => await standardCommand({"line": "$set nyaa=test:asdf"}, `I couldn't find what you were talking about.`));
            });
        });

        xdescribe("action commands", () => {
            // TODO: Local command resolution
        });
    });

});
