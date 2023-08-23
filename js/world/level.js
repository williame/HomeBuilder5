/* (c) William Edwards 2023
  Licensed under the AGPLv3; see LICENSE for details */

import * as THREE from 'three';
import * as asserts from '../asserts.js';
import {ComponentCollection} from "./Component.js";
import {Wall} from "./wall.js";
import {origin} from "./world.js";
import {assertInstanceOf} from "../asserts.js";

class Level {

    constructor(world, y) {
        this.world = world;
        this.homeBuilderId = this.constructor.name + "_" + ++world.homeBuilderIdSeq;
        this.y = y;
        this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), y);
        this.components = new ComponentCollection();
        this.walls = new ComponentCollection();
        this.needingRebuild = {};
        this.rebuildRequested = false;
        this.updateSnaps();
    }

    updateSnaps() {
        const walls = this.walls.values;
        // snap angles
        const snapAngles = [0, 90, 180, 270];
        for (const wall of walls) {
            let dupeSnap = false;
            for (const existing of snapAngles) {
                if (existing === wall.angle) {
                    dupeSnap = true;
                    break;
                } else if (Math.abs(existing - wall.angle) === 1) {
                    console.warn("angle " + wall.angle + " is very close to " + existing, wall);
                }
            }
            if (!dupeSnap) {
                snapAngles.push(wall.angle, (wall.angle + 90) % 360, (wall.angle + 180) % 360, (wall.angle + 270) % 360);
            }
        }
        // change snap angles into directions
        this.snapDirections = snapAngles.map((angle) => new AngleYDirection(angle));
    }

    updateWalls() {
        this.updateSnaps();
        // if we are passed a list of 'dirty' wall end-points, rebuild all walls that share those ends
        if (arguments.length) {
            for (const end of arguments) {
                assertInstanceOf(end, THREE.Vector3, true);
            }
            for (const wall of this.walls.values) {
                for (const end of arguments) {
                    if (end && (wall.start.equals(end) || wall.end.equals(end))) {
                        this.needsRebuild(wall);
                        break;
                    }
                }
            }
        }
    }

    needsRebuild(component) {
        if (!(component.homeBuilderId in this.needingRebuild)) {
            if (!this.rebuildRequested) {
                window.requestAnimationFrame(this.rebuild.bind(this));
                this.rebuildRequested = true;
            }
            this.needingRebuild[component.homeBuilderId] = component;
        }
    }

    rebuild() {
        this.rebuildRequested = false;
        for (const dirty of Object.values(this.needingRebuild)) {
            if (!dirty.destroyed) {
                dirty.rebuild();
            }
        }
        this.needingRebuild = {};
        this.world.viewsNeedUpdate();
    }

    addComponent(component) {
        this.components.addComponent(component);
        if (component instanceof Wall) {
            this.walls.addComponent(component);
        }
    }

    getComponent(id) {
        return this.components.getComponent(id);
    }

    removeComponent(component) {
        this.components.removeComponent(component);
        if (component instanceof Wall) {
            this.walls.removeComponent(component);
        }
    }
}

// DIRECTIONS ARE NOT NORMALIZED!
class AngleYDirection extends THREE.Vector3 {
    constructor(angle) {
        asserts.assertTrue(angle === Math.round((angle + 360) % 360), "bad angle", angle);
        const rotated = new THREE.Vector2(10000).rotateAround(origin, THREE.MathUtils.degToRad(angle));
        super(rotated.x, 0, rotated.y);
        this.angle = angle;
    }
}

function lineToAngleY(start, end) {
    const angle = (Math.round(THREE.MathUtils.radToDeg(new THREE.Vector2(start.x - end.x, start.z - end.z).angle())) + 360) % 360;
    asserts.assertTrue(angle >= 0 && angle < 360, "bad angle", start, end, angle);
    return angle;
}

// Line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
// Determine the intersection point of two 2D/3D lines on the 3D Y plane
// Return null if no intersection and false if the lines are parallel
function intersectY(startA, endA, startB, endB, infiniteLines = true) {
    const is2D = startA instanceof THREE.Vector2;
    // map three.js z to 2D x y
    const x1 = startA.x, y1 = is2D? startA.y: startA.z, x2 = endA.x, y2 = is2D? endA.y: endA.z;
    const x3 = startB.x, y3 = is2D? startB.y: startB.z, x4 = endB.x, y4 = is2D? endB.y: endB.z;
    // Check if none of the lines are of length 0
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
        return null;
    }
    const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
    if (denominator === 0) { // Lines are parallel
        return false;
    }
    const uA = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
    const uB = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

    // is the intersection along the segments
    if (!infiniteLines && (uA < 0 || uA > 1 || uB < 0 || uB > 1)) {
        return null;
    }
    // return intersection
    const x = x1 + uA * (x2 - x1), y = y1 + uA * (y2 - y1);
    return {
        point: is2D? new THREE.Vector2(x, y):
            new THREE.Vector3(x, startA.y + uA * (endA.y - startA.y), y),  // back to 3D
        uA: uA,
        uB: uB,
        inA: uA >= 0 && uA <= 1,
        inB: uB >= 0 && uB <= 1,
    };
}

export {Level, intersectY, lineToAngleY, AngleYDirection};