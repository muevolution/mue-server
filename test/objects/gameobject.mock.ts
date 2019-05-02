import { GameObject, GameObjectTypes, MetaData, World } from "../../src/objects";

// The mock will be a room for integration sake, but not override anything that doesn't need to be mocked

export class MockGameObject extends GameObject {
    public constructor(world: World, meta: MetaData, id?: string) {
        super(world, GameObjectTypes.ROOM, meta, id);
    }
}
