// No static 3D imports: 2D never downloads the renderer or Three.js.
let runtimePromise;
function loadRuntime() {
    if (!runtimePromise) {
        runtimePromise = Promise.all([
            import('./3d/engine.js'),
            import('three').then(({ Group, Mesh, BoxGeometry, MeshStandardMaterial, Vector3, TOUCH }) =>
                ({ Group, Mesh, BoxGeometry, MeshStandardMaterial, Vector3, TOUCH }))
        ]).then(([engine, THREE]) => ({ ...engine, THREE }))
            .catch(error => { runtimePromise = null; throw error; });
    }
    return runtimePromise;
}

// Vite discovers future views without importing them until their game is shown.
// Export names follow the common board-view contract; missing views use the demo.
const viewModules = import.meta.glob('./3d/views/*View.js');
export const viewRegistry = {
    chess: { module: './3d/views/chessView.js', exportName: 'ChessView' },
    xiangqi: { module: './3d/views/xiangqiView.js', exportName: 'XiangqiView' },
    xo: { module: './3d/views/xoView.js', exportName: 'XOView' }
};

function createDemoClass(THREE, disposeObject) {
    // Temporary Wave 1 view exercises the engine independently of T15 assets.
    return class DemoView {
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
    };
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

function readPreference(key, fallback) {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function savePreference(key, value) {
    try { localStorage.setItem(key, value); } catch { /* Optional storage. */ }
}

function start() {
    const container = document.getElementById('board3d');
    const loading = document.getElementById('board3d-loading');
    const message = document.getElementById('board-view-message');
    const announcement = document.getElementById('board3d-announcement');
    const help = document.getElementById('board3d-help');
    const buttons = { '2d': document.getElementById('board-view-2d'), '3d': document.getElementById('board-view-3d') };
    const qualitySelect = document.getElementById('board-quality');
    let engine = null, runtime, DemoView, view, viewGame, state;
    let desiredMode = '2d', activationId = 0, viewId = 0, lastAnnouncement;
    const pointers = new Map();
    let multiTouch = false;
    let quality = readPreference('board-quality', 'medium');
    if (!['low', 'medium', 'high'].includes(quality)) quality = 'medium';
    qualitySelect.value = quality;
    document.body.classList.add('has-board-view-ui');

    const setLoading = value => {
        loading.hidden = !value;
        container.setAttribute('aria-busy', String(value));
    };
    const showMessage = text => {
        message.textContent = text;
        message.hidden = !text;
    };
    const updateControls = () => {
        for (const [mode, button] of Object.entries(buttons)) button.setAttribute('aria-pressed', String(desiredMode === mode));
        qualitySelect.disabled = desiredMode !== '3d';
    };
    const announce = next => {
        const key = `${next.game}:${next.moveId}`;
        if (key === lastAnnouncement) return;
        lastAnnouncement = key;
        const names = { chess: 'Cờ vua', xiangqi: 'Cờ tướng', xo: 'Cờ Caro' };
        const turns = { white: 'Trắng', black: 'Đen', red: 'Đỏ', X: 'X', O: 'O' };
        const move = next.lastMove?.to;
        announcement.textContent = `${names[next.game]}. ${move ? `Nước cuối: hàng ${move.row + 1}, cột ${move.col + 1}.` : 'Ván mới.'} ${next.gameOver ? 'Ván đấu kết thúc.' : `Lượt ${turns[next.turn]}.`}`;
    };
    const removeRenderer = () => {
        viewId++;
        pointers.clear();
        multiTouch = false;
        engine?.dispose();
        engine = null;
        view = null;
        state = null;
        viewGame = null;
        document.body.classList.remove('board3d-active');
        container.hidden = true;
        setLoading(false);
    };
    const fallback = (text, id) => {
        if (id !== activationId) return;
        desiredMode = '2d';
        removeRenderer();
        updateControls();
        showMessage(text);
    };
    const syncTheme = () => {
        if (engine) engine.setTheme(window.themeSwitcher?.currentTheme || 'harry-potter');
    };
    const update = async next => {
        if (next.game !== window.gameManager.gameType) return;
        announce(next);
        if (!engine || desiredMode !== '3d') return;
        const currentEngine = engine;
        if (viewGame !== next.game) {
            const id = ++viewId;
            setLoading(true);
            const registration = viewRegistry[next.game];
            const loader = registration && viewModules[registration.module];
            const module = loader ? await loader() : null;
            if (id !== viewId || engine !== currentEngine || desiredMode !== '3d') return;
            const View = module ? module[registration.exportName] : DemoView;
            if (typeof View !== 'function') throw new Error('Board view export is missing');
            view = new View();
            engine.setView(view);
            viewGame = next.game;
            state = null;
            // A newer state may have arrived while a view module was loading.
            next = window.gameManager.currentGame.getState();
            help.textContent = module ? 'Chạm để chọn · Kéo hai ngón để xoay · Cuộn để thu phóng'
                : 'Bản xem 3D thử nghiệm · Chọn 2D để xem đầy đủ quân cờ';
        }
        view.update(next, state);
        state = next;
        container.dataset.game = next.game;
        container.setAttribute('aria-label', `Bàn 3D, lượt ${next.turn}`);
        document.body.classList.add('board3d-active');
        setLoading(false);
        engine.requestRender();
    };
    const activate = async (mode, persist = true) => {
        const id = ++activationId;
        desiredMode = mode;
        if (persist) savePreference('board-view', mode);
        updateControls();
        showMessage('');
        if (mode === '2d') { removeRenderer(); return; }
        if (engine) return;
        if (!supportsWebGL()) {
            fallback('Thiết bị chưa hỗ trợ WebGL 2. Bạn có thể tiếp tục chơi trên bàn 2D.', id);
            return;
        }
        container.hidden = false;
        setLoading(true);
        try {
            runtime = await loadRuntime();
            if (id !== activationId || desiredMode !== '3d') return;
            DemoView = createDemoClass(runtime.THREE, runtime.disposeObject);
            engine = new runtime.Engine3D(container, { quality });
            // One finger selects; two fingers orbit/zoom. Mouse drag still orbits.
            engine.controls.touches.ONE = null;
            engine.controls.touches.TWO = runtime.THREE.TOUCH.DOLLY_ROTATE;
            engine.renderer.domElement.tabIndex = 0;
            engine.renderer.domElement.setAttribute('aria-describedby', 'board3d-help');
            syncTheme();
            await update(window.gameManager.currentGame.getState());
        } catch (error) {
            console.warn('Không thể tải bàn 3D.', error);
            fallback('Không thể tải bàn 3D. Hãy kiểm tra kết nối và thử lại; bàn 2D vẫn sẵn sàng.', id);
        }
    };

    const onState = event => {
        const id = activationId;
        update(event.detail).catch(error => {
            console.warn('Không thể hiển thị bàn 3D.', error);
            fallback('Không thể hiển thị bàn 3D; đã trở về bàn 2D.', id);
        });
    };
    window.addEventListener('game:state', onState);
    const themeObserver = new MutationObserver(syncTheme);
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const onQuality = () => {
        quality = qualitySelect.value;
        savePreference('board-quality', quality);
        engine?.setQuality(quality);
    };
    qualitySelect.addEventListener('change', onQuality);
    const on2D = () => activate('2d');
    const on3D = () => activate('3d');
    buttons['2d'].addEventListener('click', on2D);
    buttons['3d'].addEventListener('click', on3D);

    const onDown = event => {
        if (!engine || event.target !== engine.renderer.domElement) return;
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size > 1) multiTouch = true;
    };
    const onUp = event => {
        const pointer = pointers.get(event.pointerId), wasMultiTouch = multiTouch;
        pointers.delete(event.pointerId);
        if (!pointers.size) multiTouch = false;
        if (!pointer || wasMultiTouch || !engine || !view || !loading.hidden
            || Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 5) return;
        const hit = engine.pick(event.clientX, event.clientY, view.pickObjects || [view.root]);
        const square = view.pickSquare(hit);
        if (square) window.gameManager.currentGame.selectSquare(square.row, square.col);
    };
    const onCancel = event => { pointers.delete(event.pointerId); if (!pointers.size) multiTouch = false; };
    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointerup', onUp);
    container.addEventListener('pointercancel', onCancel);
    const dispose = () => {
        activationId++;
        removeRenderer();
        themeObserver.disconnect();
        window.removeEventListener('game:state', onState);
        window.removeEventListener('pagehide', onPageHide);
        qualitySelect.removeEventListener('change', onQuality);
        buttons['2d'].removeEventListener('click', on2D);
        buttons['3d'].removeEventListener('click', on3D);
        container.removeEventListener('pointerdown', onDown);
        container.removeEventListener('pointerup', onUp);
        container.removeEventListener('pointercancel', onCancel);
    };
    const onPageHide = event => { if (!event.persisted) dispose(); };
    window.addEventListener('pagehide', onPageHide);
    // Debug/QA surface also gives future view integration one registry to extend.
    window.board3d = { get engine() { return engine; }, get state() { return state; },
        registry: viewRegistry, setMode: activate, dispose };
    const queryMode = new URLSearchParams(location.search).get('view');
    const initialMode = queryMode || readPreference('board-view', '2d');
    announce(window.gameManager.currentGame.getState());
    activate(initialMode === '3d' ? '3d' : '2d', false);
}

// Deferred modules can run before classic DOMContentLoaded controllers initialize.
if (document.readyState === 'loading' || !window.gameManager) document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
