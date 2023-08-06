import * as THREE from "three";
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {WallTool} from "./wall_tool.js";

const mousePos = new THREE.Vector2(), mouseRay = new THREE.Raycaster();

class WorldView {
    constructor(world) {
        this.render = this.render.bind(this);

        this.world = world;
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

        this.camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
        this.camera.position.set(7, 10, 8);

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setClearColor("dimgray");
        this.pane.appendChild(this.renderer.domElement);

        const tool_palette = document.createElement("div");
        this.pane.appendChild(tool_palette);
        tool_palette.className = "tool_palette";
        let currentButton = null, currentTool = null;
        const selectTool = (button, tool) => {
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

        const orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        orbitControls.addEventListener('change', this.render.bind(this));
        orbitControls.enabled = false;
        const orbitTool = {
            enable: () => orbitControls.enabled = true,
            disable: () => orbitControls.enabled = false,
        };
        const orbitButton = document.createElement("button");
        orbitButton.innerText = "orbit";
        orbitButton.addEventListener("click", () => selectTool(orbitButton, orbitTool));
        tool_palette.appendChild(orbitButton);

        const wallTool = new WallTool(this);
        const wallButton = document.createElement("button");
        wallButton.innerText = "wall";
        wallButton.addEventListener("click", () => selectTool(wallButton, wallTool));
        tool_palette.appendChild(wallButton);

        orbitButton.click();  // default tool

        document.body.appendChild(this.pane);
        window.addEventListener('resize', this.resize.bind(this));
        this.resize();
    }

    resize() {
        const width = this.pane.clientWidth;
        const height = this.pane.clientHeight;
        this.camera.aspect = width / (height || 1);
        this.camera.updateProjectionMatrix();
        this.pane.style.width = width + "px";
        this.renderer.setSize(width, height);
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