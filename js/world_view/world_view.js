/* (c) William Edwards 2023
  Licensed under the AGPLv3; see LICENSE for details */

import * as THREE from "three";
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls';
import {CSS2DRenderer} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import {WallTool} from "./wall_tool.js";
import {SelectTool} from "./select_tool.js";

const mousePos = new THREE.Vector2(), mouseRay = new THREE.Raycaster();

class WorldView {
    constructor(world) {
        this.render = this.render.bind(this);

        this.world = world;
        this.world.views.push(this);

        this.pane = document.createElement("div");
        this.pane.className = "world_view_pane";
        this.pane.style.width = "100%";
        this.pane.style.height = "100%";

        this.scene = new THREE.Scene();
        this.scene.add(world.scene);  // nested scene of world

        this.scene.add(new THREE.AxesHelper(5));
        this.scene.add(new THREE.GridHelper(20, 20));

        this.light = new THREE.DirectionalLight('white', 8);
        this.scene.add(this.light);

        this.perspectiveCamera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
        this.perspectiveCamera.position.set(7, 10, 8);
        this.orthographicCameraPlan = new THREE.OrthographicCamera();
        this.orthographicCameraPlan.position.setY(100);  // plan view looking down
        this.orthographicCameras = [this.orthographicCameraPlan];
        this.cameras = [this.perspectiveCamera, ...this.orthographicCameras];
        this.camera = this.orthographicCameraPlan;

        // create renderers

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setClearColor("dimgray");
        this.pane.appendChild(this.renderer.domElement);

        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.domElement.className = "label_renderer";
        this.pane.appendChild(this.labelRenderer.domElement);

        document.body.appendChild(this.pane);

        // create tool palette
        const tool_palette = document.createElement("div");
        this.pane.appendChild(tool_palette);
        tool_palette.className = "tool_palette";
        let currentButton = null, currentTool = null;
        const changeTool = (button, tool) => {
            if (currentButton) {
                currentButton.style.backgroundColor = null;
            }
            currentButton = button;
            currentButton.style.backgroundColor = "white";
            if (currentTool) {
                currentTool.disable();
            }
            currentTool = tool;
            tool.enable();
        }

        const selectTool = new SelectTool(this);
        const selectButton = document.createElement("button");
        selectButton.textContent = "select";
        selectButton.addEventListener("click", () => changeTool(selectButton, selectTool));
        tool_palette.appendChild(selectButton);

        const orbitControls = {};
        for (const camera of this.cameras) {
            const orbitControl = new OrbitControls(camera, this.renderer.domElement);
            orbitControl.addEventListener('change', this.render);
            if (camera === this.orthographicCameraPlan) {
                orbitControl.minPolarAngle = Math.PI;
                orbitControl.maxPolarAngle = Math.PI;
            }
            orbitControl.enabled = false;
            orbitControl.update();
            orbitControls[this.camera.uuid] = orbitControl;
        }
        const orbitTool = {
            enable: () => orbitControls[this.camera.uuid].enabled = true,
            disable: () => orbitControls[this.camera.uuid].enabled = false,
        };
        const orbitButton = document.createElement("button");
        orbitButton.textContent = "orbit";
        orbitButton.addEventListener("click", () => changeTool(orbitButton, orbitTool));
        tool_palette.appendChild(orbitButton);

        const wallTool = new WallTool(this);
        const wallButton = document.createElement("button");
        wallButton.textContent = "wall";
        wallButton.addEventListener("click", () => changeTool(wallButton, wallTool));
        tool_palette.appendChild(wallButton);

        wallButton.click();  // default tool

        window.addEventListener('resize', this.resize.bind(this));
        this.resize();
    }

    resize() {
        const width = this.pane.offsetWidth;
        const height = this.pane.offsetHeight;
        this.perspectiveCamera.aspect = width / (height || 1);
        this.perspectiveCamera.updateProjectionMatrix();
        const camFactor = 100;
        for (const orthographicCamera of this.orthographicCameras) {
            orthographicCamera.left = -width / camFactor;
            orthographicCamera.right = width / camFactor;
            orthographicCamera.top = height / camFactor;
            orthographicCamera.bottom = -height / camFactor;
            orthographicCamera.updateProjectionMatrix();
        }
        this.pane.style.width = width + "px";
        this.renderer.setSize(width, height);
        this.labelRenderer.setSize(width, height);
        this.needsUpdate();
    }

    needsUpdate() {
        if (!this.animationFrameRequested) {
            window.requestAnimationFrame(this.render);
            this.animationFrameRequested = true;
        }
    }

    render() {
        this.animationFrameRequested = false;
        this.light.position.copy(this.camera.position);
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }

    getMouseRay(mouseEvent) {
        const targetRect = mouseEvent.target.getBoundingClientRect();
        mousePos.setX(((mouseEvent.clientX - targetRect.left) / targetRect.width) * 2 - 1);
        mousePos.setY(-((mouseEvent.clientY - targetRect.top) / targetRect.height) * 2 + 1);
        mouseRay.setFromCamera(mousePos, this.camera);
        return mouseRay;
    }
}

export {WorldView};