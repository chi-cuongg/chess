import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

// Inject only the import bindings, so the real view and real Three.js scene
// graph run in Node without canvas, WebGL, or any files under assets/.
const metrics = { pieces: 0, boards: 0, pieceDisposals: 0, boardDisposals: 0 };
const sharedGeometry = new THREE.BoxGeometry(0.5, 1, 0.5);
const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
const theme = (id, selected = 0xffd700) => ({ id, chess: { white: {}, black: {} },
    highlights: { selected, validMove: 0x00ff00, validCapture: 0xff0000,
        lastMove: 0xffdd00, check: 0xff0000, winLine: 0x66ffff } });
const themes = { 'harry-potter': theme('harry-potter'), cyber: theme('cyber', 0x00ffff) };
globalThis.__chess3dMockAssets = {
    THREE,
    createChessPiece(code) {
        metrics.pieces++;
        const mesh = new THREE.Mesh(sharedGeometry, code === code.toUpperCase() ? whiteMaterial : blackMaterial);
        mesh.userData.code = code;
        return mesh;
    },
    setChessTheme(preset) {
        whiteMaterial.color.set(preset.id === 'cyber' ? 0x00ffff : 0xffffff);
        blackMaterial.color.set(preset.id === 'cyber' ? 0x550055 : 0x222222);
    },
    disposeChessAssets() { metrics.pieceDisposals++; },
    createChessBoard() {
        metrics.boards++;
        return { group: new THREE.Group(),
            squareToWorld: (row, col) => new THREE.Vector3(col - 3.5, 0, row - 3.5),
            worldToSquare(point) {
                const row = Math.floor(point.z + 4), col = Math.floor(point.x + 4);
                return row >= 0 && row < 8 && col >= 0 && col < 8 ? { row, col } : null;
            } };
    },
    setBoardTheme() {}, disposeBoardAssets() { metrics.boardDisposals++; },
    getTheme: value => value?.chess ? value : themes[value] || themes['harry-potter'],
    DEFAULT_THEME: 'harry-potter'
};
let source = readFileSync(new URL('../src/3d/views/chessView.js', import.meta.url), 'utf8');
source = source.replace(/^import .*;$/gm, '');
source = `const { THREE, createChessPiece, setChessTheme, disposeChessAssets, createChessBoard,
    setBoardTheme, disposeBoardAssets, getTheme, DEFAULT_THEME } = globalThis.__chess3dMockAssets;\n${source}`;
const { ChessView } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
delete globalThis.__chess3dMockAssets;

const emptyBoard = () => Array.from({ length: 8 }, () => Array(8).fill(null));
function snapshot(board, extra = {}) {
    return { game: 'chess', rows: 8, cols: 8, board: board.map(row => [...row]), turn: 'white',
        selected: null, hints: [], lastMove: null, captured: null, check: null,
        gameOver: false, flipped: false, aiThinking: false, moveId: 1, ...extra };
}
function initialBoard() {
    const board = emptyBoard();
    board[0] = [...'rnbqkbnr']; board[1] = [...'pppppppp'];
    board[6] = [...'PPPPPPPP']; board[7] = [...'RNBQKBNR'];
    return board;
}
function fixture(board = initialBoard(), motionEnabled = true) {
    const pending = [], calls = [];
    const engine = { themeId: 'harry-potter', motionEnabled,
        camera: new THREE.PerspectiveCamera(), controls: { target: new THREE.Vector3(), update() {} },
        requestRender() {},
        animate(duration, update) {
            calls.push(duration);
            if (!this.motionEnabled || !duration) { update(1); return Promise.resolve(true); }
            return new Promise(resolve => { update(0); pending.push({ update, resolve, duration }); });
        } };
    engine.camera.position.set(0, 11.5, 12);
    const view = new ChessView(); view.init(engine);
    let state = snapshot(board); view.update(state, null);
    const tick = t => {
        for (const item of [...pending]) {
            item.update(t);
            if (t === 1) { pending.splice(pending.indexOf(item), 1); item.resolve(true); }
        }
    };
    const update = next => { view.update(next, state); state = next; };
    const move = (from, to, captured = null, promotion = null) => {
        const board = state.board.map(row => [...row]);
        board[to.row][to.col] = promotion || board[from.row][from.col]; board[from.row][from.col] = null;
        if (captured && (captured.row !== to.row || captured.col !== to.col)) board[captured.row][captured.col] = null;
        const next = snapshot(board, { moveId: state.moveId + 1, lastMove: { from, to }, captured });
        update(next); return next;
    };
    return { view, engine, pending, calls, tick, update, move, get state() { return state; } };
}

