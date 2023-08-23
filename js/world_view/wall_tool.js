/* (c) William Edwards 2023 */

import * as THREE from 'three';
import * as asserts from '../asserts.js';
import {Wall} from '../world/wall.js';
import {Tool} from "./tool.js";
import {AngleYDirection, intersectY} from "../world/level.js";
import {epsilon} from "../world/world.js";
import {createDot, GuideLine} from "./guide_line.js";

export class WallTool extends Tool {

    constructor(worldView) {
        super(worldView);

        this.cursor = createDot(false);
        worldView.pane.appendChild(this.cursor);
        this.mousePos = null;
        this.guides = {};
        this.debug = false;
    }

    reset() {
        this.placingEnd = false;
        this.ok = false;
        this.startPoint = this.mousePos? this.mousePos.clone(): new THREE.Vector3();
        this.startSnaps = null;
        this.endPoint = new THREE.Vector3();
        this.endSnaps = null;
        for (const guide of Object.values(this.guides)) {
            guide.removeFromParent();
        }
        this.guides = {}
        this.worldView.needsUpdate();
    }

    enable() {
        super.enable();
        this.reset();
    }

    disable() {
        super.disable();
        this.onMouseOut();
    }

    updateGuides(mousePos, snaps=undefined) {
        const debug = this.debug;
        const scene = this.worldView.scene;
        const guides = this.guides;
        const guidesByDirection = {};
        const hide = Object.keys(this.guides);
        function addGuide(name, start, end, color, direction) {
            asserts.assertTrue(start && end, name, start, end);
            asserts.assertInstanceOf(direction, AngleYDirection, true, name);
            const directionKey = direction? "angle=" + direction.angle: false;
            const existing = directionKey? guidesByDirection[directionKey]: false;
            if (existing && existing.name !== name) {
                if (existing.length < start.distanceTo(end)) {
                    if (debug) {
                        console.log("not creating ", directionKey, name, start.distanceTo(end), ">=", existing.name, existing.length);
                    }
                    return;
                }
                if (hide.indexOf(existing.name) === -1) {
                    if (debug) {
                        console.log("hiding ", directionKey, existing.name, existing.length, ">", name, start.distanceTo(end));
                    }
                    hide.push(existing.name);
                }
            }
            if (name in guides) {
                if (debug) {
                    console.log("updating", directionKey || "(no direction)", name);
                }
                guides[name].update(start, end, color);
                const hideIdx = hide.indexOf(name);
                if (hideIdx !== -1) {
                    hide.splice(hideIdx, 1);
                }
            } else {
                if (debug) {
                    console.log("creating", directionKey || "(no direction)", name);
                }
                guides[name] = new GuideLine(scene, name, start, end, color);
            }
            if (directionKey) {
                guidesByDirection[directionKey] = guides[name];
            }
        }
        this.mousePos = mousePos;
        if (this.placingEnd && mousePos) {
            this.endPoint.copy(mousePos);
            this.ok &= this.endPoint.distanceTo(this.startPoint) > 0.5;  // shortest allowed
            if (typeof snaps !== 'undefined') {
                this.endSnaps = snaps;
            } else {
                snaps = this.endSnaps;
            }
            if (!this.endPoint.equals(this.startPoint)) {
                addGuide("new_wall", this.startPoint, this.endPoint, this.ok ? 0x00ff00 : 0xff0000);
            }
        } else if (mousePos) {
            this.startPoint.copy(mousePos);
            if (typeof snaps !== 'undefined') {
                this.startSnaps = snaps;
            } else {
                snaps = this.startSnaps;
            }
        }
        for (const snap of (snaps || [])) {
            if (snap && (snap.type === "wall_align_start" || (snap.type === "wall_align_end"))) {
                const guideName = snap.type + "_" + snap.wall.homeBuilderId;
                const wallEnd = snap.type === "wall_align_start"? snap.wall.start: snap.wall.end;
                addGuide(guideName, wallEnd, mousePos, 0xc0c0ff, snap.direction);
            }
        }
        if (debug && hide.length) {
            console.log("hiding", hide);
        }
        for (const hideName of hide) {
            guides[hideName].removeFromParent();
            delete guides[hideName];
        }
        this.worldView.needsUpdate();
    }

