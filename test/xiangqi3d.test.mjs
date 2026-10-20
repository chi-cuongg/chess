import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const metrics = { pieces: 0, boards: 0, pieceDisposals: 0, boardDisposals: 0 };
const sharedGeometry = new THREE.CylinderGeometry(0.41, 0.43, 0.16, 36);
const redMaterial = new THREE.MeshStandardMaterial({ color: 0xd32f2f });
const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x1a120e });
const theme = (id, selected = 0xffd700) => ({
    id, xiangqi: { red: {}, black: {} },
    highlights: {
        selected, validMove: 0x00ffc8, validCapture: 0xff3232,
        lastMove: 0xffd700, check: 0xff0000, winLine: 0xa8d18d
    }
});
const themes = { 'harry-potter': theme('harry-potter'), cyber: theme('cyber', 0x00ffff) };

globalThis.__xiangqi3dMockAssets = {
    THREE,
    createXiangqiPiece(code) {
        metrics.pieces++;
        const mesh = new THREE.Mesh(sharedGeometry, code.startsWith('R_') ? redMaterial : blackMaterial);
        mesh.userData.code = code;
        return mesh;
    },
    setXiangqiTheme(preset) {
        redMaterial.color.set(preset.id === 'cyber' ? 0xff007f : 0xd32f2f);
        blackMaterial.color.set(preset.id === 'cyber' ? 0x00ffff : 0x1a120e);
    },
    disposeXiangqiAssets() { metrics.pieceDisposals++; },
    createXiangqiBoard() {
        metrics.boards++;
        return {
            group: new THREE.Group(),
            squareToWorld: (row, col) => new THREE.Vector3(col - 4.0, 0, row - 4.5),
            worldToSquare(point) {
                const row = Math.round(point.z + 4.5), col = Math.round(point.x + 4.0);
                return row >= 0 && row < 10 && col >= 0 && col < 9 ? { row, col } : null;
            }
        };
    },
    setBoardTheme() {},
    disposeBoardAssets() { metrics.boardDisposals++; },
    getTheme: value => value?.xiangqi ? value : themes[value] || themes['harry-potter'],
    DEFAULT_THEME: 'harry-potter'
};

let source = readFileSync(new URL('../src/3d/views/xiangqiView.js', import.meta.url), 'utf8');
source = source.replace(/^import .*;$/gm, '');
source = `const { THREE, createXiangqiPiece, setXiangqiTheme, disposeXiangqiAssets, createXiangqiBoard,
    setBoardTheme, disposeBoardAssets, getTheme, DEFAULT_THEME } = globalThis.__xiangqi3dMockAssets;\n${source}`;
const { XiangqiView } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
delete globalThis.__xiangqi3dMockAssets;

const emptyBoard = () => Array.from({ length: 10 }, () => Array(9).fill(null));

function initialBoard() {
    const board = emptyBoard();
    board[0] = ['B_R', 'B_H', 'B_E', 'B_A', 'B_K', 'B_A', 'B_E', 'B_H', 'B_R'];
    board[2][1] = 'B_C'; board[2][7] = 'B_C';
    board[3][0] = 'B_P'; board[3][2] = 'B_P'; board[3][4] = 'B_P'; board[3][6] = 'B_P'; board[3][8] = 'B_P';

    board[9] = ['R_R', 'R_H', 'R_E', 'R_A', 'R_K', 'R_A', 'R_E', 'R_H', 'R_R'];
    board[7][1] = 'R_C'; board[7][7] = 'R_C';
    board[6][0] = 'R_P'; board[6][2] = 'R_P'; board[6][4] = 'R_P'; board[6][6] = 'R_P'; board[6][8] = 'R_P';
    return board;
}

function snapshot(board, extra = {}) {
    return {
        game: 'xiangqi', rows: 10, cols: 9, board: board.map(row => [...row]), turn: 'red',
        selected: null, hints: [], lastMove: null, captured: null, check: null,
        winLine: null, gameOver: false, flipped: false, aiThinking: false, moveId: 1, ...extra
    };
}

