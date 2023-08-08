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
    }

    onKeyDown(event) {
        if (event.key === "Backspace" && this.highlighted) {
            this.world.removeComponent(this.world.getComponent(this.highlighted));
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
            if (newTarget) {
                this.highlighted = newTarget;
                this.world.getComponent(this.highlighted).rebuild(true);
            }
        }
    }
}

export {SelectTool};