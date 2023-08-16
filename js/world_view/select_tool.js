/* (c) William Edwards 2023
  Licensed under the AGPLv3; see LICENSE for details */

import {Tool} from "./tool.js";

class SelectTool extends Tool {
    constructor(worldView) {
        super(worldView);
        this.highlighted = null;
    }

    disableHighlight() {
        if (this.highlighted) {
            this.worldView.world.getComponent(this.highlighted).rebuild(false);
            this.highlighted = null;
        }
    }

    disable() {
        this.disableHighlight();
        super.disable();
        this.world.viewsNeedUpdate();
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
        const newTarget = intersections.length? intersections[0].object.userData.homeBuilderId: null;
        if (newTarget !== this.highlighted) {
            this.disableHighlight();
            this.highlighted = newTarget;
            if (newTarget) {
                this.world.getComponent(this.highlighted).rebuild(true);
                this.world.viewsNeedUpdate();
            }
        }
    }
}

export {SelectTool};