    findSnapPoints(point, maxDistanceThreshold) {
        const walls = this.world.activeLevel.walls.values;
        const snapDirections = this.world.activeLevel.snapDirections;
        let candidates = [];
        let continuation = null, tmpPoint = new THREE.Vector3();
        function isCandidate(point, distance) {
            return distance < maxDistanceThreshold &&
                (!continuation ||
                    continuation.closestPointToPoint(point, true, tmpPoint === point? new THREE.Vector3(): tmpPoint).distanceTo(point) <= epsilon);
        }
        // if we're placing the end-point, then first compute the continuation in a snap direction
        if (this.placingEnd && !point.equals(this.startPoint)) {
            for (const direction of snapDirections) {
                const line = new THREE.Line3(this.startPoint);
                line.end.addVectors(line.start, direction);
                line.closestPointToPoint(point, true, tmpPoint);
                const distance = tmpPoint.distanceTo(point);
                if ((!continuation || distance < continuation.distance) && !tmpPoint.equals(line.start)) {
                    continuation = line;
                    continuation.direction = direction;
                    continuation.point = tmpPoint.clone();
                    continuation.distance = distance;
                }
            }
            asserts.assertTrue(continuation);
            point = continuation.point;
        }
        // first search for a really close-by wall end, gathering wallAlignments as we go
        const wallAlignments = [], tmpLine = new THREE.Line3();
        let hasWallSnaps = false;
        for (const wall of walls) {
            for (const end of [wall.start, wall.end]) {
                const typeSuffix = end === wall.start? "start": "end";
                const distance = end.distanceTo(point);
                if (isCandidate(end, distance)) {
                    candidates.push({
                        point: end,
                        distance: distance,
                        wall: wall,
                        type: "wall_" + typeSuffix,
                    });
                    hasWallSnaps = true;
                }
                if (!hasWallSnaps) {  // skip if we've found a wall end nearby already
                    tmpLine.start.copy(end);
                    for (const direction of snapDirections) {
                        if (wall.footprint.isParallel(direction.angle)) {
                            continue;
                        }
                        tmpLine.end.addVectors(tmpLine.start, direction);
                        tmpLine.closestPointToPoint(point, true, tmpPoint);
                        const distance = tmpPoint.distanceTo(point);
                        if (distance < maxDistanceThreshold && !tmpPoint.equals(end)) {
                            wallAlignments.push({
                                point: tmpPoint.clone(),
                                distance: distance,
                                start: end,
                                end: tmpLine.end.clone(),
                                wall: wall,
                                direction: direction,
                                type: "wall_align_" + typeSuffix,
                            });
                        }
                    }
                }
            }
            if (!hasWallSnaps) {
                let snapPoint = null;
                if (continuation) {
                    const intersection = intersectY(wall.start, wall.end, continuation.start, continuation.end, false);
                    snapPoint = intersection? intersection.point: null;
                } else {
                    snapPoint = wall.line.closestPointToPoint(point, true, new THREE.Vector3());
                }
                const distance = snapPoint !== null? snapPoint.distanceTo(point): maxDistanceThreshold;
                if (distance < maxDistanceThreshold) {
                    candidates.push({
                        point: snapPoint,
                        distance: distance,
                        wall: wall,
                        direction: new AngleYDirection(wall.angle),
                        type: "wall_align_start",
                    }, {
                        point: snapPoint,
                        distance: distance,
                        wall: wall,
                        direction: new AngleYDirection((wall.angle + 180) % 360),
                        type: "wall_align_end",
                    });
                    hasWallSnaps = true;
                }
            }
        }
        // if we aren't near any wal ends, then look for wall alignments
        if (!hasWallSnaps && wallAlignments.length) {
            // any intersections?
            for (const alignmentA of wallAlignments) {
                for (const alignmentB of wallAlignments) {
                    if (alignmentA === alignmentB) {
                        break;
                    }
                    const intersection = intersectY(alignmentA.start, alignmentA.end, alignmentB.start, alignmentB.end, true);
                    if (intersection) {
                        const distance = intersection.point.distanceTo(point);
                        if (isCandidate(intersection.point, distance)) {
                            candidates.push({
                                point: intersection.point,
                                distance: distance,
                                wall: alignmentA.wall,
                                type: alignmentA.type,
                                direction: alignmentA.direction,
                            }, {
                                point: intersection.point,
                                distance: distance,
                                wall: alignmentB.wall,
                                type: alignmentB.type,
                                direction: alignmentB.direction,
                            });
                            alignmentA.hasIntersection = true;
                            alignmentB.hasIntersection = true;
                        }
                    }
                }
            }
            // for those alignments that don't have intersections, are they still interesting?
            for (const alignment of wallAlignments) {
                if (!alignment.hasIntersection && isCandidate(alignment.point, alignment.distance)) {
                    candidates.push(alignment);
                }
            }
        }
        // if no snaps found, then look at the grid
        if (!candidates.length) {
            if (continuation) {
                const length = Math.round(continuation.point.distanceTo(continuation.start) * 10) / 10;
                tmpPoint.copy(continuation.direction).setLength(length).add(continuation.start);
                candidates.push({
                    point: tmpPoint.clone(),
                    distance: tmpPoint.distanceTo(point),
                    angle: continuation.direction.angle,
                    type: "continuation",
                });
            } else {
                tmpPoint.set(Math.round(point.x * 10) / 10, point.y, Math.round(point.z * 10) / 10);
                candidates.push({
                    point: tmpPoint.clone(),
                    distance: tmpPoint.distanceTo(point),
                    type: "snap_to_grid",
                });
            }
        }
        return candidates;
    }