test('initial board creates 32 pieces and unchanged snapshots retain every node', () => {
    const before = metrics.pieces, f = fixture();
    const records = [...f.view.pieces.values()];
    assert.equal(metrics.pieces - before, 32); assert.equal(f.view.pieces.size, 32);
    f.update({ ...f.state, aiThinking: true });
    assert.deepEqual([...f.view.pieces.values()], records); assert.equal(metrics.pieces - before, 32);
    f.view.dispose();
});
test('selection lifts/glows only the selected piece and restores shared materials', () => {
    const f = fixture(), selected = f.view.pieces.get('6,4'), other = f.view.pieces.get('6,3');
    f.update({ ...f.state, selected: { row: 6, col: 4 }, hints: [{ row: 4, col: 4, capture: false }, { row: 5, col: 3, capture: true }] });
    assert.notEqual(selected.model.material, whiteMaterial); assert.equal(other.model.material, whiteMaterial);
    f.tick(1); assert.equal(selected.object.position.y, 0.24);
    assert.equal(selected.model.material.emissive.getHex(), themes['harry-potter'].highlights.selected);
    assert(f.view.hints[0].visible); assert.equal(f.view.hints[1].material, f.view.markerMaterials.capture);
    f.update({ ...f.state, selected: null, hints: [] }); f.tick(1);
    assert.equal(selected.model.material, whiteMaterial); assert.equal(selected.object.position.y, 0);
    assert.equal(f.view.hints[0].visible, false); f.view.dispose();
});
test('normal movement reuses nodes and travels on a 380ms parabolic arc', () => {
    const f = fixture(), pawn = f.view.pieces.get('6,4'), queen = f.view.pieces.get('7,3');
    f.update({ ...f.state, selected: { row: 6, col: 4 } }); f.tick(1);
    f.move({ row: 6, col: 4 }, { row: 4, col: 4 });
    assert.equal(f.view.pieces.get('4,4'), pawn); assert.equal(f.view.pieces.get('7,3'), queen);
    f.tick(0.5); assert(pawn.object.position.y > 0.8); assert(f.calls.includes(380));
    f.tick(1); assert.equal(pawn.object.position.y, 0); assert.equal(pawn.object.position.z, 0.5);
    assert.equal(f.view.lastMarkers[0].visible, true); f.view.dispose();
});
test('capture rises/fades with private materials and disposes its ghost once', () => {
    const board = emptyBoard(); board[4][4] = 'P'; board[3][3] = 'p';
    const f = fixture(board), captured = f.view.pieces.get('3,3'), shared = captured.model.material;
    let disposed = 0;
    f.move({ row: 4, col: 4 }, { row: 3, col: 3 }, { row: 3, col: 3, piece: 'p' });
    captured.model.material.addEventListener('dispose', () => disposed++);
    assert.equal(f.view.retiring.size, 1); assert.notEqual(captured.model.material, shared);
    f.tick(0.5); assert.equal(captured.model.material.opacity, 0.5); assert(captured.object.position.y > 1);
    assert.equal(shared.opacity, 1);
    f.tick(1); assert.equal(f.view.retiring.size, 0); assert.equal(captured.object.parent, null); assert.equal(disposed, 1);
    f.view.dispose();
});
test('en passant retires the pawn from its actual off-destination square', () => {
    const board = emptyBoard(); board[3][4] = 'P'; board[3][3] = 'p';
    const f = fixture(board), pawn = f.view.pieces.get('3,4'), captured = f.view.pieces.get('3,3');
    f.move({ row: 3, col: 4 }, { row: 2, col: 3 }, { row: 3, col: 3, piece: 'p' });
    assert.equal(f.view.pieces.get('2,3'), pawn); assert(!f.view.pieces.has('3,3')); assert(f.view.retiring.has(captured));
    f.tick(1); assert.equal(f.view.pieces.size, 1); f.view.dispose();
});
test('same-move AI/status snapshots do not restart movement or duplicate captures', () => {
    const board = emptyBoard(); board[4][4] = 'P'; board[3][3] = 'p';
    const f = fixture(board);
    f.move({ row: 4, col: 4 }, { row: 3, col: 3 }, { row: 3, col: 3, piece: 'p' });
    const animations = f.calls.length, piece = f.view.pieces.get('3,3');
    f.update({ ...f.state, aiThinking: true });
    f.update({ ...f.state, aiThinking: false });
    assert.equal(f.calls.length, animations); assert.equal(f.view.retiring.size, 1);
    assert.equal(f.view.pieces.get('3,3'), piece);
    f.tick(1); assert.equal(f.view.retiring.size, 0); f.view.dispose();
});
test('castling moves the king and rook together without recreating either', () => {
    for (const kingside of [true, false]) {
        const board = emptyBoard(); board[7][4] = 'K'; board[7][kingside ? 7 : 0] = 'R';
        const f = fixture(board), king = f.view.pieces.get('7,4'), rook = f.view.pieces.get(`7,${kingside ? 7 : 0}`);
        const next = emptyBoard(); next[7][kingside ? 6 : 2] = 'K'; next[7][kingside ? 5 : 3] = 'R';
        f.update(snapshot(next, { moveId: 2, lastMove: { from: { row: 7, col: 4 }, to: { row: 7, col: kingside ? 6 : 2 } } }));
        assert.equal(f.view.pieces.get(`7,${kingside ? 6 : 2}`), king); assert.equal(f.view.pieces.get(`7,${kingside ? 5 : 3}`), rook);
        assert.equal(f.pending.filter(item => item.duration === 380).length, 2);
        f.tick(0.5); assert(king.object.position.y > 0); assert(rook.object.position.y > 0);
        f.tick(1); f.view.dispose();
    }
});
test('promotion morphs the pawn into a new model and removes the old model', () => {
    const board = emptyBoard(); board[1][0] = 'P';
    const f = fixture(board), pawn = f.view.pieces.get('1,0'), oldModel = pawn.model;
    f.move({ row: 1, col: 0 }, { row: 0, col: 0 }, null, 'Q');
    assert.equal(f.view.pieces.get('0,0'), pawn); assert.equal(pawn.code, 'Q');
    assert.notEqual(pawn.model, oldModel); assert.equal(pawn.model.scale.x, 0);
    f.tick(0.5); assert(pawn.model.scale.x > 0); assert(oldModel.scale.x < 1);
    f.tick(1); assert.equal(oldModel.parent, null); assert.equal(pawn.model.scale.x, 1); f.view.dispose();
});
test('undo/reset reconcile board diffs without replaying stale capture metadata', () => {
    const board = emptyBoard(); board[4][4] = 'P'; board[3][3] = 'p';
    const f = fixture(board), initial = f.state;
    f.move({ row: 4, col: 4 }, { row: 3, col: 3 }, { row: 3, col: 3, piece: 'p' });
    f.update({ ...initial, moveId: 3 });
    assert.equal(f.view.retiring.size, 0); assert.equal(f.view.pieces.size, 2);
    f.tick(1); assert.equal(f.view.pieces.get('4,4').code, 'P'); assert.equal(f.view.pieces.get('3,3').code, 'p');
    f.view.dispose();
});
test('rapid undo during promotion invalidates callbacks and removes intermediate models', () => {
    const board = emptyBoard(); board[1][0] = 'P';
    const f = fixture(board), initial = f.state;
    f.move({ row: 1, col: 0 }, { row: 0, col: 0 }, null, 'N'); f.tick(0.3);
    f.update({ ...initial, moveId: 3 }); f.tick(1);
    assert.equal(f.view.pieces.size, 1); assert.equal(f.view.pieces.get('1,0').model.userData.code, 'P');
    assert.equal(f.view.retiring.size, 0); f.view.dispose();
});
test('check and game-over effects finish and do not start an infinite render loop', () => {
    const board = emptyBoard(); board[7][4] = 'K';
    const f = fixture(board);
    f.update({ ...f.state, check: { row: 7, col: 4 } });
    const pulses = f.calls.filter(duration => duration === 1500).length;
    f.update({ ...f.state, aiThinking: true });
    assert.equal(f.calls.filter(duration => duration === 1500).length, pulses);
    f.tick(0.25); assert(f.view.markerMaterials.check.opacity > 0.55);
    f.tick(1); assert.equal(f.pending.length, 0); assert(f.view.checkMarker.visible);
    f.update({ ...f.state, gameOver: true }); f.tick(1);
    assert.equal(f.view.finishMarker.visible, false); assert.equal(f.pending.length, 0); f.view.dispose();
});
test('flipping rotates the camera 180 degrees without moving any piece', () => {
    const f = fixture(), pawn = f.view.pieces.get('6,4'), before = pawn.object.position.clone();
    f.update({ ...f.state, flipped: true }); f.tick(0.5);
    assert(Math.abs(f.engine.camera.position.x) > 11); assert(f.engine.camera.position.y > 0);
    f.tick(1); assert(Math.abs(f.engine.camera.position.x) < 1e-8); assert.equal(f.engine.camera.position.z, -12);
    assert(pawn.object.position.equals(before)); f.view.dispose();
});
test('disabled effects apply final states immediately with no pending animation', () => {
    const board = emptyBoard(); board[4][4] = 'P'; board[3][3] = 'p';
    const f = fixture(board, false);
    f.move({ row: 4, col: 4 }, { row: 3, col: 3 }, { row: 3, col: 3, piece: 'p' });
    f.update({ ...f.state, check: { row: 3, col: 3 }, flipped: true, gameOver: true });
    assert.equal(f.pending.length, 0); assert.equal(f.view.retiring.size, 0);
    assert.equal(f.view.pieces.get('3,3').object.position.y, 0); assert.equal(f.engine.camera.position.z, -12);
    f.view.dispose();
});
test('theme changes preserve pieces and update selected clones and markers', () => {
    const f = fixture(), pawn = f.view.pieces.get('6,4'), before = metrics.boards;
    f.update({ ...f.state, selected: { row: 6, col: 4 } }); f.tick(1);
    f.engine.themeId = 'cyber'; f.view.setTheme(themes.cyber);
    assert.equal(f.view.pieces.get('6,4'), pawn); assert.equal(metrics.boards, before + 1);
    assert.equal(pawn.model.material.emissive.getHex(), 0x00ffff);
    assert.equal(f.view.markerMaterials.selected.color.getHex(), 0x00ffff); f.view.dispose();
});
test('picking handles nested piece hits, board coordinates and out-of-board points', () => {
    const f = fixture(), pawn = f.view.pieces.get('6,4');
    assert.deepEqual(f.view.pickSquare({ object: pawn.model, point: new THREE.Vector3() }), { row: 6, col: 4 });
    assert.deepEqual(f.view.pickSquare({ object: f.view.boardAsset.group, point: new THREE.Vector3(-3.5, 0, -3.5) }), { row: 0, col: 0 });
    assert.equal(f.view.pickSquare({ object: f.view.boardAsset.group, point: new THREE.Vector3(100, 0, 100) }), null);
    assert.equal(f.view.pickSquare(null), null); f.view.dispose();
});
test('dispose releases marker/clone assets once and ignores late animation callbacks', () => {
    const f = fixture(), beforePieces = metrics.pieceDisposals, beforeBoards = metrics.boardDisposals;
    f.update({ ...f.state, selected: { row: 6, col: 4 }, check: { row: 7, col: 4 } });
    let geometries = 0, materials = 0;
    f.view.ownedGeometries.forEach(value => value.addEventListener('dispose', () => geometries++));
    f.view.ownedMaterials.forEach(value => value.addEventListener('dispose', () => materials++));
    const geometryCount = f.view.ownedGeometries.size, materialCount = f.view.ownedMaterials.size;
    f.view.dispose(); f.view.dispose(); f.tick(1);
    assert.equal(geometries, geometryCount); assert.equal(materials, materialCount);
    assert.equal(metrics.pieceDisposals, beforePieces + 1); assert.equal(metrics.boardDisposals, beforeBoards + 1);
    assert.equal(f.view.root.children.length, 0); assert.equal(f.view.pieces.size, 0);
});
