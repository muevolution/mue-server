import { expect } from "chai";
import { GameObjectTypes, splitExtendedId } from "../../src/objects";

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

        it("should throw on an invalid object type", () => {
            const actual = () => splitExtendedId("_:asdf");
            expect(actual).to.throw();
        });
    });
});
