/* (c) William Edwards 2023 */

class Tool {
    constructor(worldView) {
        this.worldView = worldView;
        this.world = worldView.world;
        // bind all the event listeners to 'this'
        this.eventListeners = {};
        for (const methodName of Object.getOwnPropertyNames(Object.getPrototypeOf(this))) {
            if (methodName.startsWith("on")) {
                const eventName = methodName.substring(2).toLowerCase();
                this.eventListeners[eventName] = this[methodName].bind(this);
            }
        }
    }

    enable() {
        const view = this.worldView.renderer.domElement;
        for (const [name, listener] of Object.entries(this.eventListeners)) {
            (name.startsWith("key")? document: view).addEventListener(name, listener);
        }
    }

    disable() {
        const view = this.worldView.renderer.domElement;
        for (const [name, listener] of Object.entries(this.eventListeners)) {
            (name.startsWith("key")? document: view).removeEventListener(name, listener);
        }
    }

    onKeyDown(event) {
        // implement default shortcut key combos
        let swallowEvent = true;
        if (event.code === "KeyZ" && (event.ctrlKey || event.metaKey)) {
            if (this.world.editLog.canUndo()) {
                this.world.editLog.undo();
            } else {
                console.log("(cannot undo)");
            }
        } else if (event.code === "KeyY" && (event.ctrlKey || event.metaKey)) {
            if (this.world.editLog.canRedo()) {
                this.world.editLog.redo();
            } else {
                console.log("(cannot redo)");
            }
        } else {
            console.log("tool unhandled on-key-down", event);
            swallowEvent = false;
        }
        if (swallowEvent) {
            event.stopPropagation();
            event.preventDefault();
        }
    }
}

export {Tool}