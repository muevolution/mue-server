import { MetaData, Player, World } from "../../src/objects";

export class MockPlayer extends Player {
    // Make the constructor public
    public constructor(world: World, meta: MetaData, id?: string) {
        super(world, meta, id);
    }

    _testChangeNameInMeta(newName: string) {
        this._meta.name = newName;
    }
}
