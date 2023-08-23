/* (c) William Edwards 2023
  Licensed under the AGPLv3; see LICENSE for details */

import * as THREE from "three";
import {CSS2DObject} from "three/examples/jsm/renderers/CSS2DRenderer.js";

export class GuideLine {
    constructor(scene, name, start, end, color, prefix = "", showMeasurement = true, showStartDot = true) {
        this.name = name;
        this.line = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({color: color}));
        if (showMeasurement || showStartDot) {
            this.line.layers.enableAll();
        }
        this.prefix = prefix;
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

    update(start, end, color = null) {
        this.start = start;
        this.end = end;
        this.line.geometry.setFromPoints([
            // we raise it up very slightly so that it doesn't z-fight the grid
            start.clone().setY(start.y - 0.01),
            end.clone().setY(end.y - 0.01)]);
        this.length = start.distanceTo(end);
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

export function createDot(visible = true) {
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