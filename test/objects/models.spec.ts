import { expect } from "chai";
import { GameObjectTypes, splitExtendedId, expectExtendedId } from "../../src/objects";

describe("Models", () => {
    describe(".splitExtendedId", () => {
        it("should split a short id", () => {
            const actual = splitExtendedId("asdf");
            expect(actual).to.have.property("id").and.equal("asdf");
            expect(actual).to.not.have.property("type");
        });

        it("should split a long id", () => {
            const actual = splitExtendedId("r:asdf");
            expect(actual).to.have.property("id").and.equal("asdf");
            expect(actual).to.have.property("type").and.equal(GameObjectTypes.ROOM);
        });

        it("should fail when null", () => {
            const actual = splitExtendedId(null);
            expect(actual).to.be.null;
        });

        it("should fail when empty", () => {
            const actual = splitExtendedId("");
            expect(actual).to.be.null;
        });

        it("should fail when object type but no id", () => {
            const actual = splitExtendedId("r:");
            expect(actual).to.be.null;
        });

        it("should throw on an invalid object type", () => {
            const actual = () => splitExtendedId("_:asdf");
            expect(actual).to.throw();
        });
    });

    describe(".expectExtendedId", () => {
        it("should expand a short id", () => {
            const actual = expectExtendedId("asdf", GameObjectTypes.ROOM);
            expect(actual).to.equal("r:asdf");
        });

        it("should return a long id", () => {
            const actual = expectExtendedId("r:asdf", GameObjectTypes.ROOM);
            expect(actual).to.equal("r:asdf");
        });

        it("should fail when null", () => {
            const actual = expectExtendedId(null, GameObjectTypes.ROOM);
            expect(actual).to.be.null;
        });

        it("should fail when empty", () => {
            const actual = expectExtendedId("", GameObjectTypes.ROOM);
            expect(actual).to.be.null;
        });

        it("should fail when object type but no id", () => {
            const actual = expectExtendedId("r:", GameObjectTypes.ROOM);
            expect(actual).to.be.null;
        });

        it("should throw when object type doesn't match a long id", () => {
            const actual = () => expectExtendedId("p:asdf", GameObjectTypes.ROOM);
            expect(actual).to.throw;
        });
    });
});
