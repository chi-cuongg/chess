// Procedural 3D Boards for Chess (8x8), Xiangqi (10x9), and Caro (15x15)
// Generates beveled wooden boards with procedural CanvasTextures
// Provides squareToWorld(row, col) and worldToSquare(point) with 100% exact round-trips.

import * as THREE from 'three';
import { getTheme, DEFAULT_THEME } from './themes.js';
import { createCanvas } from './canvas-util.js';

let currentThemePreset = getTheme(DEFAULT_THEME);
const activeBoards = new Set();
const boardResources = {
    geometries: new Set(),
    materials: new Set(),
    textures: new Set()
};

function trackResource(res) {
    if (!res) return res;
    if (res.isBufferGeometry) boardResources.geometries.add(res);
    else if (res.isMaterial) boardResources.materials.add(res);
    else if (res.isTexture) boardResources.textures.add(res);
    return res;
}

// -------------------------------------------------------------
// Procedural Board Textures
// -------------------------------------------------------------

function drawChessTexture(theme, width = 1024, height = 1024) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const cfg = theme.board;

    const margin = width * 0.06;
    const playWidth = width - margin * 2;
    const sqSize = playWidth / 8;

    // Outer border fill
    ctx.fillStyle = cfg.woodDark || '#3a1e0d';
    ctx.fillRect(0, 0, width, height);

    // Inner playing area
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const isLight = (r + c) % 2 === 0;
            ctx.fillStyle = isLight ? cfg.woodLight : cfg.woodDark;
            ctx.fillRect(margin + c * sqSize, margin + r * sqSize, sqSize, sqSize);
        }
    }

    // Outer trim line
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = width * 0.006;
    ctx.strokeRect(margin, margin, playWidth, playWidth);

    // Coordinate labels: a-h on bottom, 8-1 on left
    ctx.fillStyle = '#f5e6c8';
    ctx.font = `bold ${Math.round(width * 0.024)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let c = 0; c < 8; c++) {
        const x = margin + (c + 0.5) * sqSize;
        ctx.fillText(files[c], x, height - margin * 0.45);
        ctx.fillText(files[c], x, margin * 0.45);
    }
    for (let r = 0; r < 8; r++) {
        const y = margin + (r + 0.5) * sqSize;
        const rank = String(8 - r);
        ctx.fillText(rank, margin * 0.45, y);
        ctx.fillText(rank, width - margin * 0.45, y);
    }

    const tex = new THREE.CanvasTexture(canvas);
    trackResource(tex);
    return tex;
}

function drawXiangqiTexture(theme, width = 1024, height = 1138) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const cfg = theme.board;

    // Wood background
    ctx.fillStyle = cfg.woodLight || '#e8dcc4';
    ctx.fillRect(0, 0, width, height);

    const marginX = width * 0.07;
    const marginY = height * 0.07;
    const playWidth = width - marginX * 2;
    const playHeight = height - marginY * 2;
    const stepX = playWidth / 8;
    const stepY = playHeight / 9;

    // Board line styling
    ctx.strokeStyle = cfg.gridLine || '#5c3a21';
    ctx.lineWidth = width * 0.004;

    // Outer boundary
    ctx.strokeRect(marginX, marginY, playWidth, playHeight);

    // Horizontal lines (10 lines)
    for (let r = 0; r < 10; r++) {
        const y = marginY + r * stepY;
        ctx.beginPath();
        ctx.moveTo(marginX, y);
        ctx.lineTo(marginX + playWidth, y);
        ctx.stroke();
    }

    // Vertical lines (9 lines): lines 1 to 7 do NOT cross the river (between r=4 and r=5)
    for (let c = 0; c < 9; c++) {
        const x = marginX + c * stepX;
        if (c === 0 || c === 8) {
            ctx.beginPath();
            ctx.moveTo(x, marginY);
            ctx.lineTo(x, marginY + playHeight);
            ctx.stroke();
        } else {
            // Top half
            ctx.beginPath();
            ctx.moveTo(x, marginY);
            ctx.lineTo(x, marginY + 4 * stepY);
            ctx.stroke();

            // Bottom half
            ctx.beginPath();
            ctx.moveTo(x, marginY + 5 * stepY);
            ctx.lineTo(x, marginY + playHeight);
            ctx.stroke();
        }
    }

    // Palaces (diagonal X)
    // Top palace: (0,3) to (2,5) and (0,5) to (2,3)
    ctx.beginPath();
    ctx.moveTo(marginX + 3 * stepX, marginY);
    ctx.lineTo(marginX + 5 * stepX, marginY + 2 * stepY);
    ctx.moveTo(marginX + 5 * stepX, marginY);
    ctx.lineTo(marginX + 3 * stepX, marginY + 2 * stepY);
    // Bottom palace: (7,3) to (9,5) and (7,5) to (9,3)
    ctx.moveTo(marginX + 3 * stepX, marginY + 7 * stepY);
    ctx.lineTo(marginX + 5 * stepX, marginY + 9 * stepY);
    ctx.moveTo(marginX + 5 * stepX, marginY + 7 * stepY);
    ctx.lineTo(marginX + 3 * stepX, marginY + 9 * stepY);
    ctx.stroke();

    // River text: "楚 河" and "漢 界"
    ctx.fillStyle = cfg.riverText || '#8b4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(stepY * 0.52)}px "Kaiti", "STKaiti", "Noto Serif SC", "SimSun", serif`;

    const riverY = marginY + 4.5 * stepY;
    ctx.fillText('楚   河', marginX + 2 * stepX, riverY);
    ctx.fillText('漢   界', marginX + 6 * stepX, riverY);

    const tex = new THREE.CanvasTexture(canvas);
    trackResource(tex);
    return tex;
}

