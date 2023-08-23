/* (c) William Edwards 2023 */

import * as THREE from 'three';
import {World} from "./world/world.js";
import {WorldView} from "./world_view/world_view.js";

const deg90 = THREE.MathUtils.degToRad(90);

let _homeBuilderIdSeq = 0;
function generateHomeBuilderId(prefix="?") {
    return prefix + "_" + ++_homeBuilderIdSeq;
}

function pitch_roof(roof_length, roof_width, pitch, thickness) {
    const center_line = roof_width / 2;
    const roof_height = center_line * Math.tan(pitch);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0)
        .lineTo(-thickness * Math.cos(deg90 - pitch), thickness * Math.sin(deg90 - pitch))
        .lineTo(center_line, roof_height + thickness * Math.sin(deg90 - pitch))
        .lineTo(roof_width + thickness * Math.cos(deg90 - pitch), thickness * Math.sin(deg90 - pitch))
        .lineTo(roof_width, 0)
        .lineTo(center_line, roof_height)
        .lineTo(0, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: roof_length,
        bevelEnabled: false
    }).translate(-roof_width / 2, 0, -roof_length / 2);
    const material = new THREE.MeshStandardMaterial({ color: 0x4040c0 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.homebuilderId = generateHomeBuilderId("pitch_roof");
    return [mesh,
        new THREE.LineSegments(new THREE.EdgesGeometry(geometry),
            new THREE.LineBasicMaterial({ color: 0xffffff }))];
}

function init() {
    new WorldView(new World());
}
init();