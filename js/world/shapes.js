/* (c) William Edwards 2023 */

import * as THREE from "three";
import {AngleYDirection, lineToAngleY} from "./level.js";
import * as asserts from "../asserts.js";
import {deg90} from "./world.js";
import {assertTruthiness} from "../asserts.js";

export class BoundingRect {
    constructor(point, ) {
        this.set(...arguments);
    }

    set(point, ) {
        asserts.assertTruthiness(arguments.length);
        this.minX = Number.MAX_VALUE; this.minY = Number.MAX_VALUE;
        this.maxX = -Number.MAX_VALUE; this.maxY = -Number.MAX_VALUE;
        for (const point of arguments) {
            this.add(point);
        }
    }

    add(point) {
        asserts.assertInstanceOf(point, [THREE.Vector2, THREE.Vector3]);
        const x = point.x;
        const y = point instanceof THREE.Vector3? point.z: point.y;
        this.minX = Math.min(this.minX, x); this.minY = Math.min(this.minY, y);
        this.maxX = Math.max(this.maxX, x); this.maxY = Math.max(this.maxY, y);
    }

    intersects(other) {
        asserts.assertInstanceOf(other, BoundingRect);
        return !(this.minX > other.maxX || this.maxX < other.minX ||
                 this.minY > other.maxY || this.maxY < other.minY);
    }

    toShape() {
        const shape = new THREE.Shape();
        shape.moveTo(this.minX, this.minY);
        shape.lineTo(this.maxX, this.minY);
        shape.lineTo(this.maxX, this.maxY);
        shape.lineTo(this.minX, this.maxY);
        shape.closePath();
        return shape;
    }

    static fromShape(shape) {
        asserts.assertInstanceOf(shape, THREE.Curve);
        return new BoundingRect(...shape.getPoints());
    }
}

export class ParallelLines {
    constructor(start, end, width, angle=undefined) {
        asserts.assertNumber(width);
        this.width = width;
        this.set(start, end, angle);
    }

    set(start, end, angle=undefined) {
        asserts.assertInstanceOf(start, THREE.Vector3);
        asserts.assertInstanceOf(end, THREE.Vector3);
        asserts.assertNumber(angle, true);
        this.start = start;
        this.end = end;
        if (typeof angle === "undefined") {
            this.angle = lineToAngleY(start, end);
        } else {
            asserts.assertTruthiness(Math.abs(angle - lineToAngleY(start, end)) <= 1,
                "angle too far", lineToAngleY(start, end), this);
            this.angle = angle;
        }
        const widthOffset = new AngleYDirection((this.angle + 90) % 360).setLength(this.width / 2);
        this.line = new THREE.Line3(start, end);
        this.leftLine = this.line.clone();
        this.leftLine.start.sub(widthOffset);
        this.leftLine.end.sub(widthOffset);
        this.rightLine = this.line.clone();
        this.rightLine.start.add(widthOffset);
        this.rightLine.end.add(widthOffset);
    }
}

export class Capsule2 extends ParallelLines {
    constructor(start, end, radius, angle=undefined) {
        super(start, end, radius * 2, angle);
        this.radius = radius;
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
        asserts.assertInstanceOf(other, Capsule2);
        function subVectors(a, b) {
            return new THREE.Vector3().subVectors(a, b);
        }
        const v0 = subVectors(other.start, this.start);
        const v1 = subVectors(other.end, this.start);
        const v2 = subVectors(other.start, this.end);
        const v3 = subVectors(other.end, this.end);
        const d0 = v0.lengthSq(), d1 = v1.lengthSq(), d2 = v2.lengthSq(), d3 = v3.lengthSq();
        const bestB = other.line.closestPointToPoint(d2 < d0 || d2 < d1 || d3 < d0 || d3 < d1 ? this.end : this.start,
            true, new THREE.Vector3());
        const bestA = this.line.closestPointToPoint(bestB, true, new THREE.Vector3());
        return (this.radius + other.radius - subVectors(bestA, bestB).length()) > 0;
    }
}

export class Polygon {
    constructor(startX, startY) {
        this.vertices = [];
        this.lineTo(startX, startY);
        this.closed = false;
    }

    lineTo(x, y) {
        if (x instanceof THREE.Vector3) {
            asserts.assertUndefined(y);
            this.vertices.push(new THREE.Vector2(x.x, x.z));
        } else {
            asserts.assertNumber(x);
            asserts.assertNumber(y);
            this.vertices.push(new THREE.Vector2(x, y));
        }
    }

    closePath() {
        const vertices = this.vertices;
        asserts.assertFalsiness(this.closed, this);
        asserts.assertTruthiness(vertices.length > 1, this);
        vertices.push(vertices[0]);  // copy the start to the end, so we don't need mod-arithmetic
        this.closed = true;
    }

    toShape() {
        asserts.assertTruthiness(this.closed, this);
        const shape = new THREE.Shape();
        shape.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1, e = this.vertices.length - 1; i < e; i++) {
            shape.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        shape.closePath();
        return shape;
    }

    toBoundingRect() {
        return new BoundingRect(...this.vertices);
    }

    intersects(other, hitListener) {
        asserts.assertTruthiness(this !== other);
        let intersects = false;
        const verticesA = this.vertices, verticesB = other.vertices;
        const verticesALength = verticesA.length, verticesBLength = verticesB.length;
        const cx3 = verticesB[0].x, cy3 = verticesB[0].y;
        let x1 = verticesA[0].x, y1 = verticesA[0].y;
        for (let i = 1; i < verticesALength; i++) {
            const vertexA = verticesA[i];
            const x2 = vertexA.x, y2 = vertexA.y;
            // x1,y1 -> x2,y2 are an edge in verticesA
            let x3 = cx3, y3 = cy3;
            for (let j = 1; j < verticesBLength; j++) {
                const vertexB = verticesB[j];
                const x4 = vertexB.x, y4 = vertexB.y;
                // x3,y3 -> x4,y4 are an edge in verticesB
                // line overlaps?
                const d = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
                if (d !== 0) { // Lines aren't parallel
                    const uA = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / d;
                    const uB = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / d;
                    if (uA >= 0 && uA <= 1 && uB >= 0 && uB <= 1) {
                        if (hitListener) {
                            hitListener("lines", x1, y1, x2, y2, x3, y3, x4, y4, uA, uB);
                            intersects = true;
                        } else {
                            return true;
                        }
                    }
                }
                x3 = x4; y3 = y4;
            }
            x1 = x2; y1 = y2;
        }
        return intersects;
    }
}

export function shapeToWireframe(shape, y, color=0x20ff20) {
    asserts.assertInstanceOf(shape, THREE.Shape);
    asserts.assertNumber(y);
    asserts.assertNumber(color);
    const mesh = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.ShapeGeometry(shape)),
        new THREE.MeshBasicMaterial({ color: color }));
    mesh.rotateX(deg90);  // the shape was on the z-axis
    mesh.position.setY(y);
    mesh.updateMatrix();
    return mesh;
}