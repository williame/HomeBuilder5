/* (c) William Edwards 2023 */

import * as THREE from 'three';
import {ComponentCollection} from "./Component.js";
import {Level} from "./level.js";

const epsilon = 0.0001;
const origin = new THREE.Vector3();
const deg90 = THREE.MathUtils.degToRad(90);

class World {

    constructor() {
        this.homeBuilderIdSeq = 0;
        this.components = new ComponentCollection();
        this.activeLevel = new Level(this);
        this.scene = new THREE.Scene();
        this.views = [];
    }

    viewsNeedUpdate() {
        for (let i = 0, e = this.views.length; i < e; i++) {
            this.views[i].needsUpdate();
        }
    }

    addComponent(component) {
        this.components.addComponent(component);
    }

    getComponent(id) {
        return this.components.getComponent(id);
    }

    removeComponent(component) {
        this.components.removeComponent(component);
    }
}

export {World, epsilon, origin, deg90}