function drawCaroTexture(theme, size = 15, width = 1024, height = 1024) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const cfg = theme.board;

    // Wood background
    ctx.fillStyle = cfg.woodLight || '#e8dcc4';
    ctx.fillRect(0, 0, width, height);

    const margin = width * 0.05;
    const playSize = width - margin * 2;
    const cellSize = playSize / size;

    ctx.strokeStyle = cfg.gridLine || '#8b6914';
    ctx.lineWidth = width * 0.003;

    // 15x15 grid lines
    for (let i = 0; i <= size; i++) {
        const pos = margin + i * cellSize;
        // Horizontal
        ctx.beginPath();
        ctx.moveTo(margin, pos);
        ctx.lineTo(margin + playSize, pos);
        ctx.stroke();
        // Vertical
        ctx.beginPath();
        ctx.moveTo(pos, margin);
        ctx.lineTo(pos, margin + playSize);
        ctx.stroke();
    }

    // Traditional star points (hoshi) at (3,3), (3,11), (7,7), (11,3), (11,11)
    const stars = [
        [3.5, 3.5], [3.5, 11.5],
        [7.5, 7.5],
        [11.5, 3.5], [11.5, 11.5]
    ];
    ctx.fillStyle = cfg.gridLine || '#5c3a21';
    for (const [sc, sr] of stars) {
        ctx.beginPath();
        ctx.arc(margin + sc * cellSize, margin + sr * cellSize, width * 0.006, 0, Math.PI * 2);
        ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    trackResource(tex);
    return tex;
}

// -------------------------------------------------------------
// Beveled Box Board Geometry Builder
// -------------------------------------------------------------

function buildBeveledBoardMesh(width, depth, thickness, bevel, topTexture, theme) {
    const cfg = theme.board;

    // Top face mesh (playing area with CanvasTexture)
    const topGeom = trackResource(new THREE.PlaneGeometry(width, depth));
    topGeom.rotateX(-Math.PI / 2);
    // Position exactly at y = 0
    topGeom.translate(0, 0.001, 0);

    const topMat = trackResource(new THREE.MeshStandardMaterial({
        map: topTexture,
        roughness: cfg.roughness || 0.45,
        metalness: cfg.metalness || 0.1
    }));
    const topMesh = new THREE.Mesh(topGeom, topMat);
    topMesh.receiveShadow = true;

    // Beveled frame / pedestal underneath
    const frameGeom = trackResource(new THREE.BoxGeometry(
        width + bevel * 2,
        thickness,
        depth + bevel * 2
    ));
    frameGeom.translate(0, -thickness / 2, 0);

    const frameMat = trackResource(new THREE.MeshStandardMaterial({
        color: cfg.border || 0x331a0a,
        roughness: 0.35,
        metalness: 0.15
    }));
    const frameMesh = new THREE.Mesh(frameGeom, frameMat);
    frameMesh.receiveShadow = true;
    frameMesh.castShadow = true;

    // Thin decorative gold/accent trim rim
    const trimGeom = trackResource(new THREE.BoxGeometry(
        width + bevel * 0.4,
        thickness * 0.1,
        depth + bevel * 0.4
    ));
    trimGeom.translate(0, -thickness * 0.05, 0);

    const trimMat = trackResource(new THREE.MeshStandardMaterial({
        color: cfg.borderTrim || 0xb8860b,
        roughness: 0.25,
        metalness: 0.6
    }));
    const trimMesh = new THREE.Mesh(trimGeom, trimMat);

    const group = new THREE.Group();
    group.add(frameMesh);
    group.add(trimMesh);
    group.add(topMesh);

    return { group, topMesh, frameMesh };
}

// -------------------------------------------------------------
// Factory: createChessBoard
// -------------------------------------------------------------

/**
 * Creates 3D Chess Board (8x8)
 * @param {object} [options]
 * @returns {{ group: THREE.Group, squareToWorld: Function, worldToSquare: Function }}
 */