function fixture(board = initialBoard(), motionEnabled = true) {
    const pending = [], calls = [];
    const engine = {
        themeId: 'harry-potter', motionEnabled,
        camera: new THREE.PerspectiveCamera(),
        controls: { target: new THREE.Vector3(), update() {} },
        requestRender() {},
        animate(duration, update) {
            calls.push(duration);
            if (!this.motionEnabled || !duration) { update(1); return Promise.resolve(true); }
            return new Promise(resolve => { update(0); pending.push({ update, resolve, duration }); });
        }
    };
    engine.camera.position.set(0, 12.5, 13);
    const view = new XiangqiView();
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
    const move = (from, to, captured = null) => {
        const nextBoard = state.board.map(row => [...row]);
        nextBoard[to.row][to.col] = nextBoard[from.row][from.col];
        nextBoard[from.row][from.col] = null;
        if (captured && (captured.row !== to.row || captured.col !== to.col)) {
            nextBoard[captured.row][captured.col] = null;
        }
        const next = snapshot(nextBoard, { moveId: state.moveId + 1, lastMove: { from, to }, captured });
        update(next);
        return next;
    };
    return { view, engine, pending, calls, tick, update, move, get state() { return state; } };
}

test('initial board creates 32 pieces and unchanged snapshots retain every node', () => {
    const before = metrics.pieces, f = fixture();
    const records = [...f.view.pieces.values()];
    assert.equal(metrics.pieces - before, 32);
    assert.equal(f.view.pieces.size, 32);
    f.update({ ...f.state, aiThinking: true });
    assert.deepEqual([...f.view.pieces.values()], records);
    assert.equal(metrics.pieces - before, 32);
    f.view.dispose();
});

test('selection lifts/glows only the selected piece and restores shared materials', () => {
    const f = fixture(), selected = f.view.pieces.get('6,4'), other = f.view.pieces.get('6,2');
    f.update({ ...f.state, selected: { row: 6, col: 4 }, hints: [{ row: 5, col: 4, capture: false }] });
    assert.notEqual(selected.model.material, redMaterial);
    assert.equal(other.model.material, redMaterial);
    f.tick(1);
    assert.equal(selected.object.position.y, 0.24);
    assert.equal(selected.model.material.emissive.getHex(), themes['harry-potter'].highlights.selected);
    assert(f.view.hints[0].visible);
    f.update({ ...f.state, selected: null, hints: [] });
    f.tick(1);
    assert.equal(selected.model.material, redMaterial);
    assert.equal(selected.object.position.y, 0);
    assert.equal(f.view.hints[0].visible, false);
    f.view.dispose();
});

test('normal movement reuses nodes and travels on a 380ms parabolic arc', () => {
    const f = fixture(), soldier = f.view.pieces.get('6,4'), cannon = f.view.pieces.get('7,1');
    f.update({ ...f.state, selected: { row: 6, col: 4 } });
    f.tick(1);
    f.move({ row: 6, col: 4 }, { row: 5, col: 4 });
    assert.equal(f.view.pieces.get('5,4'), soldier);
    assert.equal(f.view.pieces.get('7,1'), cannon);
    f.tick(0.5);
    assert(soldier.object.position.y > 0.8);
    assert(f.calls.includes(380));
    f.tick(1);
    assert.equal(soldier.object.position.y, 0);
    assert.equal(soldier.object.position.z, 0.5);
    assert.equal(f.view.lastMarkers[0].visible, true);
    f.view.dispose();
});

test('capture rises/fades with private materials and disposes its ghost once', () => {
    const board = emptyBoard();
    board[5][4] = 'R_C'; board[2][4] = 'B_H';
    const f = fixture(board), captured = f.view.pieces.get('2,4'), shared = captured.model.material;
    let disposed = 0;
    f.move({ row: 5, col: 4 }, { row: 2, col: 4 }, { row: 2, col: 4, piece: 'B_H' });
    captured.model.material.addEventListener('dispose', () => disposed++);
    assert.equal(f.view.retiring.size, 1);
    assert.notEqual(captured.model.material, shared);
    f.tick(0.5);
    assert.equal(captured.model.material.opacity, 0.5);
    assert(captured.object.position.y > 1);
    assert.equal(shared.opacity, 1);
    f.tick(1);
    assert.equal(f.view.retiring.size, 0);
    assert.equal(captured.object.parent, null);
    assert.equal(disposed, 1);
    f.view.dispose();
});

