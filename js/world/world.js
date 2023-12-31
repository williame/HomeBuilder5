/* (c) William Edwards 2023 */

import * as THREE from 'three';
import {Component, ComponentCollection} from "./component.js";
import {Level} from "./level.js";
import {EditLog} from "./edit_log.js";
import {registerWallCommands} from "./wall.js";
import * as asserts from "../asserts.js";

const epsilon = 0.0001;
const origin = new THREE.Vector3();
const deg90 = THREE.MathUtils.degToRad(90);

class World {

    constructor() {
        this.homeBuilderIdSeq = 0;
        this.components = new ComponentCollection();
        this.activeLevel = new Level(this, this.generateHomeBuilderId(Level.IDPrefix));
        this.levels = {}
        this.levels[this.activeLevel.homeBuilderId] = this.activeLevel;
        this.scene = new THREE.Scene();
        this.views = [];
        this.editLog = new EditLog(this);
        this.units = {
            system: "metric",
            precision: "mm",
            toPrecision: (n) => Math.round(asserts.assertNumber(n)),
            mm: (n) => asserts.assertInt(n),
            cm: (n) => Math.round(asserts.assertNumber(n) * 10),
            m: (n) => Math.round(asserts.assertNumber(n) * 1000),
        }
        this.view = {
            gridScale: this.units.m(1),
            maxExtent: this.units.m(30),
        }
        this.defaults = {
            wallWidth: this.units.cm(40),
            wallHeight: this.units.m(2.4),
        }
        registerWallCommands(this);
    }

    viewsNeedUpdate() {
        for (let i = 0, e = this.views.length; i < e; i++) {
            this.views[i].needsUpdate();
        }
    }

    addComponent(component) {
        this.components.addComponent(asserts.assertInstanceOf(component, Component));
    }

    getComponent(id) {
        return this.components.getComponent(asserts.assertHomeBuilderId(id));
    }

    removeComponent(component) {
        this.components.removeComponent(asserts.assertInstanceOf(component, Component));
    }

    generateHomeBuilderId(prefix) {
        asserts.assertString(prefix);
        let id;
        do {
            id = prefix + "_" + this.homeBuilderIdSeq++;
        } while(this.components.hasOwnProperty(id));
        return id;
    }
}

export {World, epsilon, origin, deg90}