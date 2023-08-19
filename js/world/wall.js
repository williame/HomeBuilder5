/* (c) William Edwards 2023
  Licensed under the AGPLv3; see LICENSE for details */

import * as THREE from 'three';
import {deg90, epsilon} from "./world.js";
import {Component} from "./Component.js";
import {AngleYDirection, intersectY, lineToAngleY} from "./level.js";

class Wall extends Component {
    height = 2.4;
    width = 0.4;
    highlightMaterial = new THREE.MeshStandardMaterial({color: 0xff3030});
    highlightEdgesMaterial = new THREE.LineBasicMaterial({color: 0xffc0c0});

    constructor(world, start, end, angle) {
        super(world);
        this.angle = angle;
        this.line = new THREE.Line3();
        this.color = new THREE.Color(Math.random() * 0.3 + 0.2, Math.random() * 0.3 + 0.2, Math.random() * 0.3 + 0.2);
        this.material = new THREE.MeshStandardMaterial({color: this.color.getHex()});
        this.set(start, end);
    }

    destroy() {
        super.destroy();
        this.level.updateWalls(this.start, this.end);
    }

    set(start, end) {
        const oldStart = this.start, oldEnd = this.end;
        // create our centerline
        this.start = start;
        this.end = end;
        this.line.set(start, end);
        // set/check our angle
        if (typeof this.angle === "undefined") {
            this.angle = lineToAngleY(start, end);
        } else {
            console.assert(Math.abs(this.angle - lineToAngleY(start, end)) <= 1,
                "angle too far", lineToAngleY(start, end), this);
        }
        // create a collision capsule
        this.capsule = new Capsule2(this.start, this.end, this.width / 2, this.angle);
        // borrow the lines that the capsule has computed
        this.leftLine = this.capsule.leftLine;
        this.rightLine = this.capsule.rightLine;
        // trigger a rebuild of this wall and any others sharing any affected end-point
        this.level.updateWalls(this.start, this.end, oldStart, oldEnd);
    }

    split(at) {
        console.assert(Math.abs(this.line.closestPointToPoint(at, true, new THREE.Vector3()).distanceTo(at)) <= epsilon, this, at);
        console.assert(!at.equals(this.start) && !at.equals(this.end), this, at);
        new Wall(this.world, this.start, at, this.angle);
        this.set(at, this.end);
    }

