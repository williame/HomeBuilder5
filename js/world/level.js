import * as THREE from 'three';
import {ComponentCollection} from "./Component.js";
import {Wall} from "./wall.js";
import {origin} from "./world.js";

class Level {

    constructor(world, y) {
        this.world = world;
        this.homeBuilderId = this.constructor.name + "_" + ++world.homeBuilderIdSeq;
        this.y = y;
        this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), y);
        this.components = new ComponentCollection();
        this.walls = new ComponentCollection();
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
        // compute all the wall align intersections
        const wallAlignIntersections = {};
        const alignDirections = this.snapDirections.filter((angle) => angle.angle < 180);
        const wallEnd = new THREE.Vector3(), otherEnd = new THREE.Vector3();
        for (const wall of walls) {
            for (const other of walls) {
                if (other === wall) {
                    break;
                }
                const pointOnLine = new THREE.Vector3();
                for (const wallStart of [wall.start, wall.end]) {
                    for (const otherStart of [other.start, other.end]) {
                        for (const wallDirection of alignDirections) {
                            wallEnd.addVectors(wallStart, wallDirection);
                            for (const otherDirection of alignDirections) {
                                if (!otherDirection.equals(wallDirection)) {
                                    otherEnd.addVectors(otherStart, otherDirection);
                                    const intersection = intersectY(wallStart, wallEnd, otherStart, otherEnd);
                                    if (intersection) {
                                        if (wall.line.closestPointToPoint(intersection.point, true, pointOnLine).distanceToSquared(intersection.point) < 0.1 ||
                                            other.line.closestPointToPoint(intersection.point, true, pointOnLine).distanceToSquared(intersection.point) < 0.1) {
                                            // must be outside the actual wall line
                                            continue;
                                        }
                                        const key = intersection.point.x.toFixed(2) + "_" + intersection.point.z.toFixed(2);
                                        const wallStartDistance = wall.start.distanceTo(intersection.point),
                                            wallEndDistance = wall.end.distanceTo(intersection.point);
                                        const otherStartDistance = other.start.distanceTo(intersection.point),
                                            otherEndDistance = other.end.distanceTo(intersection.point);
                                        const wallDistance = Math.min(wallStartDistance, wallEndDistance);
                                        const otherDistance = Math.min(otherStartDistance, otherEndDistance);
                                        if (wallDistance < 0.05 || otherDistance < 0.05) {
                                            continue;
                                        }
                                        const sumDistance = wallDistance + otherDistance;
                                        if (!(key in wallAlignIntersections) || wallAlignIntersections[key].sumDistance >= sumDistance) {
                                            wallAlignIntersections[key] = {
                                                point: intersection.point,
                                                sumDistance: sumDistance,
                                                wallA: wall,
                                                wallAEnd: wallStartDistance < wallEndDistance ? "start" : "end",
                                                wallADirection: wallDirection,
                                                wallB: other,
                                                wallBEnd: otherStartDistance < otherEndDistance ? "start" : "end",
                                                wallBDirection: otherDirection,
                                            };
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        this.snapWallAlignIntersections = Object.values(wallAlignIntersections);
    }

    roundToPrecision(val) {
        if (val instanceof Number) {
            return Math.round(val * 1000) / 1000;
        } else if (val instanceof THREE.Vector3) {
            return val.set(Math.round(val.x * 1000) / 1000,
                Math.round(val.y * 1000) / 1000,
                Math.round(val.z * 1000) / 1000);
        }
        throw new Error("cannot handle roundToPrecision(" + (typeof val) + ": " + val);
    }

    updateWalls() {
        console.log("TODO update walls");
        this.updateSnaps();
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

    intersectY(lineA, lineB, infiniteLines=true) {
        const intersection = intersectY(lineA.start, lineA.end, lineB.start, lineB.end, infiniteLines);
        if (intersection) {
            intersection.point.setY(this.y);
        }
        return intersection;
    }
}

// DIRECTIONS ARE NOT NORMALIZED!
class AngleYDirection extends THREE.Vector3 {
    constructor(angle) {
        console.assert(angle === Math.round(angle), angle);
        const rotated = new THREE.Vector2(10000).rotateAround(origin, THREE.MathUtils.degToRad(angle));
        super(rotated.x, 0, rotated.y);
        this.angle = angle;
    }
}

function lineToAngleY(start, end) {
    return Math.abs(Math.round(THREE.MathUtils.radToDeg(new THREE.Vector2(start.x - end.x, start.z - end.z).angle())));
}

// Line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
// Determine the intersection point of two 3D lines on the Y plane
// Return null if no intersection and false if the lines are parallel
function intersectY(startA, endA, startB, endB, infiniteLines = true) {
    // map three.js z to 2D x y
    const x1 = startA.x, y1 = startA.z, x2 = endA.x, y2 = endA.z;
    const x3 = startB.x, y3 = startB.z, x4 = endB.x, y4 = endB.z;
    // Check if none of the lines are of length 0
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
        return null;
    }
    const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
    if (denominator === 0) { // Lines are parallel
        return false;
    }
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

    // is the intersection along the segments
    if (!infiniteLines && (ua < 0 || ua > 1 || ub < 0 || ub > 1)) {
        return null;
    }
    // return intersection
    return {
        point: new THREE.Vector3(x1 + ua * (x2 - x1),
            startA.y + ua * (endA.y - startA.y),
            y1 + ua * (y2 - y1)),  // back to 3D
        inA: ua >= 0 && ua <= 1,
        inB: ub >= 0 && ub <= 1,
    };
}

export {Level, intersectY, lineToAngleY, AngleYDirection};