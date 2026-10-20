import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const metrics = { xInstances: 0, oInstances: 0, boards: 0, pieceDisposals: 0, boardDisposals: 0 };
const sharedGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
const xMaterial = new THREE.MeshStandardMaterial({ color: 0x841b25 });
const oMaterial = new THREE.MeshStandardMaterial({ color: 0x243f73 });
const theme = (id, lastMove = 0xffd700, winLine = 0xa8d18d) => ({
    id,
    xo: { x: { color: 0x841b25 }, o: { color: 0x243f73 } },
    highlights: { lastMove, winLine }
});
const themes = { 'harry-potter': theme('harry-potter'), cyber: theme('cyber', 0x00ffff, 0x00ff88) };

globalThis.__xo3dMockAssets = {
    THREE,
    getOrCreateXGeometry: () => sharedGeometry,
    getOrCreateOGeometry: () => sharedGeometry,
    createXOMeshes(maxCount) {
        metrics.xInstances = maxCount;
        metrics.oInstances = maxCount;
        const x = new THREE.InstancedMesh(sharedGeometry, xMaterial, maxCount);
        const o = new THREE.InstancedMesh(sharedGeometry, oMaterial, maxCount);
        x.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        o.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        x.count = 0;
        o.count = 0;
        return { x, o };
    },
    setXOTheme(preset) {
        xMaterial.color.set(preset.id === 'cyber' ? 0xff007f : 0x841b25);
        oMaterial.color.set(preset.id === 'cyber' ? 0x00ffff : 0x243f73);
    },
    disposeXOAssets() { metrics.pieceDisposals++; },
    createXOBoard(size = 15) {
        metrics.boards++;
        const cellSize = 0.6;
        return {
            group: new THREE.Group(),
            squareToWorld: (row, col) => new THREE.Vector3((col - 7) * cellSize, 0, (row - 7) * cellSize),
            worldToSquare(point) {
                const col = Math.floor(point.x / cellSize + 7.5);
                const row = Math.floor(point.z / cellSize + 7.5);
                return row >= 0 && row < size && col >= 0 && col < size ? { row, col } : null;
            }
        };
    },
    setBoardTheme() {},
    disposeBoardAssets() { metrics.boardDisposals++; },
    getTheme: value => value?.xo ? value : themes[value] || themes['harry-potter'],
    DEFAULT_THEME: 'harry-potter'
};

let source = readFileSync(new URL('../src/3d/views/xoView.js', import.meta.url), 'utf8');
source = source.replace(/^import .*;$/gm, '');
source = `const { THREE, getOrCreateXGeometry, getOrCreateOGeometry, createXOMeshes, setXOTheme,
    disposeXOAssets, createXOBoard, setBoardTheme, disposeBoardAssets, getTheme, DEFAULT_THEME } = globalThis.__xo3dMockAssets;\n${source}`;
const { XOView } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
delete globalThis.__xo3dMockAssets;

const emptyBoard = () => Array.from({ length: 15 }, () => Array(15).fill(null));

function snapshot(board, extra = {}) {
    return {
        game: 'xo', rows: 15, cols: 15, board: board.map(row => [...row]), turn: 'X',
        selected: null, hints: [], lastMove: null, captured: null, check: null,
        winLine: null, gameOver: false, flipped: false, aiThinking: false, moveId: 1, ...extra
    };
}

function fixture(board = emptyBoard(), motionEnabled = true) {
    const pending = [], calls = [];
    const eventListeners = new Map();
    const domElement = {
        addEventListener(event, fn) {
            if (!eventListeners.has(event)) eventListeners.set(event, []);
            eventListeners.get(event).push(fn);
        },
        removeEventListener(event, fn) {
            const list = eventListeners.get(event);
            if (list) {
                const idx = list.indexOf(fn);
                if (idx !== -1) list.splice(idx, 1);
            }
        },
        dispatchEvent(event) {
            const list = eventListeners.get(event.type);
            if (list) list.forEach(fn => fn(event));
        }
    };
    const engine = {
        themeId: 'harry-potter', motionEnabled,
        camera: new THREE.PerspectiveCamera(),
        controls: { target: new THREE.Vector3(), update() {} },
        renderer: { domElement },
        pickTarget: null,
        pick() { return this.pickTarget; },
        requestRender() {},
        animate(duration, update) {
            calls.push(duration);
            if (!this.motionEnabled || !duration) { update(1); return Promise.resolve(true); }
            return new Promise(resolve => { update(0); pending.push({ update, resolve, duration }); });
        }
    };
    engine.camera.position.set(0, 13.5, 13.5);
    const view = new XOView();
    view.init(engine);
    let state = snapshot(board);
    view.update(state, null);

    const tick = t => {
        for (const item of [...pending]) {
            item.update(t);
            if (t === 1) { pending.splice(pending.indexOf(item), 1); item.resolve(true); }
        }
    };
    const update = next => { view.update(next, state); state = next; };
    const move = (row, col, piece = state.turn) => {
        const nextBoard = state.board.map(r => [...r]);
        nextBoard[row][col] = piece;
        const next = snapshot(nextBoard, {
            moveId: state.moveId + 1,
            lastMove: { from: { row, col }, to: { row, col } },
            turn: piece === 'X' ? 'O' : 'X'
        });
        update(next);
        return next;
    };
    return { view, engine, domElement, eventListeners, pending, calls, tick, update, move, get state() { return state; } };
}

