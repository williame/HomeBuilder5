/* (c) William Edwards 2023
  Licensed under the AGPLv3; see LICENSE for details */

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
}

export {Tool}