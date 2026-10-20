import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TweenGroup } from './tween.js';
import { fitBoardCamera } from './camera-fit.js';

// Engine defaults keep the Wave 1 demo independent of the parallel assets task.
// Integrating views may register richer asset presets with Engine3D.themes.
const themes = {
    'harry-potter': { background: 0x100d20, fog: 0x100d20, light: 0xffdfab, intensity: 3,
        board: 0x6f371c, piece: 0xffd34e, roughness: 0.3, metalness: 0.45, highlight: 0x66ffce },
    greek: { background: 0xcbd3df, fog: 0xcbd3df, light: 0xfff3de, intensity: 3,
        board: 0xabb8c8, piece: 0xffeed0, roughness: 0.4, metalness: 0.15, highlight: 0xd5a448 },
    cyber: { background: 0x040f22, fog: 0x040f22, light: 0x8adfff, intensity: 4,
        board: 0x092c48, piece: 0x27eaff, roughness: 0.22, metalness: 0.65, highlight: 0xff3de2 },
    vampire: { background: 0x130710, fog: 0x130710, light: 0xffa3b7, intensity: 3,
        board: 0x321320, piece: 0xc12245, roughness: 0.3, metalness: 0.5, highlight: 0xffc3c3 }
};

// Dispose each shared GPU resource once, including material texture slots and uniforms.
export function disposeObject(root) {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    root.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (!material) continue;
            materials.add(material);
            for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
            for (const uniform of Object.values(material.uniforms || {})) {
                if (uniform.value?.isTexture) textures.add(uniform.value);
            }
        }
    });
    geometries.forEach(geometry => geometry.dispose());
    textures.forEach(texture => texture.dispose());
    materials.forEach(material => material.dispose());
}

export class Engine3D {
    static themes = themes;