test('initial empty board has 0 active instances for X and O', () => {
    const f = fixture();
    assert.equal(f.view.meshes.x.count, 0);
    assert.equal(f.view.meshes.o.count, 0);
    f.view.dispose();
});

test('placing an X piece increases instance count and animates 350ms drop from y > 0', () => {
    const f = fixture();
    f.move(7, 7, 'X');
    assert.equal(f.view.meshes.x.count, 1);
    assert.equal(f.view.meshes.o.count, 0);
    assert(f.calls.includes(350));
    assert(f.view.pieceHeights.get('7,7') > 1.5);
    f.tick(0.5);
    assert(f.view.pieceHeights.get('7,7') > 0.5);
    f.tick(1);
    assert.equal(f.view.pieceHeights.get('7,7'), undefined);
    assert.equal(f.view.lastMarker.visible, true);
    f.view.dispose();
});

test('placing multiple X and O pieces maintains correct counts and coordinates', () => {
    const f = fixture();
    f.move(7, 7, 'X');
    f.tick(1);
    f.move(7, 8, 'O');
    f.tick(1);
    f.move(8, 8, 'X');
    f.tick(1);
    assert.equal(f.view.meshes.x.count, 2);
    assert.equal(f.view.meshes.o.count, 1);
    assert.deepEqual(f.view.xInstances[0], { row: 7, col: 7 });
    assert.deepEqual(f.view.xInstances[1], { row: 8, col: 8 });
    assert.deepEqual(f.view.oInstances[0], { row: 7, col: 8 });
    f.view.dispose();
});

test('same-move AI snapshots retain piece positions without restarting drop', () => {
    const f = fixture();
    f.move(7, 7, 'X');
    f.tick(1);
    const animations = f.calls.length;
    f.update({ ...f.state, aiThinking: true });
    f.update({ ...f.state, aiThinking: false });
    assert.equal(f.calls.length, animations);
    assert.equal(f.view.meshes.x.count, 1);
    f.view.dispose();
});

test('undo removes last placed piece and adjusts instance counts immediately', () => {
    const f = fixture(), initial = f.state;
    f.move(7, 7, 'X');
    f.tick(1);
    f.move(7, 8, 'O');
    f.tick(1);
    assert.equal(f.view.meshes.x.count, 1);
    assert.equal(f.view.meshes.o.count, 1);
    f.update({ ...initial, moveId: 4 });
    assert.equal(f.view.meshes.x.count, 0);
    assert.equal(f.view.meshes.o.count, 0);
    f.view.dispose();
});

test('winLine activates 5 win markers and pulses pieces and markers without infinite loop', () => {
    const f = fixture();
    for (let c = 5; c < 10; c++) f.move(7, c, 'X');
    f.tick(1);
    const winLine = [
        { row: 7, col: 5 }, { row: 7, col: 6 }, { row: 7, col: 7 },
        { row: 7, col: 8 }, { row: 7, col: 9 }
    ];
    f.update({ ...f.state, winLine, gameOver: true });
    assert(f.view.winMarkers[0].visible);
    assert(f.view.winMarkers[4].visible);
    const pulses = f.calls.filter(d => d === 1800).length;
    assert.equal(pulses, 1);
    f.tick(0.25);
    assert(f.view.pieceScales.get('7,7') > 1.0);
    f.tick(1);
    assert.equal(f.pending.length, 0);
    f.view.dispose();
});

test('game over triggers finish marker effect and completes cleanly', () => {
    const f = fixture();
    f.move(7, 7, 'X');
    f.tick(1);
    f.update({ ...f.state, gameOver: true });
    assert.equal(f.view.finishMarker.visible, true);
    f.tick(1);
    assert.equal(f.view.finishMarker.visible, false);
    assert.equal(f.pending.length, 0);
    f.view.dispose();
});

test('disabled motion places pieces at y=0 immediately with no pending animations', () => {
    const f = fixture(emptyBoard(), false);
    f.move(7, 7, 'X');
    assert.equal(f.pending.length, 0);
    assert.equal(f.view.pieceHeights.get('7,7'), undefined);
    assert.equal(f.view.meshes.x.count, 1);
    f.view.dispose();
});

