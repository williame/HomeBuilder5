import * as THREE from 'three';

class Component {
    constructor(world) {
        this.world = world;
        this.homeBuilderId = this.constructor.name + ++world.homeBuilderIdSeq;
        world.addComponent(this);
        this.objects = {};
    }

    addObject(obj) {
        console.assert(obj instanceof THREE.Object3D, "expected Object3D", obj);
        obj.userData.homeBuilderId = this.homeBuilderId;
        this.objects[obj.id] = obj;
        this.world.scene.add(obj);
    }

    removeObject(obj) {
        if (!obj) {
            return;
        }
        console.assert(obj instanceof THREE.Object3D, "expected Object3D", obj);
        delete this.objects[obj.id];
        obj.removeFromParent();
    }

    removeAllObjects() {
        for (const [id, obj] of Object.entries(this.objects)) {
            obj.removeFromParent();
        }
        this.objects = {};
    }
}

export {Component};