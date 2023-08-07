import * as THREE from 'three';
import {Wall} from "./walls.js";
import {Component} from "./Component.js";

const deg90 = THREE.MathUtils.degToRad(90);

class World {
    constructor() {
        this.snapDirections = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)];
        this.homeBuilderIdSeq = 0;
        this.components = {};
        this.walls = {};
        this.scene = new THREE.Scene();
        this.views = [];
    }

    getComponent(id) {
        return this.components[id];
    }

    addComponent(component) {
        console.assert(component instanceof Component, "not Component", component);
        console.assert(!this.components.hasOwnProperty(component.homeBuilderId), "add twice", component);
        this.components[component.homeBuilderId] = component;
        if (component instanceof Wall) {
            this.walls[component.homeBuilderId] = component;
        } else {
            console.error("unrecognised object type:", component);
        }
    }

    removeComponent(component) {
        console.assert(component instanceof Component, "not Component", component);
        delete this.components[component.homeBuilderId];
        component.removeAllObjects();
    }

    viewsNeedUpdate() {
        for (let i = 0, e = this.views.length; i < e; i++) {
            this.views[i].needsUpdate();
        }
    }
}

export {World, deg90}