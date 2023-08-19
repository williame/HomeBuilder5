/* (c) William Edwards 2023
  Licensed under the AGPLv3; see LICENSE for details */

import * as THREE from 'three';
import {Tool} from "./tool.js";

class SelectTool extends Tool {
    constructor(worldView) {
        super(worldView);
        this.highlighted = null;
    }

    disableHighlight() {
        if (this.highlighted) {
            this.worldView.world.getComponent(this.highlighted).setHighlighted(false);
            this.highlighted = null;
        }
    }

    disable() {
        this.disableHighlight();
        super.disable();
    }

    onKeyDown(event) {
        if (event.key === "Backspace" && this.highlighted) {
            this.world.getComponent(this.highlighted).destroy();
            this.highlighted = null;
            this.world.viewsNeedUpdate();
        }
    }

    onMouseMove(event) {
        if (event.buttons) {
            this.onMouseDown(event);
        }
    }

    onMouseDown(event) {
        const mouseRay = this.worldView.getMouseRay(event);
        const intersections = mouseRay.intersectObjects(this.world.scene.children);
        for (const intersection of intersections) {
            if (intersection.object instanceof THREE.LineSegments) {
                continue;  // ignore intersections with line segments, as they use bounding sphere or something
            }
            const target = intersection.object.userData.homeBuilderId;
            if (target) {
                if (target !== this.highlighted) {
                    this.disableHighlight();
                    this.highlighted = target;
                    if (target) {
                        this.world.getComponent(this.highlighted).setHighlighted(true);
                    }
                }
                break;
            }
        }
    }
}

export {SelectTool};