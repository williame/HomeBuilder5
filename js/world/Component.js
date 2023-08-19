/* (c) William Edwards 2023
  Licensed under the AGPLv3; see LICENSE for details */

import * as THREE from 'three';

class Component {

    constructor(world) {
        this.world = world;
        this.homeBuilderId = this.constructor.name + "_" + ++world.homeBuilderIdSeq;
        this.world.addComponent(this);
        this.level = world.activeLevel;
        this.level.addComponent(this);
        this.objects = {};
        this.isHighlighted = false;
    }

    destroy() {
        this.destroyed = true;
        this.world.removeComponent(this);
        this.level.removeComponent(this);
        this.removeAllObjects();
    }

    setHighlighted(isHighlighted) {
        if (isHighlighted !== this.isHighlighted) {
            this.isHighlighted = isHighlighted;
            this.level.needsRebuild(this);
        }
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

class ComponentCollection {
    constructor() {
        this.components = {};
        this.#updateIterators();
    }

    getComponent(id) {
        return this.components[id];
    }

    addComponent(component) {
        console.assert(component instanceof Component, "not Component", component);
        console.assert(!this.components.hasOwnProperty(component.homeBuilderId), "Component add twice", component);
        this.components[component.homeBuilderId] = component;
        this.#updateIterators();
    }

    removeComponent(component) {
        console.assert(component instanceof Component, "not Component", component);
        delete this.components[component.homeBuilderId];
        this.#updateIterators();
    }

    #updateIterators() {
        this.keys = Object.keys(this.components);
        this.values = Object.values(this.components);
        this.entries = Object.entries(this.components);
    }
}

export {Component, ComponentCollection};