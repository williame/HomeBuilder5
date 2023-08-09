import * as THREE from 'three';
import {CSS2DObject} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {Wall} from '../world/wall.js';
import {Tool} from "./tool.js";
import {intersectY} from "../world/level.js";

class WallTool extends Tool {

    constructor(worldView) {
        super(worldView);

        this.cursor = document.createElement("div");
        this.cursor.className = "mouse_circle1";
        worldView.pane.appendChild(this.cursor);

        this.snap = true;
        this.mousePos = null;
        this.guides = {};
    }

    reset() {
        this.placingEnd = false;
        this.ok = false;
        this.startPoint = new THREE.Vector3();
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
        const guides = this.guides, hide = Object.keys(this.guides), scene = this.worldView.scene;
        function addGuide(name, start, end, color) {
            if (name in guides) {
                guides[name].update(start, end, color);
                const hideIdx = hide.indexOf(name);
                if (hideIdx !== -1) {
                    hide.splice(hideIdx, 1);
                }
            } else {
                guides[name] = new GuideLine(scene, start, end, color);
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
                const wallEnd = snap.type === "wall_align_start" ? snap.wall.start: snap.wall.end;
                addGuide(guideName, mousePos, wallEnd, 0xc0c0ff);
            } else if (snap && snap.type === "wall_align_intersection") {
                let guideName = snap.type + "_" + snap.walls.wallA + "_" + snap.walls.wallAEnd;
                let wallEnd = snap.walls.wallAEnd === "start"? snap.walls.wallA.start: snap.walls.wallA.end;
                addGuide(guideName, mousePos, wallEnd, 0xc0c0ff);
                guideName = snap.type + "_" + snap.walls.wallB + "_" + snap.walls.wallBEnd;
                wallEnd = snap.walls.wallBEnd === "start"? snap.walls.wallB.start: snap.walls.wallB.end;
                addGuide(guideName, mousePos, wallEnd, 0xc0c0ff);
            }
        }
        for (const hideName of hide) {
            this.guides[hideName].removeFromParent();
            delete this.guides[hideName];
        }
        this.worldView.needsUpdate();
    }

    onMouseMove(event) {
        const mouseRay = this.worldView.getMouseRay(event);
        let x = event.clientX - this.worldView.pane.offsetLeft;
        let y = event.clientY - this.worldView.pane.offsetTop;
        let mousePos = null, snaps = null;
        const intersection = mouseRay.ray.intersectPlane(this.world.activeLevel.floorPlane, new THREE.Vector3());
        this.ok = !!intersection;
        if(intersection) {
            intersection.setY(this.world.activeLevel.floorPlane.constant);
            const candidates = [];
            this.snap = !event.shiftKey;
            let nearestWallAlignIntersection = 0.1;
            let hasWallAlignIntersection = false;
            if (this.snap) {
                for (const wallAlignIntersection of this.world.activeLevel.snapWallAlignIntersections) {
                    const distance = intersection.distanceTo(wallAlignIntersection.point);
                    if (distance < nearestWallAlignIntersection) {
                        candidates.push({
                            point: wallAlignIntersection.point,
                            distance: distance,
                            type: "wall_align_intersection",
                            walls: wallAlignIntersection,
                        });
                        nearestWallAlignIntersection = distance;
                        hasWallAlignIntersection = true;
                    }
                }
            }
            // the ends and any midpoint of all existing walls
            for (const wall of this.world.activeLevel.walls.values) {
                //TODO NOT OK if the proposed wall intersects the current wall?
                if (!this.placingEnd && this.snap) {
                    const candidate = new THREE.Vector3();
                    const directionSnapping = new THREE.Ray(),
                        directionSnappingPoint = new THREE.Vector3();
                    wall.line.closestPointToPoint(intersection, true, candidate);
                    let distance = candidate.distanceTo(intersection);
                    let snapType = "wall_closest_point";
                    for (const end of [wall.start, wall.end]) {
                        const endDistance = end.distanceTo(intersection);
                        if (endDistance <= distance) {
                            distance = endDistance;
                            candidate.copy(end);
                            snapType = "wall_" + (end.equals(wall.start) ? "start" : "end");
                        } else if (!hasWallAlignIntersection && !event.ctrlKey) {
                            directionSnapping.origin.copy(end);
                            for (const snapDirection of this.world.activeLevel.snapDirections) {
                                directionSnapping.direction.copy(snapDirection);
                                directionSnapping.closestPointToPoint(intersection, directionSnappingPoint);
                                directionSnappingPoint.setY(intersection.y);
                                const directionSnappingDistance = directionSnappingPoint.distanceTo(intersection);
                                if (directionSnappingDistance < distance) {
                                    distance = directionSnappingDistance;
                                    candidate.copy(directionSnappingPoint);
                                    snapType = "wall_align_" + (end.equals(wall.start) ? "start" : "end");
                                }
                            }
                        }
                    }
                    if (distance < 1) {
                        candidates.push({
                            point: candidate.clone(),
                            distance: distance,
                            type: snapType,
                            wall: wall,
                        });
                    }
                } else {
                    const snapEnd = new THREE.Vector3();
                    for (const snapDirection of this.world.activeLevel.snapDirections) {
                        snapEnd.copy(this.startPoint).add(snapDirection);
                        const candidate = intersectY(this.startPoint, snapEnd, wall.start, wall.end);
                        if (candidate && candidate.inB) {
                            candidate.point.setY(intersection.y);
                            const distance = candidate.point.distanceTo(intersection);
                            if (distance < 1) {
                                candidates.push({
                                    point: candidate.point,
                                    distance: distance,
                                    type: "wall_snap_ray",
                                    wall: wall,
                                });
                                break;
                            }
                        }
                    }
                }
            }
            if (!candidates.length && this.snap && !this.placingEnd) {
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
            } else if (this.snap && this.placingEnd) {
                // the continuation of the current line
                const ray = new THREE.Ray(this.startPoint);
                const candidate = new THREE.Vector3();
                for (const snapDirection of this.world.activeLevel.snapDirections) {
                    ray.direction.copy(snapDirection);
                    ray.closestPointToPoint(intersection, candidate);
                    candidate.setY(intersection.y);
                    candidates.push({
                        point: candidate.clone(),
                        distance: candidate.distanceTo(intersection),  // continuations allowed at any distance
                        type: "continuation",
                    });
                }
            }
            // do we have any candidates?
            if (candidates.length) {
                // reduce to those snaps for the closest point
                for (const candidate of candidates) {
                    if (snaps === null || candidate.distance < snaps[0].distance) {
                        snaps = [candidate];
                    } else if (candidate.point.distanceTo(snaps[0].point) <= 0.01) {  // really
                        // close...
                        snaps.push(candidate);
                    }
                }
                mousePos = snaps[0].point;
            } else if (!this.snap) {
                mousePos = intersection;
            } else {
                this.ok = false;
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
        this.cursor.style.backgroundColor = mousePos? "#00ff0030": "#ff0000";
        this.cursor.style.visibility = "visible";
    }

    onMouseDown(event) {
        if (this.mousePos) {
            this.snap = !event.shiftKey;
            this.updateGuides(this.mousePos);
        }
    }

    onMouseUp() {
        if (this.mousePos) {
            if (this.placingEnd && this.ok) {
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
                console.log(startSnapTypes.substring(1) || null, "-->", endSnapTypes.substring(1) || null);
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
            label.className = "guide_line_label";
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

export {WallTool};