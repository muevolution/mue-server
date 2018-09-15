import { Item, MetaData, World } from "../../src/objects";

export class MockItem extends Item {
    // Make the constructor public
    public constructor(world: World, meta?: MetaData, id?: string) {
        super(world, meta, id);
    }
}
