import * as THREE from 'three';
import { Engine3D, disposeObject } from './3d/engine.js';

// Temporary Wave 1 view exercises the engine independently of T15 assets.
class DemoView {
    constructor() {
        this.root = new THREE.Group();
        this.cameraPreset = { position: [9, 11, 12], target: [0, 0, 0] };
    }

    init(engine) {
        this.engine = engine;
        this.plane = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.3, 8.6), new THREE.MeshStandardMaterial());
        this.plane.position.y = -0.2;
        this.plane.receiveShadow = true;
        this.cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
        this.cube.position.y = 0.5;
        this.cube.castShadow = true;
        this.root.add(this.plane, this.cube);
    }

    update(state, prevState) {
        this.state = state;
        const square = state.selected || state.lastMove?.to;
        const target = square ? new THREE.Vector3((square.col + 0.5) / state.cols * 8 - 4, 0.5,
            (square.row + 0.5) / state.rows * 8 - 4) : new THREE.Vector3(0, 0.5, 0);
        if (state.selected) target.y += 0.2;
        const from = this.cube.position.clone();
        const generation = this.generation = (this.generation || 0) + 1;
        this.engine.animate(prevState ? 350 : 0, t => {
            if (generation !== this.generation) return;
            this.cube.position.lerpVectors(from, target, t);
            if (prevState && state.moveId !== prevState.moveId) this.cube.position.y += Math.sin(Math.PI * t) * 1.2;
        });
        this.cube.material.emissive.set(state.selected ? this.preset.highlight : 0x000000);
        this.cube.material.emissiveIntensity = state.selected ? 0.3 : 0;
        this.engine.requestRender();
    }

    pickSquare(intersection) {
        if (!intersection || !this.state) return null;
        const point = this.root.worldToLocal(intersection.point.clone());
        if (point.x < -4 || point.x >= 4 || point.z < -4 || point.z >= 4) return null;
        return { row: Math.floor((point.z + 4) / 8 * this.state.rows),
            col: Math.floor((point.x + 4) / 8 * this.state.cols) };
    }

    setTheme(preset) {
        this.preset = preset;
        this.plane.material.color.set(preset.board);
        this.cube.material.color.set(preset.piece);
        this.cube.material.roughness = preset.roughness;
        this.cube.material.metalness = preset.metalness;
    }

    dispose() {
        this.generation = (this.generation || 0) + 1;
        disposeObject(this.root);
        this.root.clear();
    }
}

function supportsWebGL() {
    const canvas = document.createElement('canvas');
    try {
        const gl = canvas.getContext('webgl2');
        if (!gl) return false;
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return true;
    } catch { return false; }
}

function start() {
    const query = new URLSearchParams(location.search);
    let savedMode;
    try { savedMode = localStorage.getItem('board-view'); } catch { /* Optional storage. */ }
    if (query.get('view') === '2d' || savedMode === '2d' || !supportsWebGL()) return;
    const wrapper = document.querySelector('.board-wrapper');
    if (!wrapper || !window.gameManager) return;
    const container = document.createElement('div');
    container.id = 'board3d';
    container.style.cssText = 'position:absolute;inset:0;z-index:2;overflow:hidden;border-radius:4px';
    const label = document.createElement('span');
    label.textContent = '3D demo · Kéo để xoay · Cuộn để thu phóng';
    label.style.cssText = 'position:absolute;top:10px;left:10px;right:10px;color:#fff;background:#0009;padding:8px;font:13px system-ui;pointer-events:none;z-index:1;border-radius:4px';
    const previousPosition = wrapper.style.position;
    wrapper.style.position = 'relative';
    wrapper.appendChild(container);
    let engine;
    try { engine = new Engine3D(container, { quality: 'medium' }); }
    catch (error) {
        container.remove();
        wrapper.style.position = previousPosition;
        console.warn('Không thể khởi tạo WebGL, dùng bàn 2D.', error);
        return;
    }
    container.appendChild(label);
    let state, view;
    const update = next => {
        if (next.game !== window.gameManager.gameType) return;
        if (!state || state.game !== next.game) {
            view = new DemoView();
            engine.setView(view);
            state = null;
        }
        view.update(next, state);
        state = next;
        container.setAttribute('aria-label', `Bản xem 3D ${next.game}, lượt ${next.turn}`);
        container.dataset.game = next.game;
    };
    const onState = event => update(event.detail);
    window.addEventListener('game:state', onState);
    const onTheme = () => engine.setTheme(window.themeSwitcher?.currentTheme || 'harry-potter');
    const themeObserver = new MutationObserver(onTheme);
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    onTheme();
    update(window.gameManager.currentGame.getState());
    let pointer;
    const onDown = event => { pointer = { x: event.clientX, y: event.clientY, id: event.pointerId }; };
    const onUp = event => {
        if (!pointer || pointer.id !== event.pointerId || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 5) { pointer = null; return; }
        pointer = null;
        const hit = engine.pick(event.clientX, event.clientY, [view.plane]);
        const square = view.pickSquare(hit);
        if (square) window.gameManager.currentGame.selectSquare(square.row, square.col);
    };
    const onCancel = () => { pointer = null; };
    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onCancel);
    const dispose = () => {
        window.removeEventListener('game:state', onState);
        window.removeEventListener('pagehide', onPageHide);
        container.removeEventListener('pointerdown', onDown);
        container.removeEventListener('pointerup', onUp);
        container.removeEventListener('pointercancel', onCancel);
        themeObserver.disconnect();
        engine.dispose();
        container.remove();
        wrapper.style.position = previousPosition;
    };
    const onPageHide = event => { if (!event.persisted) dispose(); };
    window.addEventListener('pagehide', onPageHide);
    // Expose renderer.info for frame/memory QA and the next integration wave.
    window.board3d = { engine, dispose, get state() { return state; } };
}

// Deferred Vite modules may run while readyState is interactive, before the
// classic controllers' DOMContentLoaded listeners have initialized the manager.
if (document.readyState === 'loading' || !window.gameManager) document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