    constructor(container, { quality = 'medium' } = {}) {
        this.container = container;
        this.disposed = false;
        this.frame = null;
        this.lastTime = null;
        this.dirty = true;
        this.tweens = new TweenGroup();
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
        this.camera.position.set(9, 11, 12);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
        this.renderer.domElement.setAttribute('aria-label', 'Bàn cờ 3D — kéo để xoay, cuộn để thu phóng');
        this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost = event => {
            event.preventDefault();
            this.contextLost = true;
            this.stopFrame();
        });
        this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored = () => {
            this.contextLost = false;
            this.requestRender();
        });
        container.appendChild(this.renderer.domElement);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.12;
        this.controls.enablePan = false;
        this.controls.minDistance = 7;
        this.controls.maxDistance = 28;
        this.controls.minPolarAngle = Math.PI / 10;
        this.controls.maxPolarAngle = Math.PI / 2.25;
        this.controls.addEventListener('change', this.onControlsChange = () => this.requestRender());
        this.controls.addEventListener('start', this.onControlsStart = () => {
            // Direct input takes ownership from an in-flight camera transition.
            if (this.cameraFlight) this.cameraFlight.cancelled = true;
        });

        this.light = new THREE.DirectionalLight(0xffffff, 3);
        this.light.position.set(4, 10, 6);
        this.light.shadow.mapSize.set(1024, 1024);
        Object.assign(this.light.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 35 });
        this.light.shadow.bias = -0.0005;
        this.scene.add(this.light, new THREE.HemisphereLight(0xffffff, 0x283040, 1));
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        const room = new RoomEnvironment();
        this.environment = pmrem.fromScene(room, 0.04);
        this.scene.environment = this.environment.texture;
        room.dispose();
        pmrem.dispose();

        this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.motionQuery.addEventListener('change', this.onMotionChange = () => this.syncMotion());
        this.effectObserver = new MutationObserver(() => this.syncMotion());
        this.effectObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        this.syncMotion();
        document.addEventListener('visibilitychange', this.onVisibility = () => {
            this.lastTime = null;
            if (document.hidden) this.stopFrame();
            else this.requestRender();
        });
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(container);
        window.addEventListener('resize', this.onResize = () => this.resize());
        this.setQuality(quality);
        this.setTheme('harry-potter');
        this.resize();
    }

    syncMotion() {
        this.motionEnabled = !this.motionQuery.matches && !document.body.classList.contains('effects-disabled');
        this.controls.enableDamping = this.motionEnabled;
        if (!this.motionEnabled) this.tweens.finish();
        this.requestRender();
    }

    resize() {
        if (this.disposed) return;
        const { width, height } = this.container.getBoundingClientRect();
        if (width <= 0 || height <= 0) { this.hasSize = false; this.stopFrame(); return; }
        this.hasSize = true;
        const changed = this.width !== width || this.height !== height;
        this.width = width;
        this.height = height;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height, false);
        if (changed && this.view?.cameraBounds) {
            const flying = this.cameraFlight && !this.cameraFlight.cancelled && !this.cameraFlight.finished;
            const current = flying ? { ...this.view.cameraPreset, position: this.view.cameraPreset.position.map((value, i) =>
                this.view.state?.flipped && i !== 1 ? -value : value) }
                : { position: this.camera.position.toArray(), target: this.controls.target.toArray() };
            if (this.cameraFlight) this.cameraFlight.cancelled = true;
            this.fitViewCamera();
            const fitted = fitBoardCamera(this.camera, this.view.cameraBounds, current);
            this.camera.position.fromArray(fitted.position);
            this.controls.target.fromArray(fitted.target);
            this.controls.update();
        }
        this.requestRender();
    }

    fitViewCamera() {
        const view = this.view;
        view.baseCameraPreset ||= view.cameraPreset;
        view.cameraPreset = fitBoardCamera(this.camera, view.cameraBounds, view.baseCameraPreset);
        this.controls.maxDistance = Math.max(28, new THREE.Vector3(...view.cameraPreset.position).length() * 2);
    }

    setQuality(level) {
        if (this.disposed) return;
        this.quality = ['low', 'medium', 'high'].includes(level) ? level : 'medium';
        const maxRatio = { low: 1, medium: 1.5, high: 2 }[this.quality];
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
        this.renderer.shadowMap.enabled = this.quality === 'high';
        this.light.castShadow = this.quality === 'high';
        // Release a previously allocated shadow map when lowering quality.
        if (this.quality !== 'high' && this.light.shadow.map) {
            this.light.shadow.map.dispose();
            this.light.shadow.map = null;
        }
        this.scene.traverse(object => {
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                if (material) material.needsUpdate = true;
            }
        });
        this.resize();
    }

    setTheme(themeId) {
        if (this.disposed) return;
        this.themeId = Engine3D.themes[themeId] ? themeId : 'harry-potter';
        this.preset = Engine3D.themes[this.themeId];
        this.scene.background = new THREE.Color(this.preset.background);
        this.scene.fog = new THREE.Fog(this.preset.fog, 25, 65);
        this.light.color.set(this.preset.light);
        this.light.intensity = this.preset.intensity;
        this.view?.setTheme(this.preset);
        this.resize();
        this.requestRender();
    }

    setView(view) {
        if (this.disposed || view === this.view) return;
        this.tweens.cancel();
        if (this.view) {
            this.scene.remove(this.view.root);
            this.view.dispose();
        }
        this.view = view;
        if (!view) { this.requestRender(); return; }
        view.init(this);
        if (view.root && view.root.parent !== this.scene) this.scene.add(view.root);
        view.setTheme(this.preset);
        if (view.cameraPreset) {
            view.cameraBounds = new THREE.Box3().setFromObject(view.boardAsset?.group || view.root);
            // Include tall pieces and selected-piece lift before the first state arrives.
            view.cameraBounds.max.y = Math.max(view.cameraBounds.max.y, view.root.name === 'chess-view' ? 2 : 0.5);
            this.fitViewCamera();
        }
        const preset = view.cameraPreset;
        if (preset) {
            const fromPosition = this.camera.position.clone(), fromTarget = this.controls.target.clone();
            const position = new THREE.Vector3(...preset.position), target = new THREE.Vector3(...preset.target);
            const flight = this.cameraFlight = { cancelled: false };
            this.animate(450, t => {
                if (flight.cancelled) return;
                this.camera.position.lerpVectors(fromPosition, position, t);
                this.controls.target.lerpVectors(fromTarget, target, t);
                this.controls.update();
                if (t === 1) flight.finished = true;
            });
        }
        this.requestRender();
    }

    requestRender() {
        if (this.disposed) return;
        this.dirty = true;
        if (this.frame !== null || document.hidden || this.contextLost || !this.hasSize) return;
        this.frame = requestAnimationFrame(time => this.renderFrame(time));
    }

    renderFrame(time) {
        this.frame = null;
        if (this.disposed || document.hidden || this.contextLost || !this.hasSize) return;
        const delta = this.lastTime === null ? 0 : time - this.lastTime;
        this.lastTime = time;
        this.dirty = false;
        this.tweens.update(delta);
        const controlsChanged = this.controls.update();
        this.renderer.render(this.scene, this.camera);
        if (this.tweens.active || controlsChanged || this.dirty) this.requestRender();
        else this.lastTime = null;
    }

    animate(durationMs, onUpdate, easing) {
        if (this.disposed) return Promise.resolve(false);
        const promise = this.tweens.add(this.motionEnabled ? durationMs : 0, onUpdate, easing);
        this.requestRender();
        return promise;
    }

    pick(clientX, clientY, objects) {
        if (this.disposed) return null;
        const rect = this.renderer.domElement.getBoundingClientRect();
        if (!rect.width || !rect.height || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
        const point = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
        this.scene.updateMatrixWorld(true);
        this.camera.updateMatrixWorld(true);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(point, this.camera);
        return ray.intersectObjects(objects, true)[0] || null;
    }

    stopFrame() {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.lastTime = null;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.stopFrame();
        this.tweens.cancel();
        this.resizeObserver.disconnect();
        window.removeEventListener('resize', this.onResize);
        this.effectObserver.disconnect();
        this.motionQuery.removeEventListener('change', this.onMotionChange);
        document.removeEventListener('visibilitychange', this.onVisibility);
        this.controls.removeEventListener('change', this.onControlsChange);
        this.controls.removeEventListener('start', this.onControlsStart);
        this.controls.dispose();
        this.view?.dispose();
        this.view = null;
        disposeObject(this.scene);
        this.scene.clear();
        this.scene.environment = null;
        this.environment.dispose();
        this.light.shadow.dispose();
        const canvas = this.renderer.domElement;
        canvas.removeEventListener('webglcontextlost', this.onContextLost);
        canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
        this.renderer.renderLists.dispose();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        canvas.remove();
    }
}
