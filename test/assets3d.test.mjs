import test from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';

import { THEMES, getTheme, DEFAULT_THEME } from '../src/3d/assets/themes.js';
import {
    setCanvasFactory,
    getCanvasFactory,
    createCanvas,
    createStubCanvas
} from '../src/3d/assets/canvas-util.js';
import {
    createChessPiece,
    setChessTheme,
    parseChessCode,
    disposeChessPieces
} from '../src/3d/assets/pieces-chess.js';
import {
    createXiangqiPiece,
    setXiangqiTheme,
    parseXiangqiCode,
    XIANGQI_PIECES,
    disposeXiangqiPieces
} from '../src/3d/assets/pieces-xiangqi.js';
import {
    createXOMeshes,
    setXOTheme,
    disposeXOMeshes
} from '../src/3d/assets/pieces-xo.js';
import {
    createChessBoard,
    createXiangqiBoard,
    createXOBoard,
    setBoardTheme,
    disposeBoards
} from '../src/3d/assets/boards.js';

function countTriangles(obj) {
    let total = 0;
    if (obj.geometry) {
        const geom = obj.geometry;
        if (geom.index) {
            total += geom.index.count / 3;
        } else if (geom.attributes && geom.attributes.position) {
            total += geom.attributes.position.count / 3;
        }
    }
    if (obj.children && obj.children.length > 0) {
        for (const child of obj.children) {
            total += countTriangles(child);
        }
    }
    return total;
}

test('Theme presets - 4 required themes exist with complete properties', () => {
    const requiredThemes = ['harry-potter', 'greek', 'cyber', 'vampire'];
    for (const id of requiredThemes) {
        const theme = THEMES[id];
        assert.ok(theme, `Theme ${id} must exist`);
        assert.strictEqual(theme.id, id);
        assert.ok(theme.scene && typeof theme.scene.background === 'number');
        assert.ok(theme.lights && theme.lights.ambient && theme.lights.directional);
        assert.ok(theme.chess && theme.chess.white && theme.chess.black);
        assert.ok(theme.xiangqi && theme.xiangqi.red && theme.xiangqi.black);
        assert.ok(theme.xo && theme.xo.x && theme.xo.o);
        assert.ok(theme.board && theme.board.woodLight && theme.board.woodDark);
        assert.ok(theme.highlights && theme.highlights.selected && theme.highlights.validMove);
    }

    assert.strictEqual(getTheme().id, DEFAULT_THEME);
    assert.strictEqual(getTheme('non-existent').id, DEFAULT_THEME);
    assert.strictEqual(getTheme('greek').id, 'greek');
});

test('Canvas util - supports stub in Node and inject canvas factory', () => {
    const stub = createCanvas(128, 128);
    assert.ok(stub, 'Must return a canvas stub in Node');
    assert.strictEqual(stub.width, 128);
    const ctx = stub.getContext('2d');
    assert.ok(ctx, 'Stub must provide 2d context');
    assert.doesNotThrow(() => {
        ctx.fillRect(0, 0, 10, 10);
        ctx.fillText('test', 5, 5);
        ctx.beginPath();
        ctx.arc(5, 5, 2, 0, Math.PI * 2);
        ctx.stroke();
    });

    let customCalled = false;
    setCanvasFactory((w, h) => {
        customCalled = true;
        return createStubCanvas(w, h);
    });
    assert.ok(getCanvasFactory());
    const custom = createCanvas(64, 64);
    assert.ok(customCalled, 'Custom canvas factory must be invoked');
    assert.strictEqual(custom.width, 64);
    setCanvasFactory(null);
});

test('Chess pieces - creates all 6 types for White and Black with triangle count <= 3000', () => {
    const whiteCodes = ['K', 'Q', 'R', 'B', 'N', 'P'];
    const blackCodes = ['k', 'q', 'r', 'b', 'n', 'p'];

    for (const code of whiteCodes) {
        const piece = createChessPiece(code);
        assert.ok(piece instanceof THREE.Object3D, `Piece ${code} must be an Object3D`);
        assert.strictEqual(piece.userData.color, 'white');
        const tris = countTriangles(piece);
        assert.ok(tris > 0, `Piece ${code} must have triangles`);
        assert.ok(tris <= 3000, `Piece ${code} triangles (${tris}) must be <= 3000`);
    }

    for (const code of blackCodes) {
        const piece = createChessPiece(code);
        assert.ok(piece instanceof THREE.Object3D, `Piece ${code} must be an Object3D`);
        assert.strictEqual(piece.userData.color, 'black');
        const tris = countTriangles(piece);
        assert.ok(tris > 0, `Piece ${code} must have triangles`);
        assert.ok(tris <= 3000, `Piece ${code} triangles (${tris}) must be <= 3000`);
    }

    // Cache test: calling createChessPiece twice reuses the same geometry
    const p1 = createChessPiece('K');
    const p2 = createChessPiece('K');
    assert.strictEqual(p1.geometry, p2.geometry, 'Geometry must be cached and reused');

    // Theme switching test
    setChessTheme('cyber');
    const cyberPiece = createChessPiece('P');
    assert.strictEqual(cyberPiece.material.roughness, THEMES.cyber.chess.white.roughness);

    disposeChessPieces();
});