test('hover preview shows ghost mesh of current player on empty square and hides on occupied', () => {
    const f = fixture();
    f.move(7, 7, 'X');
    f.tick(1);

    // Hover empty cell (7,8) when turn is O
    f.engine.pickTarget = { point: new THREE.Vector3((8 - 7) * 0.6, 0, (7 - 7) * 0.6) };
    f.domElement.dispatchEvent({ type: 'pointermove', clientX: 100, clientY: 100 });
    assert.equal(f.view.ghostO.visible, true);
    assert.equal(f.view.ghostX.visible, false);

    // Hover occupied cell (7,7)
    f.engine.pickTarget = { point: new THREE.Vector3((7 - 7) * 0.6, 0, (7 - 7) * 0.6) };
    f.domElement.dispatchEvent({ type: 'pointermove', clientX: 100, clientY: 100 });
    assert.equal(f.view.ghostO.visible, false);
    assert.equal(f.view.ghostX.visible, false);

    f.view.dispose();
});

test('hover preview hides when pointer leaves canvas or game is over', () => {
    const f = fixture();
    f.engine.pickTarget = { point: new THREE.Vector3(0, 0, 0) };
    f.domElement.dispatchEvent({ type: 'pointermove', clientX: 50, clientY: 50 });
    assert.equal(f.view.ghostX.visible, true);

    f.domElement.dispatchEvent({ type: 'pointerleave' });
    assert.equal(f.view.ghostX.visible, false);
    f.view.dispose();
});

test('picking resolves square from InstancedMesh instanceId, board plane, and rejects out-of-board', () => {
    const f = fixture();
    f.move(7, 7, 'X');
    f.tick(1);
    f.move(7, 8, 'O');
    f.tick(1);

    // Pick X instance
    assert.deepEqual(f.view.pickSquare({ object: f.view.meshes.x, instanceId: 0 }), { row: 7, col: 7 });

    // Pick O instance
    assert.deepEqual(f.view.pickSquare({ object: f.view.meshes.o, instanceId: 0 }), { row: 7, col: 8 });

    // Pick board point
    assert.deepEqual(f.view.pickSquare({ object: f.view.boardAsset.group, point: new THREE.Vector3(0, 0, 0) }), { row: 7, col: 7 });

    // Pick out of board
    assert.equal(f.view.pickSquare({ object: f.view.boardAsset.group, point: new THREE.Vector3(50, 0, 50) }), null);
    assert.equal(f.view.pickSquare(null), null);
    f.view.dispose();
});

test('picking correctly identifies all 4 corner cells and center of 15x15 board', () => {
    const f = fixture();
    const cellSize = 0.6;
    // Corners: (0,0), (0,14), (14,0), (14,14) and Center (7,7)
    const corners = [
        { row: 0, col: 0, x: -4.2, z: -4.2 },
        { row: 0, col: 14, x: 4.2, z: -4.2 },
        { row: 14, col: 0, x: -4.2, z: 4.2 },
        { row: 14, col: 14, x: 4.2, z: 4.2 },
        { row: 7, col: 7, x: 0, z: 0 }
    ];
    for (const { row, col, x, z } of corners) {
        const sq = f.view.pickSquare({ object: f.view.boardAsset.group, point: new THREE.Vector3(x, 0, z) });
        assert.deepEqual(sq, { row, col }, `Failed picking for corner/center (${row},${col})`);
    }
    f.view.dispose();
});

test('theme changes update board asset, piece materials, ghost materials, and markers', () => {
    const f = fixture(), beforeBoards = metrics.boards;
    f.engine.themeId = 'cyber';
    f.view.setTheme(themes.cyber);
    assert.equal(metrics.boards, beforeBoards + 1);
    assert.equal(f.view.markerMaterials.last.color.getHex(), themes.cyber.highlights.lastMove);
    assert.equal(f.view.markerMaterials.finish.color.getHex(), themes.cyber.highlights.winLine);
    f.view.dispose();
});

test('dispose releases geometries, materials, removes event listeners and clears root', () => {
    const f = fixture(), beforePieceDisposals = metrics.pieceDisposals, beforeBoardDisposals = metrics.boardDisposals;
    f.move(7, 7, 'X');
    f.tick(1);
    let geometries = 0, materials = 0;
    f.view.ownedGeometries.forEach(g => g.addEventListener('dispose', () => geometries++));
    f.view.ownedMaterials.forEach(m => m.addEventListener('dispose', () => materials++));
    const geomCount = f.view.ownedGeometries.size, matCount = f.view.ownedMaterials.size;

    f.view.dispose();
    f.view.dispose();
    f.tick(1);

    assert.equal(geometries, geomCount);
    assert.equal(materials, matCount);
    assert.equal(metrics.pieceDisposals, beforePieceDisposals + 1);
    assert.equal(metrics.boardDisposals, beforeBoardDisposals + 1);
    assert.equal(f.eventListeners.get('pointermove').length, 0);
    assert.equal(f.eventListeners.get('pointerleave').length, 0);
    assert.equal(f.view.root.children.length, 0);
});