test('same-move AI/status snapshots do not restart movement or duplicate captures', () => {
    const board = emptyBoard();
    board[5][4] = 'R_C'; board[2][4] = 'B_H';
    const f = fixture(board);
    f.move({ row: 5, col: 4 }, { row: 2, col: 4 }, { row: 2, col: 4, piece: 'B_H' });
    const animations = f.calls.length, piece = f.view.pieces.get('2,4');
    f.update({ ...f.state, aiThinking: true });
    f.update({ ...f.state, aiThinking: false });
    assert.equal(f.calls.length, animations);
    assert.equal(f.view.retiring.size, 1);
    assert.equal(f.view.pieces.get('2,4'), piece);
    f.tick(1);
    assert.equal(f.view.retiring.size, 0);
    f.view.dispose();
});

test('undo/reset reconcile board diffs without replaying stale capture metadata', () => {
    const board = emptyBoard();
    board[5][4] = 'R_C'; board[2][4] = 'B_H';
    const f = fixture(board), initial = f.state;
    f.move({ row: 5, col: 4 }, { row: 2, col: 4 }, { row: 2, col: 4, piece: 'B_H' });
    f.update({ ...initial, moveId: 3 });
    assert.equal(f.view.retiring.size, 0);
    assert.equal(f.view.pieces.size, 2);
    f.tick(1);
    assert.equal(f.view.pieces.get('5,4').code, 'R_C');
    assert.equal(f.view.pieces.get('2,4').code, 'B_H');
    f.view.dispose();
});

test('check and game-over effects finish and do not start an infinite render loop', () => {
    const board = emptyBoard();
    board[9][4] = 'R_K';
    const f = fixture(board);
    f.update({ ...f.state, check: { row: 9, col: 4 } });
    const pulses = f.calls.filter(duration => duration === 1500).length;
    f.update({ ...f.state, aiThinking: true });
    assert.equal(f.calls.filter(duration => duration === 1500).length, pulses);
    f.tick(0.25);
    assert(f.view.markerMaterials.check.opacity > 0.55);
    f.tick(1);
    assert.equal(f.pending.length, 0);
    assert(f.view.checkMarker.visible);
    f.update({ ...f.state, gameOver: true });
    f.tick(1);
    assert.equal(f.view.finishMarker.visible, false);
    assert.equal(f.pending.length, 0);
    f.view.dispose();
});

test('flipping rotates the camera 180 degrees and rotates piece characters to face player', () => {
    const f = fixture(), soldier = f.view.pieces.get('6,4');
    assert.equal(soldier.object.rotation.y, 0);
    f.update({ ...f.state, flipped: true });
    f.tick(0.5);
    assert(Math.abs(f.engine.camera.position.x) > 11);
    assert(soldier.object.rotation.y > 1.0);
    f.tick(1);
    assert(Math.abs(f.engine.camera.position.x) < 1e-8);
    assert.equal(f.engine.camera.position.z, -13);
    assert(Math.abs(soldier.object.rotation.y - Math.PI) < 1e-6);
    f.update({ ...f.state, flipped: false });
    f.tick(1);
    assert(Math.abs(soldier.object.rotation.y) < 1e-6);
    f.view.dispose();
});

test('disabled effects apply final states immediately with no pending animation', () => {
    const board = emptyBoard();
    board[5][4] = 'R_C'; board[2][4] = 'B_H';
    const f = fixture(board, false);
    f.move({ row: 5, col: 4 }, { row: 2, col: 4 }, { row: 2, col: 4, piece: 'B_H' });
    f.update({ ...f.state, check: { row: 2, col: 4 }, flipped: true, gameOver: true });
    assert.equal(f.pending.length, 0);
    assert.equal(f.view.retiring.size, 0);
    assert.equal(f.view.pieces.get('2,4').object.position.y, 0);
    assert.equal(f.engine.camera.position.z, -13);
    f.view.dispose();
});

