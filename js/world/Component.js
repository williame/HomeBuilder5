/* (c) William Edwards 2023
  Licensed under the AGPLv3; see LICENSE for details */

import * as THREE from 'three';
import * as asserts from '../asserts.js';

export class Component {

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
        asserts.assertInstanceOf(obj, THREE.Object3D)
        obj.userData.homeBuilderId = this.homeBuilderId;
        this.objects[obj.id] = obj;
        this.world.scene.add(obj);
    }

    removeObject(obj) {
        if (!obj) {
            return;
        }
        asserts.assertInstanceOf(obj, THREE.Object3D)
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

export class ComponentCollection {
    constructor() {
        this.components = {};
        this.#updateIterators();
    }

    getComponent(id) {
        return this.components[id];
    }

    addComponent(component) {
        asserts.assertInstanceOf(component, Component);
        asserts.assertFalse(this.components.hasOwnProperty(component.homeBuilderId), "Component add twice", component);
        this.components[component.homeBuilderId] = component;
        this.#updateIterators();
    }

    removeComponent(component) {
        asserts.assertInstanceOf(component, Component);
        delete this.components[component.homeBuilderId];
        this.#updateIterators();
    }

    #updateIterators() {
        this.keys = Object.keys(this.components);
        this.values = Object.values(this.components);
        this.entries = Object.entries(this.components);
    }
}