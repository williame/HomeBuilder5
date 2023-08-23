import * as THREE from "three";
import {AngleYDirection, lineToAngleY} from "./level.js";

export class Capsule2 {
    constructor(start, end, radius, angle) {
        console.assert(start instanceof THREE.Vector3, start);
        console.assert(end instanceof THREE.Vector3, end);
        console.assert(typeof radius === "number", radius);
        console.assert(typeof angle === "number", angle);
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
        this.endOffset = new THREE.Vector3().subVectors(end, start);
        this.normal = this.endOffset.clone().normalize();
        this.endOffset.setLength(radius);
        this.base = new THREE.Vector3().subVectors(start, this.endOffset);
        this.tip = new THREE.Vector3().addVectors(end, this.endOffset);
        const widthOffset = new AngleYDirection((this.angle + 90) % 360).setLength(this.radius);
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
        this.convex = true;
        this.closed = false;
    }

    lineTo(x, y) {
        if (x instanceof THREE.Vector3) {
            console.assert(typeof y === "undefined", y);
            this.vertices.push(new THREE.Vector2(x.x, x.z));
        } else {
            console.assert(typeof x === "number", x);
            console.assert(typeof y === "number", y);
            this.vertices.push(new THREE.Vector2(x, y));
        }
        // TODO check we are still convex
    }

    closePath() {
        console.assert(!this.closed);
        console.assert(this.vertices.length > 1, this);
        this.vertices.push(this.vertices[0]);
        this.closed = true;
    }

    toShape() {
        console.assert(this.closed);
        const shape = new THREE.Shape();
        shape.moveTo(this.vertices[0].x, this.vertices[0].y);
        for (let i = 1, e = this.vertices.length - 1; i < e; i++) {
            shape.lineTo(this.vertices[i].x, this.vertices[i].y);
        }
        shape.closePath();
        return shape;
    }

    intersects(other) {
        console.assert(this.closed && this.convex);
        console.assert(other instanceof Polygon && other.closed && other.convex, other);
        // use separating axis theorem
        const verticesA = this.vertices, verticesB = other.vertices, axis = new THREE.Vector2();
        for (const vertices of [verticesA, verticesB]) {
            let start = vertices[0];
            for (let i = 1, iEnd = vertices.length; i < iEnd; i++) {
                const end = vertices[i];
                // compute orthogonal axis
                axis.set(end.y - start.y, -(end.x - start.x));
                // project on our own vertices
                let minA = null, maxA = null;
                for (let j = 0, jEnd = verticesA.length - 1; j < jEnd; j++) {
                    const dot = axis.dot(verticesA[j]);
                    minA = minA === null || dot < minA? dot: minA;
                    maxA = maxA === null || dot > maxA? dot: maxA;
                }
                // and project onto the other vertices
                let minB = null, maxB = null;
                for (let j = 0, jEnd = verticesB.length - 1; j < jEnd; j++) {
                    const dot = axis.dot(verticesB[j]);
                    minB = minB === null || dot < minB ? dot : minB;
                    maxB = maxB === null || dot > maxB ? dot : maxB;
                }
                // check if this axis separates them
                if (minA <= maxB && minB <= maxA) {
                    return false;
                }
                // next axis
                start = end;
            }
        }
        // no axis to separate them found
        return true;
    }
}