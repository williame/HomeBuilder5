import * as THREE from 'three';
import {deg90} from "./world.js";
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

// Line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
// Determine the intersection point of two 3D lines on the Y plane
// Return null if no intersection and false if the lines are parallel
function intersectY(startA, endA, startB, endB, infiniteLines=true) {
    // map three.js z to 2D x y
    const x1 = startA.x, y1 = startA.z, x2 = endA.x, y2 = endA.z;
    const x3 = startB.x, y3 = startB.z, x4 = endB.x, y4 = endB.z;
    // Check if none of the lines are of length 0
    if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
        return null;
    }
    const denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
    if (denominator === 0) { // Lines are parallel
        return false;
    }
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;

    // is the intersection along the segments
    if (!infiniteLines && (ua < 0 || ua > 1 || ub < 0 || ub > 1)) {
        return null;
    }
    // return intersection
    return {
        point: new THREE.Vector3(x1 + ua * (x2 - x1),
            startA.y + ua * (endA.y - startA.y),
            y1 + ua * (y2 - y1)),  // back to 3D
        inA: ua >= 0 && ua <= 1,
        inB: ub >= 0 && ub <= 1,
    };
}

export {Wall, intersectY};