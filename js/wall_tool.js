import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

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
        for (const [event_name, listener] of Object.entries(this.eventListeners)) {
            (event_name.startsWith("key")? document: view).addEventListener(event_name, listener);
        }
        this.reset();
    }

    disable() {
        const view = this.worldView.renderer.domElement;
        for (const [event_name, listener] of Object.entries(this.eventListeners)) {
            (event_name.startsWith("key")? document: view).removeEventListener(event_name, listener);
        }
        this.onMouseOut();
    }

    updateGuides(mousePos) {
        let hideGuideline = this.guideWallLine;
        if (this.placingEnd) {
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
                    this.guideWallLine = new GuideLine(this.worldView.scene, this.startPoint, this.endPoint, this.ok? 0x00ff00: 0xff0000);
                } else {
                    this.guideWallLine.update(this.startPoint, this.endPoint, this.ok? 0x00ff00: 0xff0000);
                }
                hideGuideline = false;
                this.worldView.needsUpdate();
            }
        } else {
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
            // snap to grid
            this.snapToGrid = !event.shiftKey;
            if (this.snapToGrid) {
                intersection.setX(Math.round(intersection.x));
                intersection.setZ(Math.round(intersection.z));
            }
            intersection.setY(this.floorPlane.constant);
            // update guides
            this.snapToGrid = !event.shiftKey;
            this.mousePos = intersection.clone();
            this.updateGuides(intersection);
            // work out screen position
            intersection.project(this.worldView.camera);
            x = (intersection.x + 1) * this.worldView.pane.clientWidth / 2;
            y = -(intersection.y - 1) * this.worldView.pane.clientHeight / 2;
        } else {
            this.mousePos = null;
        }
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
                const line = [this.startPoint.clone(), this.endPoint.clone()];
                this.worldView.world.walls.push(line);
                new GuideLine(this.worldView.world.scene, line[0], line[1], 0x0000ff, false);
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
            // we raise it up very slightly so that it doesn't z-fight a grid
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