    rebuild() {
        this.removeAllObjects();
        // find the angles of the other walls sharing each end-point
        let leftStart, rightStart, leftEnd, rightEnd;
        const greater = (a, b) => a < b;
        const lesser = (a, b) => a > b;
        function parallel(cond, corner, uA) {
            return cond && (!corner || (uA? corner.uA > uA: corner.uA < uA))? {uA: uA}: corner;
        }
        function intersect(cond, corner, lineA, lineB, cmp) {
            const intersection = cond? intersectY(lineA.start, lineA.end, lineB.start, lineB.end): false;
            return intersection && (!corner || cmp(corner.uA, intersection.uA))? intersection: corner;
        }
        for (const wall of this.level.walls.values) {
            if (wall === this) {
                continue;
            }
            const startStart = wall.start.equals(this.start), startEnd = !startStart && wall.end.equals(this.start);
            const endStart = wall.start.equals(this.end), endEnd = !endStart && wall.end.equals(this.end);
            if (startStart || startEnd || endStart || endEnd) {
                if (wall.angle === this.angle || wall.angle === (this.angle + 180) % 360) {  // continues in same direction?
                    leftStart = parallel(startStart || startEnd, leftStart, 0);
                    rightStart = parallel(startStart || startEnd, rightStart, 0);
                    leftEnd = parallel(endStart || endEnd, leftEnd, 1);
                    rightEnd = parallel(endStart || endEnd, rightEnd, 1);
                } else {
                    leftStart = intersect(startStart, leftStart, this.leftLine, wall.rightLine, greater);
                    leftStart = intersect(startEnd, leftStart, this.leftLine, wall.leftLine, greater);
                    rightStart = intersect(startStart, rightStart, this.rightLine, wall.leftLine, greater);
                    rightStart = intersect(startEnd, rightStart, this.rightLine, wall.rightLine, greater);
                    leftEnd = intersect(endStart, leftEnd, this.leftLine, wall.leftLine, lesser);
                    leftEnd = intersect(endEnd, leftEnd, this.leftLine, wall.rightLine, lesser);
                    rightEnd = intersect(endStart, rightEnd, this.rightLine, wall.rightLine, lesser);
                    rightEnd = intersect(endEnd, rightEnd, this.rightLine, wall.leftLine, lesser);
                }
            }
        }
        // build 2d outline on ground; this becomes the top of the shape
        const shape = new THREE.Shape();
        function shapeLineTo(point, def) {
            if(point && point.point) {
                shape.lineTo(point.point.x, point.point.z);
            } else {
                shape.lineTo(def.x, def.z);
            }
        }
        shape.moveTo(this.start.x, this.start.z);
        shapeLineTo(leftStart, this.leftLine.start);
        shapeLineTo(leftEnd, this.leftLine.end);
        shape.lineTo(this.end.x, this.end.z);
        shapeLineTo(rightEnd, this.rightLine.end);
        shapeLineTo(rightStart, this.rightLine.start);
        shape.closePath();

        // build 3d geometry by extruding it
        const geometry = new THREE.ExtrudeGeometry(shape, {depth: this.height, bevelEnabled: false});
        this.wall_mesh = new THREE.Mesh(geometry, this.isHighlighted? this.highlightMaterial: this.material);
        this.wall_mesh.rotateX(deg90);  // the extrusion was on the z-axis
        this.wall_mesh.position.setY(this.start.y + this.height);
        this.wall_mesh.updateMatrix();
        this.addObject(this.wall_mesh);
        if (this.isHighlighted) {
            this.highlightEdges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), this.highlightEdgesMaterial);
            this.highlightEdges.rotateX(deg90);
            this.highlightEdges.position.copy(this.wall_mesh.position);
            this.addObject(this.highlightEdges);
        }
        if (false) {
            // debug!
            for (const [end, corner] of [[this.start, leftStart], [this.start, rightStart], [this.end, leftEnd], [this.end, rightEnd]]) {
                if (corner && corner.point) {
                    this.addObject(new THREE.Line(new THREE.BufferGeometry().setFromPoints([end, corner.point]), this.highlightEdgesMaterial));
                }
            }
            this.addObject(new THREE.Line(new THREE.BufferGeometry().setFromPoints([this.leftLine.start, this.leftLine.end]), this.highlightEdgesMaterial));
            this.addObject(new THREE.Line(new THREE.BufferGeometry().setFromPoints([this.rightLine.start, this.rightLine.end]), this.highlightEdgesMaterial));
        }
    }
}

class Capsule2 {
    constructor(start, end, radius, angle) {
        console.assert(start instanceof THREE.Vector3, typeof start, start);
        console.assert(end instanceof THREE.Vector3, typeof end, end);
        console.assert(typeof radius === "number", typeof radius, radius);
        console.assert(typeof angle === "number", typeof angle, angle);
        this.start = start;
        this.end = end;
        this.radius = radius;
        if (typeof angle === "undefined") {
            this.angle = lineToAngleY(start, end);
        } else {
            console.assert(Math.abs(angle - lineToAngleY(start, end)) <= 1,
                "angle too far", lineToAngleY(start, end), this);
            this.angle = angle;
        }
        const direction = new THREE.Vector3().subVectors(end, start);
        this.normal = direction.clone().normalize();
        direction.setLength(radius);
        this.base = new THREE.Vector3().subVectors(start, direction);
        this.tip = new THREE.Vector3().addVectors(end, direction);
        const widthOffset = new AngleYDirection(this.angle + 90).setLength(this.radius);
        this.line = new THREE.Line3(start, end);
        this.leftLine = this.line.clone();
        this.leftLine.start.sub(widthOffset);
        this.leftLine.end.sub(widthOffset);
        this.rightLine = this.line.clone();
        this.rightLine.start.add(widthOffset);
        this.rightLine.end.add(widthOffset);
    }

    toShape() {
        const angleA = THREE.MathUtils.degToRad(this.angle - 90);
        const angleB = THREE.MathUtils.degToRad(this.angle + 90);
        const shape = new THREE.Shape();
        shape.moveTo(this.leftLine.end.x, this.leftLine.end.z);
        shape.absarc(this.end.x, this.end.z, this.radius, angleA, angleB, true);
        shape.lineTo(this.rightLine.start.x, this.rightLine.start.z);
        shape.absarc(this.start.x, this.start.z, this.radius, angleB, angleA, true);
        shape.closePath();
        return shape;
    }

    intersects(other) {
        console.assert(other instanceof Capsule2, other);
        return false; // TODO
    }
}

export {Wall};