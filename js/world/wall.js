/* (c) William Edwards 2023 */

import * as THREE from 'three';
import {deg90, epsilon, World} from "./world.js";
import {Component} from "./Component.js";
import {intersectY, Level, lineToAngleY} from "./level.js";
import {ParallelLines, Polygon} from "./shapes.js";
import * as asserts from "../asserts.js";

export class Wall extends Component {
    height = 2.4;
    width = 0.4;
    highlightMaterial = new THREE.MeshStandardMaterial({color: 0xff3030});
    highlightEdgesMaterial = new THREE.LineBasicMaterial({color: 0xffc0c0});

    constructor(world, start, end, angle) {
        asserts.assertInstanceOf(world, World);
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
        const newAngle = lineToAngleY(start, end);
        asserts.assertTrue(typeof this.angle === "undefined" ||
            Math.abs(this.angle - newAngle) <= 1,
            "angle too far", newAngle, this.angle, this);
        this.angle = newAngle;
        // update our footprint polygon
        if (this.footprint) {
            this.footprint.set(this.start, this.end, this.angle);
        } else {
            this.footprint = new WallFootprint(this, this.level, this.start, this.end, this.width, this.angle);
        }
        // trigger a rebuild of this wall and any others sharing any affected end-point
        this.level.updateWalls(this.start, this.end, oldStart, oldEnd);
    }

    split(at) {
        asserts.assertTrue(Math.abs(this.line.closestPointToPoint(at, true, new THREE.Vector3()).distanceTo(at)) <= epsilon, this, at);
        asserts.assertTrue(!at.equals(this.start) && !at.equals(this.end), this, at);
        new Wall(this.world, this.start, at, this.angle);
        this.set(at, this.end);
    }

    rebuild() {
        this.removeAllObjects();
        this.footprint.rebuild(); // force recomputing the footprint as walls sharing the ends may have changed
        // build 3d geometry by extruding the footprint polygon
        this.addObject(this.footprint.toMesh(this.height, this.isHighlighted? this.highlightMaterial: this.material));
        if (this.isHighlighted) {
            this.addObject(this.footprint.toMesh(this.height, this.highlightEdgesMaterial, true));
        }
    }
}

export class WallFootprint extends ParallelLines {
    constructor(wall, level, start, end, width, angle=undefined) {
        asserts.assertInstanceOf(wall, Wall, true);
        asserts.assertInstanceOf(level, Level);
        asserts.assertNumber(width);
        asserts.assertNumber(angle, true);
        super(start, end, width, angle);
        this.wall = wall;
        this.level = level;
    }

    set(start, end, angle=undefined) {
        super.set(start, end, angle);
        this.polygon = null;
    }

    isParallel(angle) {
        return angle % 180 === this.angle % 180;
    }

    rebuild() {
        // work out where the parallel faces are chopped by all the walls that share the ends
        let leftStart = null, rightStart = null, leftEnd = null, rightEnd = null;
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
            if (wall === this.wall) {
                continue;
            }
            const startStart = wall.start.equals(this.start), startEnd = !startStart && wall.end.equals(this.start);
            const endStart = wall.start.equals(this.end), endEnd = !endStart && wall.end.equals(this.end);
            if (startStart || startEnd || endStart || endEnd) {
                if (this.isParallel(wall.angle)) {  // continues in same direction?
                    leftStart = parallel(startStart || startEnd, leftStart, 0);
                    rightStart = parallel(startStart || startEnd, rightStart, 0);
                    leftEnd = parallel(endStart || endEnd, leftEnd, 1);
                    rightEnd = parallel(endStart || endEnd, rightEnd, 1);
                } else {
                    leftStart = intersect(startStart, leftStart, this.leftLine, wall.footprint.rightLine, greater);
                    leftStart = intersect(startEnd, leftStart, this.leftLine, wall.footprint.leftLine, greater);
                    rightStart = intersect(startStart, rightStart, this.rightLine, wall.footprint.leftLine, greater);
                    rightStart = intersect(startEnd, rightStart, this.rightLine, wall.footprint.rightLine, greater);
                    leftEnd = intersect(endStart, leftEnd, this.leftLine, wall.footprint.leftLine, lesser);
                    leftEnd = intersect(endEnd, leftEnd, this.leftLine, wall.footprint.rightLine, lesser);
                    rightEnd = intersect(endStart, rightEnd, this.rightLine, wall.footprint.rightLine, lesser);
                    rightEnd = intersect(endEnd, rightEnd, this.rightLine, wall.footprint.leftLine, lesser);
                }
            }
        }
        // build 2d outline on ground;
        this.polygon = new Polygon(this.start);
        this.polygon.lineTo(leftStart && leftStart.point? leftStart.point: this.leftLine.start);
        this.polygon.lineTo(leftEnd && leftEnd.point? leftEnd.point: this.leftLine.end);
        this.polygon.lineTo(this.end);
        this.polygon.lineTo(rightEnd && rightEnd.point? rightEnd.point: this.rightLine.end);
        this.polygon.lineTo(rightStart && rightStart.point? rightStart.point: this.rightLine.start);
        this.polygon.closePath();
    }

    toMesh(height, material, wireframe=false) {
        const geometry = new THREE.ExtrudeGeometry(this.polygon.toShape(), {depth: height, bevelEnabled: false});
        const mesh = wireframe?
            new THREE.LineSegments(new THREE.EdgesGeometry(geometry), material):
            new THREE.Mesh(geometry, material);
        mesh.rotateX(deg90);  // the extrusion was on the z-axis
        mesh.position.setY(this.start.y + height);
        mesh.updateMatrix();
        return mesh;
    }

    intersects(wall) {
        asserts.assertInstanceOf(wall, Wall);
        return this.wall === wall? false: this.polygon.intersects(wall.polygon);
    }

}