test('Xiangqi pieces - creates all 7 types for Red and Black with triangle count <= 3000', () => {
    const codes = Object.keys(XIANGQI_PIECES);
    assert.strictEqual(codes.length, 14, 'Must have 14 piece codes (7 red, 7 black)');

    for (const code of codes) {
        const piece = createXiangqiPiece(code);
        assert.ok(piece instanceof THREE.Object3D, `Xiangqi piece ${code} must be an Object3D`);
        const tris = countTriangles(piece);
        assert.ok(tris > 0, `Xiangqi piece ${code} must have triangles`);
        assert.ok(tris <= 3000, `Xiangqi piece ${code} triangles (${tris}) must be <= 3000`);
        assert.ok(piece.userData.symbol, `Xiangqi piece ${code} must have symbol`);
        assert.ok(piece.userData.color === 'red' || piece.userData.color === 'black');
    }

    // Geometry caching
    const r1 = createXiangqiPiece('R_K');
    const r2 = createXiangqiPiece('R_P');
    assert.strictEqual(r1.geometry, r2.geometry, 'Xiangqi disc geometry must be cached and reused');

    // Theme switching
    setXiangqiTheme('greek');
    const greekPiece = createXiangqiPiece('R_K');
    assert.ok(greekPiece, 'Greek theme piece should be created');

    disposeXiangqiPieces();
});

test('Caro pieces - createXOMeshes returns InstancedMeshes with triangle count <= 3000', () => {
    const xo = createXOMeshes(225);
    assert.ok(xo.x instanceof THREE.InstancedMesh, 'x must be an InstancedMesh');
    assert.ok(xo.o instanceof THREE.InstancedMesh, 'o must be an InstancedMesh');
    assert.strictEqual(xo.x.instanceMatrix.count, 225);
    assert.strictEqual(xo.o.instanceMatrix.count, 225);

    const xTris = countTriangles(xo.x);
    const oTris = countTriangles(xo.o);

    assert.ok(xTris > 0 && xTris <= 3000, `X triangles (${xTris}) must be <= 3000`);
    assert.ok(oTris > 0 && oTris <= 3000, `O triangles (${oTris}) must be <= 3000`);

    setXOTheme('vampire');
    disposeXOMeshes();
});

test('Chess board - squareToWorld / worldToSquare roundtrip for all 64 squares', () => {
    const board = createChessBoard();
    assert.ok(board.group instanceof THREE.Group, 'Board must have a THREE.Group');
    assert.strictEqual(typeof board.squareToWorld, 'function');
    assert.strictEqual(typeof board.worldToSquare, 'function');

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const world = board.squareToWorld(r, c);
            assert.ok(world instanceof THREE.Vector3, `squareToWorld(${r},${c}) must return a Vector3`);

            const square = board.worldToSquare(world);
            assert.ok(square, `worldToSquare must resolve square for (${r},${c})`);
            assert.strictEqual(square.row, r, `Row must match for (${r},${c})`);
            assert.strictEqual(square.col, c, `Col must match for (${r},${c})`);
        }
    }

    // Out of bounds test
    assert.strictEqual(board.worldToSquare({ x: 99, y: 0, z: 99 }), null);
    assert.strictEqual(board.worldToSquare({ x: -99, y: 0, z: -99 }), null);
    assert.strictEqual(board.worldToSquare(null), null);

    disposeBoards();
});

test('Xiangqi board - squareToWorld / worldToSquare roundtrip for all 90 intersections', () => {
    const board = createXiangqiBoard();
    assert.ok(board.group instanceof THREE.Group, 'Xiangqi board must have a THREE.Group');

    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const world = board.squareToWorld(r, c);
            assert.ok(world instanceof THREE.Vector3);

            const square = board.worldToSquare(world);
            assert.ok(square, `worldToSquare must resolve intersection for (${r},${c})`);
            assert.strictEqual(square.row, r, `Row must match for (${r},${c})`);
            assert.strictEqual(square.col, c, `Col must match for (${r},${c})`);
        }
    }

    assert.strictEqual(board.worldToSquare({ x: 99, y: 0, z: 99 }), null);
    assert.strictEqual(board.worldToSquare(null), null);

    disposeBoards();
});

test('Caro board - squareToWorld / worldToSquare roundtrip for all 225 cells', () => {
    const board = createXOBoard(15);
    assert.ok(board.group instanceof THREE.Group, 'Caro board must have a THREE.Group');

    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            const world = board.squareToWorld(r, c);
            assert.ok(world instanceof THREE.Vector3);

            const square = board.worldToSquare(world);
            assert.ok(square, `worldToSquare must resolve cell for (${r},${c})`);
            assert.strictEqual(square.row, r, `Row must match for (${r},${c})`);
            assert.strictEqual(square.col, c, `Col must match for (${r},${c})`);
        }
    }

    assert.strictEqual(board.worldToSquare({ x: 99, y: 0, z: 99 }), null);
    assert.strictEqual(board.worldToSquare(null), null);

    disposeBoards();
});