test('flipping during a move preserves both travel and character rotation', () => {
    const f = fixture();
    f.move({ row: 6, col: 4 }, { row: 5, col: 4 });
    f.tick(0.25);
    f.update({ ...f.state, flipped: true });
    f.tick(1);
    const soldier = f.view.pieces.get('5,4');
    assert.equal(soldier.object.position.z, 0.5);
    assert.equal(soldier.object.position.y, 0);
    assert(Math.abs(soldier.object.rotation.y - Math.PI) < 1e-6);
    f.view.dispose();
});

test('theme changes preserve pieces and update selected clones and markers', () => {
    const f = fixture(), soldier = f.view.pieces.get('6,4'), before = metrics.boards;
    f.update({ ...f.state, selected: { row: 6, col: 4 } });
    f.tick(1);
    f.engine.themeId = 'cyber';
    f.view.setTheme(themes.cyber);
    assert.equal(f.view.pieces.get('6,4'), soldier);
    assert.equal(metrics.boards, before + 1);
    assert.equal(soldier.model.material.emissive.getHex(), 0x00ffff);
    assert.equal(f.view.markerMaterials.selected.color.getHex(), 0x00ffff);
    f.view.dispose();
});

test('picking handles nested piece hits, board coordinates and out-of-board points', () => {
    const f = fixture(), soldier = f.view.pieces.get('6,4');
    assert.deepEqual(f.view.pickSquare({ object: soldier.model, point: new THREE.Vector3() }), { row: 6, col: 4 });
    assert.deepEqual(f.view.pickSquare({ object: f.view.boardAsset.group, point: new THREE.Vector3(-4.0, 0, -4.5) }), { row: 0, col: 0 });
    assert.equal(f.view.pickSquare({ object: f.view.boardAsset.group, point: new THREE.Vector3(100, 0, 100) }), null);
    assert.equal(f.view.pickSquare(null), null);
    f.view.dispose();
});

test('dispose releases marker/clone assets once and ignores late animation callbacks', () => {
    const f = fixture(), beforePieces = metrics.pieceDisposals, beforeBoards = metrics.boardDisposals;
    f.update({ ...f.state, selected: { row: 6, col: 4 }, check: { row: 9, col: 4 } });
    let geometries = 0, materials = 0;
    f.view.ownedGeometries.forEach(value => value.addEventListener('dispose', () => geometries++));
    f.view.ownedMaterials.forEach(value => value.addEventListener('dispose', () => materials++));
    const geometryCount = f.view.ownedGeometries.size, materialCount = f.view.ownedMaterials.size;
    f.view.dispose();
    f.view.dispose();
    f.tick(1);
    assert.equal(geometries, geometryCount);
    assert.equal(materials, materialCount);
    assert.equal(metrics.pieceDisposals, beforePieces + 1);
    assert.equal(metrics.boardDisposals, beforeBoards + 1);
    assert.equal(f.view.root.children.length, 0);
    assert.equal(f.view.pieces.size, 0);
});

test('piece places at exact intersection coordinate on 10x9 board', () => {
    const f = fixture();
    const general = f.view.pieces.get('9,4');
    assert.ok(general);
    assert.equal(general.object.position.x, 0);
    assert.equal(general.object.position.z, 4.5);
    const chariot = f.view.pieces.get('0,0');
    assert.ok(chariot);
    assert.equal(chariot.object.position.x, -4);
    assert.equal(chariot.object.position.z, -4.5);
    f.view.dispose();
});

test('hints show move and capture markers properly', () => {
    const f = fixture();
    f.update({
        ...f.state,
        selected: { row: 6, col: 4 },
        hints: [
            { row: 5, col: 4, capture: false },
            { row: 5, col: 3, capture: true }
        ]
    });
    assert(f.view.hints[0].visible);
    assert.equal(f.view.hints[0].material, f.view.markerMaterials.hint);
    assert(f.view.hints[1].visible);
    assert.equal(f.view.hints[1].material, f.view.markerMaterials.capture);
    assert.equal(f.view.hints[2].visible, false);
    f.view.dispose();
});
