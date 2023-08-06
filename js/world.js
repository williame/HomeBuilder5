import * as THREE from 'three';

class World {
    constructor() {
        this.scene = new THREE.Scene();
        this.walls = [];
        this.snapDirections = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)];
    }
}

export {World}