export function createChessBoard(options = {}) {
    const theme = getTheme(options.theme || currentThemePreset);
    const squareSize = options.squareSize || 1.0;
    const boardWidth = 8 * squareSize;
    const boardDepth = 8 * squareSize;
    const thickness = options.thickness || 0.35;
    const bevel = options.bevel || 0.5;
    const surfaceY = 0;

    const texture = drawChessTexture(theme);
    const { group } = buildBeveledBoardMesh(boardWidth, boardDepth, thickness, bevel, texture, theme);

    function squareToWorld(row, col) {
        return new THREE.Vector3(
            (col - 3.5) * squareSize,
            surfaceY,
            (row - 3.5) * squareSize
        );
    }

    function worldToSquare(point) {
        if (!point) return null;
        const col = Math.floor((point.x / squareSize) + 4.0);
        const row = Math.floor((point.z / squareSize) + 4.0);
        if (row >= 0 && row < 8 && col >= 0 && col < 8) {
            return { row, col };
        }
        return null;
    }

    const result = { group, squareToWorld, worldToSquare };
    activeBoards.add(result);
    return result;
}

// -------------------------------------------------------------
// Factory: createXiangqiBoard
// -------------------------------------------------------------

/**
 * Creates 3D Xiangqi Board (10 rows x 9 cols)
 * @param {object} [options]
 * @returns {{ group: THREE.Group, squareToWorld: Function, worldToSquare: Function }}
 */
export function createXiangqiBoard(options = {}) {
    const theme = getTheme(options.theme || currentThemePreset);
    const spacingX = options.spacingX || 1.0;
    const spacingZ = options.spacingZ || 1.0;
    const boardWidth = 8 * spacingX + 0.8;
    const boardDepth = 9 * spacingZ + 0.8;
    const thickness = options.thickness || 0.35;
    const bevel = options.bevel || 0.5;
    const surfaceY = 0;

    const texture = drawXiangqiTexture(theme);
    const { group } = buildBeveledBoardMesh(boardWidth, boardDepth, thickness, bevel, texture, theme);

    function squareToWorld(row, col) {
        return new THREE.Vector3(
            (col - 4.0) * spacingX,
            surfaceY,
            (row - 4.5) * spacingZ
        );
    }

    function worldToSquare(point) {
        if (!point) return null;
        const col = Math.round((point.x / spacingX) + 4.0);
        const row = Math.round((point.z / spacingZ) + 4.5);
        if (row >= 0 && row < 10 && col >= 0 && col < 9) {
            const dx = Math.abs(point.x - (col - 4.0) * spacingX);
            const dz = Math.abs(point.z - (row - 4.5) * spacingZ);
            if (dx <= spacingX * 0.5 && dz <= spacingZ * 0.5) {
                return { row, col };
            }
        }
        return null;
    }

    const result = { group, squareToWorld, worldToSquare };
    activeBoards.add(result);
    return result;
}

// -------------------------------------------------------------
// Factory: createXOBoard
// -------------------------------------------------------------

/**
 * Creates 3D Caro Board (size x size, default 15x15)
 * @param {number} [size=15]
 * @param {object} [options]
 * @returns {{ group: THREE.Group, squareToWorld: Function, worldToSquare: Function }}
 */
export function createXOBoard(size = 15, options = {}) {
    const theme = getTheme(options.theme || currentThemePreset);
    const cellSize = options.cellSize || 0.6;
    const boardWidth = size * cellSize;
    const boardDepth = size * cellSize;
    const thickness = options.thickness || 0.35;
    const bevel = options.bevel || 0.45;
    const surfaceY = 0;

    const texture = drawCaroTexture(theme, size);
    const { group } = buildBeveledBoardMesh(boardWidth, boardDepth, thickness, bevel, texture, theme);

    function squareToWorld(row, col) {
        return new THREE.Vector3(
            (col - (size - 1) / 2) * cellSize,
            surfaceY,
            (row - (size - 1) / 2) * cellSize
        );
    }

    function worldToSquare(point) {
        if (!point) return null;
        const col = Math.floor((point.x / cellSize) + size / 2);
        const row = Math.floor((point.z / cellSize) + size / 2);
        if (row >= 0 && row < size && col >= 0 && col < size) {
            return { row, col };
        }
        return null;
    }

    const result = { group, squareToWorld, worldToSquare };
    activeBoards.add(result);
    return result;
}

export function setBoardTheme(themePreset) {
    currentThemePreset = getTheme(themePreset);
}

export function disposeBoards() {
    for (const b of activeBoards) {
        if (b.group) {
            b.group.traverse((obj) => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
        }
    }
    activeBoards.clear();

    for (const g of boardResources.geometries) g.dispose();
    boardResources.geometries.clear();

    for (const m of boardResources.materials) m.dispose();
    boardResources.materials.clear();

    for (const t of boardResources.textures) t.dispose();
    boardResources.textures.clear();
}

export function dispose() {
    disposeBoards();
}
