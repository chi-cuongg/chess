import test from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { fitBoardCamera } from '../src/3d/camera-fit.js';
import { Engine3D } from '../src/3d/engine.js';

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

test('Xiangqi theme updates existing pieces and releases replaced symbol textures', () => {
    disposeXiangqiPieces();
    setXiangqiTheme('harry-potter');
    const piece = createXiangqiPiece('R_K');
    const materials = piece.material;
    const oldTexture = materials[1].map;
    let released = 0;
    oldTexture.addEventListener('dispose', () => released++);
    setXiangqiTheme('cyber');
    assert.strictEqual(piece.material, materials);
    assert.strictEqual(materials[0].color.getHex(), THEMES.cyber.xiangqi.red.discColor);
    assert.notStrictEqual(materials[1].map, oldTexture);
    assert.strictEqual(released, 1);
    assert.strictEqual(createXiangqiPiece('R_K').material, materials);
    setXiangqiTheme('harry-potter');
    assert.strictEqual(materials[0].color.getHex(), THEMES['harry-potter'].xiangqi.red.discColor);
    disposeXiangqiPieces();
});

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

test('Board texture centers match squareToWorld exactly without margin distortion', () => {
    // Chess 64 squares
    const chessBoard = createChessBoard();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const expected = chessBoard.squareToWorld(r, c);
            const fromTexture = chessBoard.textureSquareToWorld(r, c);
            assert.ok(
                expected.distanceTo(fromTexture) < 1e-6,
                `Chess square (${r},${c}) texture center must match squareToWorld: diff=${expected.distanceTo(fromTexture)}`
            );
        }
    }

    // Xiangqi 90 intersections
    const xiangqiBoard = createXiangqiBoard();
    for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
            const expected = xiangqiBoard.squareToWorld(r, c);
            const fromTexture = xiangqiBoard.textureSquareToWorld(r, c);
            assert.ok(
                expected.distanceTo(fromTexture) < 1e-6,
                `Xiangqi intersection (${r},${c}) texture center must match squareToWorld: diff=${expected.distanceTo(fromTexture)}`
            );
        }
    }

    // Caro 225 cells
    const xoBoard = createXOBoard(15);
    for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
            const expected = xoBoard.squareToWorld(r, c);
            const fromTexture = xoBoard.textureSquareToWorld(r, c);
            assert.ok(
                expected.distanceTo(fromTexture) < 1e-6,
                `Caro cell (${r},${c}) texture center must match squareToWorld: diff=${expected.distanceTo(fromTexture)}`
            );
        }
    }

    disposeBoards();
});

test('board and symbol color textures are decoded as sRGB', () => {
    for (const board of [createChessBoard(), createXiangqiBoard(), createXOBoard()]) {
        board.group.traverse(mesh => {
            if (mesh.material?.map) assert.strictEqual(mesh.material.map.colorSpace, THREE.SRGBColorSpace);
        });
    }
    const piece = createXiangqiPiece('B_K');
    assert.strictEqual(piece.material[1].map.colorSpace, THREE.SRGBColorSpace);
    disposeXiangqiPieces();
    disposeBoards();
});

test('camera fits every board corner at desktop and mobile ratios, including flipped boards', () => {
    for (const factory of [createChessBoard, createXiangqiBoard, createXOBoard]) {
        const board = factory();
        const bounds = new THREE.Box3().setFromObject(board.group);
        bounds.max.y = factory === createChessBoard ? 2 : 0.5;
        for (const aspect of [797 / 488, 348 / 396, 1, 0.6]) for (const sign of [1, -1]) {
            const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
            const fitted = fitBoardCamera(camera, bounds, { position: [0, 12.5, 13 * sign], target: [0, 0, 0] });
            camera.position.fromArray(fitted.position);
            camera.lookAt(...fitted.target);
            camera.updateMatrixWorld();
            let extent = 0;
            for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
                for (const z of [bounds.min.z, bounds.max.z]) {
                    const point = new THREE.Vector3(x, y, z).project(camera);
                    assert(Math.abs(point.x) <= 1 / 1.08 + 1e-6);
                    assert(Math.abs(point.y) <= 1 / 1.08 + 1e-6);
                    extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y));
                }
            }
            assert(extent > 0.92, 'one dimension should fill the available frame');
        }
    }
    disposeBoards();
});

test('Xiangqi symbols stay large and high contrast through all four theme switches', () => {
    const draws = [];
    setCanvasFactory((width, height) => {
        const canvas = createStubCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.fillText = function () { draws.push({ font: this.font, color: this.fillStyle }); };
        return canvas;
    });
    try {
        for (const theme of Object.values(THEMES)) {
            for (const code of ['B_K', 'R_K']) {
                const piece = createXiangqiPiece(code, theme);
                const face = piece.material[1];
                const draw = draws.at(-1);
                assert(parseInt(draw.font.match(/(\d+)px/)[1]) >= 154);
                assert.equal(draw.color, theme.xiangqi[code[0] === 'B' ? 'black' : 'red'].charColor);
                assert.equal(face.emissiveMap, face.map);
                assert.equal(face.emissiveIntensity, 0.3);
                assert.equal(face.map.userData.themeId, theme.id);
            }
        }
        assert.equal(THEMES.vampire.xiangqi.black.fontScale, 0.64);
    } finally {
        setCanvasFactory(null);
        disposeXiangqiPieces();
    }
});

test('engine resize fits mobile, preserves a completed flip, and settles an interrupted flight', () => {
    const engine = Object.create(Engine3D.prototype);
    let rect = { width: 774, height: 461 };
    engine.container = { getBoundingClientRect: () => rect };
    engine.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    engine.camera.position.set(0, 12, -13);
    engine.controls = { target: new THREE.Vector3(), update() { engine.camera.lookAt(this.target); } };
    const sizes = [];
    engine.renderer = { setSize: (w, h) => sizes.push([w, h]) };
    engine.requestRender = () => {};
    engine.view = { cameraPreset: { position: [0, 12, 13], target: [0, 0, 0] },
        cameraBounds: new THREE.Box3(new THREE.Vector3(-5, -0.35, -5), new THREE.Vector3(5, 2, 5)) };
    engine.cameraFlight = { finished: true };
    engine.resize();
    assert(engine.camera.position.z < 0, 'resizing a flipped view keeps its direction');
    const desktop = engine.view.cameraPreset.position[2];
    rect = { width: 325, height: 388 };
    engine.resize();
    assert(engine.view.cameraPreset.position[2] > desktop);
    assert(engine.camera.position.z < 0);
    engine.camera.position.multiplyScalar(1.2);
    const zoomed = engine.camera.position.clone();
    engine.resize();
    assert(engine.camera.position.equals(zoomed), 'quality-only resize keeps user zoom');
    engine.cameraFlight = { cancelled: false };
    engine.camera.position.set(9, 11, 12);
    rect = { width: 400, height: 500 };
    engine.resize();
    assert.equal(engine.camera.position.x, 0, 'a layout resize during the initial flight reaches the preset direction');
    assert.equal(engine.cameraFlight.cancelled, true);
    assert.equal(sizes.length, 4);
    engine.view.state = { flipped: true };
    engine.cameraFlight = { cancelled: false };
    rect = { width: 500, height: 400 };
    engine.resize();
    assert(engine.camera.position.z < 0, 'resizing mid-flip reaches the flipped preset');
});
