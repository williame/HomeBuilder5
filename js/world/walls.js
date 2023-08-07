import * as THREE from 'three';
import {deg90, up} from "./world.js";
import {Component} from "./Component.js";

class Wall extends Component {
    height = 2.4;
    width = 0.4;
    material = new THREE.MeshStandardMaterial({color: 0x3030ff});
    highlightMaterial = new THREE.MeshStandardMaterial({color: 0xff3030});
    highlightEdgesMaterial = new THREE.LineBasicMaterial({color: 0xffc0c0});

    constructor(world, start, end) {
        super(world);
        this.line = new THREE.Line3();
        this.set(start, end);
    }

    set(start, end) {
        this.start = start;
        this.line.start.copy(start);
        this.end = end;
        this.line.end.copy(end);
        this.rebuild();
    }

    rebuild(highlight=false) {
        this.removeAllObjects();
        const geometry = new THREE.BoxGeometry(this.width, this.height, this.start.distanceTo(this.end));
        this.wall_mesh = new THREE.Mesh(geometry, highlight? this.highlightMaterial: this.material);
        this.wall_mesh.rotateY(deg90);
        const lookAt = this.end.clone().sub(this.start);
        this.wall_mesh.lookAt(lookAt.x, lookAt.y, lookAt.z);
        this.wall_mesh.position.copy(this.start).lerp(this.end, 0.5).setY(this.start.y + this.height / 2);
        this.addObject(this.wall_mesh);
        if (highlight) {
            this.highlightEdges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), this.highlightEdgesMaterial);
            this.highlightEdges.rotateY(deg90);
            this.highlightEdges.lookAt(lookAt.x, lookAt.y, lookAt.z);
            this.highlightEdges.position.copy(this.wall_mesh.position);
            this.addObject(this.highlightEdges);
        }
        this.world.viewsNeedUpdate();
    }
}

export {Wall};