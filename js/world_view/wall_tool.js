/* (c) William Edwards 2023
  Licensed under the AGPLv3; see LICENSE for details */

import * as THREE from 'three';
import {CSS2DObject} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {Wall} from '../world/wall.js';
import {Tool} from "./tool.js";
import {AngleYDirection, intersectY} from "../world/level.js";
import {epsilon} from "../world/world.js";

class WallTool extends Tool {

    constructor(worldView) {
        super(worldView);

        this.cursor = createDot(false);
        worldView.pane.appendChild(this.cursor);
        this.mousePos = null;
        this.guides = {};
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
        const scene = this.worldView.scene;
        const guides = this.guides;
        const guidesByDirection = {};
        const hide = Object.keys(this.guides);
        function addGuide(name, start, end, color, direction) {
            console.assert(start && end, name, start, end);
            console.assert(!direction || direction instanceof AngleYDirection, name, direction);
            const directionKey = direction? "" + direction.x + "_" + direction.y + "_" + direction.z: false;
            const existing = directionKey? guidesByDirection[directionKey]: false;
            if (existing && existing.name !== name) {
                if (existing.start.distanceTo(existing.end) < start.distanceTo(end)) {
                    return;
                }
                if (hide.indexOf(existing.name) === -1) {
                    hide.push(existing.name);
                }
            }
            if (name in guides) {
                guides[name].update(start, end, color);
                const hideIdx = hide.indexOf(name);
                if (hideIdx !== -1) {
                    hide.splice(hideIdx, 1);
                }
            } else {
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
            } else if (snap && snap.type === "wall_align_intersection") {
                let guideName = snap.type + "_" + snap.walls.wallA + "_" + snap.walls.wallAEnd;
                let wallEnd = snap.walls.wallAEnd === "start"? snap.walls.wallA.start: snap.walls.wallA.end;
                addGuide(guideName, wallEnd, mousePos, 0xc0c0ff, snap.walls.wallADirection);
                guideName = snap.type + "_" + snap.walls.wallB + "_" + snap.walls.wallBEnd;
                wallEnd = snap.walls.wallBEnd === "start"? snap.walls.wallB.start: snap.walls.wallB.end;
                addGuide(guideName, wallEnd, mousePos, 0xc0c0ff, snap.walls.wallBDirection);
            }
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
                (!candidates.length ||
                    distance < candidates[candidates.length - 1].distance ||
                    point.equals(candidates[candidates.length - 1].point)) &&
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
            console.assert(continuation);
            point = continuation.point;
        }
        // first search for a really close-by wall end, gathering wallAlignments as we go
        const wallAlignments = [], tmpLine = new THREE.Line3();
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
                }
                if (!candidates.length) {  // skip if we've found a wall end nearby already
                    tmpLine.start.copy(end);
                    for (const direction of snapDirections) {
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
                                type: "wall_align_" + typeSuffix,
                            });
                        }
                    }
                }
            }
        }
        // if we aren't near any wal ends, then look for wall alignments
        if (!candidates.length && wallAlignments.length) {
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
                            }, {
                                point: intersection.point,
                                distance: distance,
                                wall: alignmentB.wall,
                                type: alignmentB.type,
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
        console.assert(!this.placingEnd);
        if (this.mousePos) {
            this.placingEnd = true;
            this.updateGuides(this.mousePos);
        }
    }

    onMouseUp() {
        if (this.mousePos && this.placingEnd && this.ok) {
            new Wall(this.world, this.startPoint, this.endPoint);  // will add itself to world
            // printf debugging
            let startSnapTypes = "";
            for (const startSnap of (this.startSnaps || [])) {
                startSnapTypes += "|" + startSnap.type;
            }
            let endSnapTypes = "";
            for (const endSnap of (this.endSnaps || [])) {
                endSnapTypes += "|" + endSnap.type;
            }
            console.log("" + (startSnapTypes.substring(1) || null) + " --> " + (endSnapTypes.substring(1) || null));
        }
        this.reset();
    }

    onMouseOut() {
        this.cursor.style.visibility = "hidden";
        this.reset();
    }

    onKeyDown(event) {
        if (event.key === "Escape" && this.placingEnd && !(event.ctrlKey || event.altKey || event.shiftKey)) {
            this.reset();
        }
    }
}

class GuideLine {
    constructor(scene, name, start, end, color, prefix="", showMeasurement=true, showStartDot=true) {
        this.name = name;
        this.line = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({color: color}));
        if (showMeasurement || showStartDot) {
            this.line.layers.enableAll();
        }
        this.prefix = prefix || name;
        if (showMeasurement || this.prefix.length) {
            const label = document.createElement("div");
            label.className = "guide_line_label";
            this.measurementLabel = new CSS2DObject(label);
            this.measurementLabel.center.set(0, 0);
            this.line.add(this.measurementLabel);
        }
        this.showMeasurement = showMeasurement;
        if (showStartDot) {
            const dot = createDot();
            setDotColor(dot, color);
            this.dot = new CSS2DObject(dot);
            this.line.add(this.dot);
        }
        this.showStartDot = showStartDot;
        this.update(start, end);
        scene.add(this.line);
    }

    update(start, end, color=null) {
        this.start = start;
        this.end = end;
        this.line.geometry.setFromPoints([
            // we raise it up very slightly so that it doesn't z-fight the grid
            start.clone().setY(start.y - 0.01),
            end.clone().setY(end.y - 0.01)]);
        let label = this.prefix;
        if (this.showMeasurement) {
            const length = start.distanceTo(end);
            if (length > 0) {
                if (label.length) {
                    label += " ";
                }
                label += Number(length.toFixed(2));
            }
        }
        if (label.length) {
            this.measurementLabel.position.copy(start.clone().lerp(end, 0.5));
            this.measurementLabel.element.textContent = label;
            this.measurementLabel.element.style.visibility = "visible";
        } else if (this.measurementLabel) {
            this.measurementLabel.element.style.visibility = "hidden";
        }
        if (this.showStartDot) {
            if (color instanceof Number) {
                setDotColor(this.dot, color);
            }
            this.dot.position.copy(start);
        }
        if (color) {
            this.line.material.color.setHex(color);
        }
        this.line.visible = true;
    }

    removeFromParent() {
        this.line.removeFromParent();
        if (this.showMeasurement) {
            this.measurementLabel.removeFromParent();
        }
        if (this.showStartDot) {
            this.dot.removeFromParent();
        }
    }
}

function createDot(visible=true) {
    const dot = document.createElement("div");
    dot.className = "mouse_circle1";
    if (!visible) {
        dot.style.visibility = "hidden";
    }
    return dot;
}

function setDotColor(dot, color) {
    const hexColor = "#" + color.toString(16);
    dot.style.borderColor = hexColor;
    dot.style.backgroundColor = hexColor + "30";  // nearly transparent
}

export {WallTool};