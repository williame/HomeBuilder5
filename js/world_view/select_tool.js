class SelectTool {
    constructor(worldView) {
        this.worldView = worldView;
        this.highlighted = null;
        this.eventListeners = {
            mousedown: this.onMouseDown.bind(this),
            mousemove: this.onMouseMove.bind(this),
        }
    }

    enable() {
        const view = this.worldView.renderer.domElement;
        for (const [name, listener] of Object.entries(this.eventListeners)) {
            view.addEventListener(name, listener);
        }
    }

    disableHighlight() {
        if (this.highlighted) {
            this.worldView.world.getComponent(this.highlighted).rebuild(false);
            this.highlighted = null;
        }
    }

    disable() {
        this.disableHighlight();
        const view = this.worldView.renderer.domElement;
        for (const [name, listener] of Object.entries(this.eventListeners)) {
            view.removeEventListener(name, listener);
        }
    }

    onMouseMove(event) {
        if (event.buttons) {
            this.onMouseDown(event);
        }
    }

    onMouseDown(event) {
        const mouseRay = this.worldView.getMouseRay(event);
        const intersections = mouseRay.intersectObjects(this.worldView.world.scene.children);
        const newTarget = intersections.length? intersections[0].object.userData.homeBuilderId: null;
        if (newTarget !== this.highlighted) {
            this.disableHighlight();
            if (newTarget) {
                this.highlighted = newTarget;
                this.worldView.world.getComponent(this.highlighted).rebuild(true);
            }
        }
    }
}

export {SelectTool};