    onMouseMove(event) {
        const maxDistanceThreshold = 0.3;  // TODO work out size of pixel or something from camera projection
        let x = event.clientX - this.worldView.pane.offsetLeft;
        let y = event.clientY - this.worldView.pane.offsetTop;
        const intersection = this.worldView.getMouseRay(event)
            .ray.intersectPlane(this.world.activeLevel.floorPlane, new THREE.Vector3());
        let mousePos = intersection, snaps = null;
        this.ok = intersection && intersection.length() < 30;  // not too far from origin
        if (this.debug) {
            console.log(event.constructor.name, x, y, intersection);
        }
        if(this.ok) {
            intersection.setY(this.world.activeLevel.floorPlane.constant);
            if (!event.shiftKey) {
                const candidates = this.findSnapPoints(intersection, maxDistanceThreshold);
                // do we have any candidates?
                if (candidates.length) {
                    // reduce to those snaps for the closest point
                    for (const candidate of candidates) {
                        if (snaps === null || candidate.distance < snaps[0].distance) {
                            snaps = [candidate];
                        } else if (candidate.point.distanceTo(snaps[0].point) <= 0.001) {  // really close...
                            snaps.push(candidate);
                        }
                    }
                    mousePos = snaps[0].point;
                } else {
                    this.ok = false;
                }
            } else {
                mousePos = intersection;
            }
            if (mousePos) {
                // work out screen position
                const point = mousePos.clone().project(this.worldView.camera);
                x = (point.x + 1) * this.worldView.pane.clientWidth / 2;
                y = -(point.y - 1) * this.worldView.pane.clientHeight / 2;
            }
        }
        this.updateGuides(mousePos, snaps);
        this.cursor.style.left = (x - this.cursor.clientWidth / 2) + "px";
        this.cursor.style.top = (y - this.cursor.clientHeight / 2) + "px";
        this.cursor.style.backgroundColor = this.ok? "#00ff0030": "#ff0000";
        this.cursor.style.visibility = "visible";
    }

    onMouseDown() {
        asserts.assertFalse(this.placingEnd);
        if (this.mousePos) {
            this.placingEnd = true;
            this.updateGuides(this.mousePos);
        }
    }

    onMouseUp() {
        if (this.mousePos && this.placingEnd && this.ok) {
            new Wall(this.world, this.startPoint, this.endPoint);  // will add itself to world
            let startSnapTypes = "";  // printf debugging
            const startWallSplits = {};
            for (const snap of (this.startSnaps || [])) {
                if (snap.type.startsWith("wall_align_")) {
                    const distance = snap.wall.line.closestPointToPoint(this.startPoint, true, new THREE.Vector3()).distanceTo(this.startPoint);
                    const split = snap.direction.angle === snap.wall.angle && distance <= epsilon;
                    if (this.debug) {
                        console.log("consider split start", snap.wall.homeBuilderId, snap.direction.angle, snap.wall.angle, distance, split);
                    }
                    if (split) {
                        startWallSplits[snap.wall.homeBuilderId] = snap.wall;
                    }
                }
                startSnapTypes += "|" + snap.type;
            }
            let endSnapTypes = "";
            const endWallSplits = {};
            for (const snap of (this.endSnaps || [])) {
                if (snap.type.startsWith("wall_align_") &&
                    snap.direction.angle === snap.wall.angle &&
                    Math.abs(snap.wall.line.closestPointToPoint(this.endPoint, true, new THREE.Vector3()).distanceTo(this.endPoint)) <= epsilon) {
                    endWallSplits[snap.wall.homeBuilderId] = snap.wall;
                }
                endSnapTypes += "|" + snap.type;
            }
            console.log("" + (startSnapTypes.substring(1) || null) + " --> " + (endSnapTypes.substring(1) || null), startWallSplits);
            for (const wall of Object.values(startWallSplits)) {
                wall.split(this.startPoint);
            }
            for (const wall of Object.values(endWallSplits)) {
                wall.split(this.endPoint);
            }
        }
        this.reset();
    }

    onMouseOut() {
        this.cursor.style.visibility = "hidden";
        this.reset();
    }

    onKeyDown(event) {
        if (event.key === "Escape") {
            if (this.debug) {
                console.log("disabling extra debug logging for " + this.constructor.name);
                this.debug = false;
            } else if (this.placingEnd && !(event.ctrlKey || event.altKey || event.shiftKey)) {
                this.reset();
            }
        } else if (event.key === "?") {
            console.log("enabling extra debug logging for " + this.constructor.name);
            this.debug = true;
        }
    }
}