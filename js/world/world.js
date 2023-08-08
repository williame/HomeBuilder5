import * as THREE from 'three';
import {Wall} from "./walls.js";
import {Component} from "./Component.js";

const deg90 = THREE.MathUtils.degToRad(90);

class World {

    constructor() {
        this.homeBuilderIdSeq = 0;
        this.components = {};
        this.walls = {};
        this.scene = new THREE.Scene();
        this.views = [];
        this.updateSnapDirections();
    }

    updateSnapDirections() {
        const snapAngles = [0, 90, 180, 270];
        for (const wall of Object.values(this.walls)) {
            let dupe = false;
            for (const existing of snapAngles) {
                if (existing === wall.angle) {
                    dupe = true;
                    break;
                }
            }
            if (!dupe) {
                snapAngles.push(wall.angle, (wall.angle + 90) % 360, (wall.angle + 180) % 360, (wall.angle + 270) % 360);
            }
        }
        this.snapDirections = [];
        const origin = new THREE.Vector2();
        for (const angle of snapAngles) {
            const rotated = new THREE.Vector2(100).rotateAround(origin, THREE.MathUtils.degToRad(angle));
            this.snapDirections.push(new THREE.Vector3(rotated.x, 0, rotated.y).normalize());
        }
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