import * as THREE from 'three';
import {CSS2DObject} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {Wall} from '../world/walls.js';
import {deg90, up} from "../world/world.js";
import {MathUtils} from "three";

class WallTool {

    constructor(worldView) {
        this.worldView = worldView;
        this.floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0));

        this.cursor = document.createElement("div");
        this.cursor.className = "mouse_circle1";
        worldView.pane.appendChild(this.cursor);

        this.snapToGrid = true;
        this.mousePos = null;

        // bind the event listeners to get a working 'this'
        this.eventListeners = {
            mousedown: this.onMouseDown.bind(this),
            mousemove: this.onMouseMove.bind(this),
            mouseup: this.onMouseUp.bind(this),
            mouseout: this.onMouseOut.bind(this),
            keydown: this.onKeyDown.bind(this),
        }
    }

    reset() {
        this.placingEnd = false;
        this.ok = false;
        this.startPoint = new THREE.Vector3();
        this.endPoint = new THREE.Vector3();
        if (this.guideWallLine) {
            this.guideWallLine.removeFromParent();
            this.guideWallLine = null;
        }
        this.worldView.needsUpdate();
    }

    enable() {
        const view = this.worldView.renderer.domElement;
        for (const [name, listener] of Object.entries(this.eventListeners)) {
            (name.startsWith("key")? document: view).addEventListener(name, listener);
        }
        this.reset();
    }

    disable() {
        const view = this.worldView.renderer.domElement;
        for (const [name, listener] of Object.entries(this.eventListeners)) {
            (name.startsWith("key")? document: view).removeEventListener(name, listener);
        }
        this.onMouseOut();
    }

    updateGuides(mousePos) {
        let hideGuideline = this.guideWallLine;
        if (this.placingEnd && mousePos) {
            this.endPoint.copy(mousePos);
            this.ok = false;
            const direction = this.endPoint.clone().sub(this.startPoint).normalize();
            if (direction.length() > 0) {
                if (this.snapToGrid) {
                    for (let i = 0, e = this.worldView.world.snapDirections.length; i < e; i++) {
                        const snapDirection = this.worldView.world.snapDirections[i];
                        if (Math.abs(snapDirection.dot(direction)) === 1) {
                            this.ok = true;
                            break;
                        }
                    }
                } else {
                    this.ok = true;
                }
                if (!this.guideWallLine) {
                    this.guideWallLine = new GuideLine(this.worldView.scene, this.startPoint, this.endPoint, this.ok ? 0x00ff00 : 0xff0000);
                } else {
                    this.guideWallLine.update(this.startPoint, this.endPoint, this.ok ? 0x00ff00 : 0xff0000);
                }
                hideGuideline = false;
                this.worldView.needsUpdate();
            }
        } else if (mousePos) {
            this.startPoint.copy(mousePos);
        }
        if (hideGuideline) {
            this.guideWallLine.removeFromParent();
            this.guideWallLine = null;
            this.worldView.needsUpdate();
        }
    }

    onMouseMove(event) {
        const mouseRay = this.worldView.getMouseRay(event);
        let x = event.clientX - this.worldView.pane.offsetLeft;
        let y = event.clientY - this.worldView.pane.offsetTop;
        const intersection = mouseRay.ray.intersectPlane(this.floorPlane, new THREE.Vector3());
        if(intersection) {
            intersection.setY(this.floorPlane.constant);
            const candidates = [];
            this.snapToGrid = !event.shiftKey;
            if (this.snapToGrid) {
                // the four corners of the current square
                for (const x of [0, 1]) {
                    for (const z of [0, 1]) {
                        const candidate = new THREE.Vector3(Math.floor(intersection.x + x),
                            intersection.y, Math.floor(intersection.z + z));
                        candidates.push({
                            point: candidate,
                            distance: candidate.distanceTo(intersection),
                            type: "corner",
                        });
                    }
                }
            }
            // the ends and any midpoint of all existing walls
            let hasWallCandidates = false;
            for (const [_, wall] of Object.entries(this.worldView.world.walls)) {
                //TODO NOT OK if the proposed wall intersects the current wall?
                const candidate = new THREE.Vector3();
                if (!this.placingEnd || !this.snapToGrid) {
                    wall.line.closestPointToPoint(intersection, true, candidate);
                    const distance = candidate.distanceTo(intersection);
                    if (distance < 1) {
                        candidates.push({
                            point: candidate,
                            distance: distance,
                            type: "wall_closest_point",
                            wall: wall,
                        });
                        hasWallCandidates = true;
                    }
                } else {
                    const snapEnd = new THREE.Vector3();
                    for (const snapDirection of this.worldView.world.snapDirections) {
                        snapEnd.copy(this.startPoint).add(snapDirection);
                        const candidate = intersectY(this.startPoint, snapEnd, wall.start, wall.end);
                        if (candidate && candidate.inB) {
                            const distance = candidate.point.distanceTo(intersection);
                            if (distance < 1) {
                                candidates.push({
                                    point: candidate.point,
                                    distance: distance,
                                    type: "wall_snap_ray",
                                    wall: wall,
                                });
                                hasWallCandidates = true;
                                break;
                            }
                        }
                    }
                }
            }
            if (!hasWallCandidates && this.snapToGrid && this.placingEnd) {
                // the continuation of the current line
                const ray = new THREE.Ray(this.startPoint);
                const candidate = new THREE.Vector3();
                for (const snapDirection of this.worldView.world.snapDirections) {
                    ray.direction.copy(snapDirection);
                    ray.closestPointToPoint(intersection, candidate);
                    const distance = candidate.distanceTo(intersection);
                    if (distance < 1) {
                        candidates.push({
                            point: candidate.clone(),
                            distance: distance,
                            type: "continuation",
                        });
                    }
                }
            }
            // do we have any candidates?
            if (candidates.length) {
                let nearest = null;
                for (const candidate of candidates) {
                    if (nearest === null || candidate.distance < nearest.distance) {
                        nearest = candidate;
                    }
                }
                this.mousePos = nearest.point;
            } else if (!this.snapToGrid) {
                this.mousePos = intersection;
            } else {
                this.mousePos = null;
            }
            if (this.mousePos) {
                // work out screen position
                const point = this.mousePos.clone().project(this.worldView.camera);
                x = (point.x + 1) * this.worldView.pane.clientWidth / 2;
                y = -(point.y - 1) * this.worldView.pane.clientHeight / 2;
            }
        } else {
            this.mousePos = null;
        }
        this.updateGuides(this.mousePos);
        this.cursor.style.left = (x - this.cursor.clientWidth / 2) + "px";
        this.cursor.style.top = (y - this.cursor.clientHeight / 2) + "px";
        this.cursor.style.backgroundColor = this.mousePos? "#00ff0030": "#ff0000";
        this.cursor.style.visibility = "visible";
    }

    onMouseDown(event) {
        if (this.mousePos) {
            this.snapToGrid = !event.shiftKey;
            this.updateGuides(this.mousePos);
        }
    }

    onMouseUp() {
        if (this.mousePos) {
            if (this.placingEnd && this.ok) {
                new Wall(this.worldView.world, this.startPoint, this.endPoint);
                this.reset();
            } else {
                this.placingEnd = true;
                this.updateGuides(this.mousePos);
            }
        } else {
            this.reset();
        }
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
    constructor(scene, start, end, color, showMeasurement=true) {
        this.line = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({color: color}));
        this.showMeasurement = showMeasurement;
        if (showMeasurement) {
            this.line.layers.enableAll();
            const label = document.createElement("div");
            label.className = "measurement";
            this.measurementLabel = new CSS2DObject(label);
            this.measurementLabel.center.set(0, 0);
            this.line.add(this.measurementLabel);
        }
        this.update(start, end);
        scene.add(this.line);
    }

    update(start, end, color=null) {
        this.line.geometry.setFromPoints([
            // we raise it up very slightly so that it doesn't z-fight the grid
            start.clone().setY(start.y + 0.001),
            end.clone().setY(end.y + 0.001)]);
        if (this.showMeasurement) {
            const length = start.distanceTo(end);
            if (length > 0) {
                this.measurementLabel.position.copy(start.clone().lerp(end, 0.5));
                this.measurementLabel.element.textContent = Number(length.toFixed(2));
                this.measurementLabel.element.style.visibility = "visible";
            } else {
                this.measurementLabel.element.style.visibility = "hidden";
            }
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
    }
}

// line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
// Determine the intersection point of two line segments
// Return FALSE if the lines don't intersect
function intersectY(startA, endA, startB, endB, infiniteLines=true) {
    const x1 = startA.x, y1 = startA.z, x2 = endA.x, y2 = endA.z;
    const x3 = startB.x, y3 = startB.z, x4 = endB.x, y4 = endB.z;
    // Check if none of the lines are of length 0
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
        return false;
    }
    const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
    if (denominator === 0) { // Lines are parallel
        return false;
    }
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

    // is the intersection along the segments
    if (!infiniteLines && (ua < 0 || ua > 1 || ub < 0 || ub > 1)) {
        return false;
    }
    // return intersection
    return {
        point: new THREE.Vector3(x1 + ua * (x2 - x1),
            startA.y + ua * (endA.y - startA.y),
            y1 + ua * (y2 - y1)),
        inA: ua >= 0 && ua <= 1,
        inB: ub >= 0 && ub <= 1,
    };
}

export {WallTool};