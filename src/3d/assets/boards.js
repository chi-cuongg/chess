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

function drawChessTexture(theme, boardWidth = 9.0, boardDepth = 9.0, squareSize = 1.0, margin = 0.5, width = 1024, height = 1024) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const cfg = theme.board;

    const marginX = (margin / boardWidth) * width;
    const marginY = (margin / boardDepth) * height;
    const playWidth = width - marginX * 2;
    const playHeight = height - marginY * 2;
    const sqSizeX = playWidth / 8;
    const sqSizeY = playHeight / 8;

    // Outer border fill
    ctx.fillStyle = cfg.woodDark || '#3a1e0d';
    ctx.fillRect(0, 0, width, height);

    // Inner playing area
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const isLight = (r + c) % 2 === 0;
            ctx.fillStyle = isLight ? cfg.woodLight : cfg.woodDark;
            ctx.fillRect(marginX + c * sqSizeX, marginY + r * sqSizeY, sqSizeX, sqSizeY);
        }
    }

    // Outer trim line
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = width * 0.006;
    ctx.strokeRect(marginX, marginY, playWidth, playHeight);

    // Coordinate labels: a-h on bottom and top, 8-1 on left and right
    ctx.fillStyle = '#f5e6c8';
    ctx.font = `bold ${Math.round(width * 0.024)}px "Segoe UI", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    for (let c = 0; c < 8; c++) {
        const x = marginX + (c + 0.5) * sqSizeX;
        ctx.fillText(files[c], x, height - marginY * 0.45);
        ctx.fillText(files[c], x, marginY * 0.45);
    }
    for (let r = 0; r < 8; r++) {
        const y = marginY + (r + 0.5) * sqSizeY;
        const rank = String(8 - r);
        ctx.fillText(rank, marginX * 0.45, y);
        ctx.fillText(rank, width - marginX * 0.45, y);
    }

    const tex = new THREE.CanvasTexture(canvas);
    trackResource(tex);
    return tex;
}

function drawXiangqiTexture(theme, boardWidth = 9.0, boardDepth = 10.0, spacingX = 1.0, spacingZ = 1.0, marginX = 0.5, marginZ = 0.5, width = 1024, height = 1138) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const cfg = theme.board;

    // Wood background
    ctx.fillStyle = cfg.woodLight || '#e8dcc4';
    ctx.fillRect(0, 0, width, height);

    const marginX_px = (marginX / boardWidth) * width;
    const marginY_px = (marginZ / boardDepth) * height;
    const playWidth = width - marginX_px * 2;
    const playHeight = height - marginY_px * 2;
    const stepX = playWidth / 8;
    const stepY = playHeight / 9;

    // Board line styling
    ctx.strokeStyle = cfg.gridLine || '#5c3a21';
    ctx.lineWidth = width * 0.004;

    // Outer boundary
    ctx.strokeRect(marginX_px, marginY_px, playWidth, playHeight);

    // Horizontal lines (10 lines)
    for (let r = 0; r < 10; r++) {
        const y = marginY_px + r * stepY;
        ctx.beginPath();
        ctx.moveTo(marginX_px, y);
        ctx.lineTo(marginX_px + playWidth, y);
        ctx.stroke();
    }

    // Vertical lines (9 lines): lines 1 to 7 do NOT cross the river (between r=4 and r=5)
    for (let c = 0; c < 9; c++) {
        const x = marginX_px + c * stepX;
        if (c === 0 || c === 8) {
            ctx.beginPath();
            ctx.moveTo(x, marginY_px);
            ctx.lineTo(x, marginY_px + playHeight);
            ctx.stroke();
        } else {
            // Top half
            ctx.beginPath();
            ctx.moveTo(x, marginY_px);
            ctx.lineTo(x, marginY_px + 4 * stepY);
            ctx.stroke();

            // Bottom half
            ctx.beginPath();
            ctx.moveTo(x, marginY_px + 5 * stepY);
            ctx.lineTo(x, marginY_px + playHeight);
            ctx.stroke();
        }
    }

    // Palaces (diagonal X)
    // Top palace: (0,3) to (2,5) and (0,5) to (2,3)
    ctx.beginPath();
    ctx.moveTo(marginX_px + 3 * stepX, marginY_px);
    ctx.lineTo(marginX_px + 5 * stepX, marginY_px + 2 * stepY);
    ctx.moveTo(marginX_px + 5 * stepX, marginY_px);
    ctx.lineTo(marginX_px + 3 * stepX, marginY_px + 2 * stepY);
    // Bottom palace: (7,3) to (9,5) and (7,5) to (9,3)
    ctx.moveTo(marginX_px + 3 * stepX, marginY_px + 7 * stepY);
    ctx.lineTo(marginX_px + 5 * stepX, marginY_px + 9 * stepY);
    ctx.moveTo(marginX_px + 5 * stepX, marginY_px + 7 * stepY);
    ctx.lineTo(marginX_px + 3 * stepX, marginY_px + 9 * stepY);
    ctx.stroke();

    // River text: "楚 河" and "漢 界"
    ctx.fillStyle = cfg.riverText || '#8b4513';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(stepY * 0.52)}px "Kaiti", "STKaiti", "Noto Serif SC", "SimSun", serif`;

    const riverY = marginY_px + 4.5 * stepY;
    ctx.fillText('楚   河', marginX_px + 2 * stepX, riverY);
    ctx.fillText('漢   界', marginX_px + 6 * stepX, riverY);

    const tex = new THREE.CanvasTexture(canvas);
    trackResource(tex);
    return tex;
}

function drawCaroTexture(theme, size = 15, boardWidth = 9.6, boardDepth = 9.6, cellSize = 0.6, margin = 0.3, width = 1024, height = 1024) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const cfg = theme.board;

    // Wood background
    ctx.fillStyle = cfg.woodLight || '#e8dcc4';
    ctx.fillRect(0, 0, width, height);

    const marginX_px = (margin / boardWidth) * width;
    const marginY_px = (margin / boardDepth) * height;
    const playWidth = width - marginX_px * 2;
    const playHeight = height - marginY_px * 2;
    const cellWidth = playWidth / size;
    const cellHeight = playHeight / size;

    ctx.strokeStyle = cfg.gridLine || '#8b6914';
    ctx.lineWidth = width * 0.003;

    // 15x15 grid lines (16 lines each direction)
    for (let i = 0; i <= size; i++) {
        const posX = marginX_px + i * cellWidth;
        const posY = marginY_px + i * cellHeight;
        // Horizontal
        ctx.beginPath();
        ctx.moveTo(marginX_px, posY);
        ctx.lineTo(marginX_px + playWidth, posY);
        ctx.stroke();
        // Vertical
        ctx.beginPath();
        ctx.moveTo(posX, marginY_px);
        ctx.lineTo(posX, marginY_px + playHeight);
        ctx.stroke();
    }

    // Traditional star points (hoshi) at (3.5, 3.5), (3.5, 11.5), etc.
    const stars = [
        [3.5, 3.5], [3.5, 11.5],
        [7.5, 7.5],
        [11.5, 3.5], [11.5, 11.5]
    ];
    ctx.fillStyle = cfg.gridLine || '#5c3a21';
    for (const [sc, sr] of stars) {
        ctx.beginPath();
        ctx.arc(marginX_px + sc * cellWidth, marginY_px + sr * cellHeight, width * 0.006, 0, Math.PI * 2);
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
 * @returns {{ group: THREE.Group, squareToWorld: Function, worldToSquare: Function, textureSquareToWorld: Function }}
 */
export function createChessBoard(options = {}) {
    const theme = getTheme(options.theme || currentThemePreset);
    const squareSize = options.squareSize || 1.0;
    const margin = options.margin !== undefined ? options.margin : 0.5 * squareSize;
    const boardWidth = 8 * squareSize + 2 * margin;
    const boardDepth = 8 * squareSize + 2 * margin;
    const thickness = options.thickness || 0.35;
    const bevel = options.bevel || 0.5;
    const surfaceY = 0;

    const texture = drawChessTexture(theme, boardWidth, boardDepth, squareSize, margin);
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

    function textureSquareToWorld(row, col) {
        const u = (margin + (col + 0.5) * squareSize) / boardWidth;
        const v = (margin + (row + 0.5) * squareSize) / boardDepth;
        return new THREE.Vector3((u - 0.5) * boardWidth, surfaceY, (v - 0.5) * boardDepth);
    }

    const result = { group, squareToWorld, worldToSquare, textureSquareToWorld };
    activeBoards.add(result);
    return result;
}

// -------------------------------------------------------------
// Factory: createXiangqiBoard
// -------------------------------------------------------------

/**
 * Creates 3D Xiangqi Board (10 rows x 9 cols)
 * @param {object} [options]
 * @returns {{ group: THREE.Group, squareToWorld: Function, worldToSquare: Function, textureSquareToWorld: Function }}
 */
export function createXiangqiBoard(options = {}) {
    const theme = getTheme(options.theme || currentThemePreset);
    const spacingX = options.spacingX || 1.0;
    const spacingZ = options.spacingZ || 1.0;
    const marginX = options.marginX !== undefined ? options.marginX : 0.5 * spacingX;
    const marginZ = options.marginZ !== undefined ? options.marginZ : 0.5 * spacingZ;
    const boardWidth = 8 * spacingX + 2 * marginX;
    const boardDepth = 9 * spacingZ + 2 * marginZ;
    const thickness = options.thickness || 0.35;
    const bevel = options.bevel || 0.5;
    const surfaceY = 0;

    const texture = drawXiangqiTexture(theme, boardWidth, boardDepth, spacingX, spacingZ, marginX, marginZ);
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

    function textureSquareToWorld(row, col) {
        const u = (marginX + col * spacingX) / boardWidth;
        const v = (marginZ + row * spacingZ) / boardDepth;
        return new THREE.Vector3((u - 0.5) * boardWidth, surfaceY, (v - 0.5) * boardDepth);
    }

    const result = { group, squareToWorld, worldToSquare, textureSquareToWorld };
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
 * @returns {{ group: THREE.Group, squareToWorld: Function, worldToSquare: Function, textureSquareToWorld: Function }}
 */
export function createXOBoard(size = 15, options = {}) {
    const theme = getTheme(options.theme || currentThemePreset);
    const cellSize = options.cellSize || 0.6;
    const margin = options.margin !== undefined ? options.margin : 0.5 * cellSize;
    const boardWidth = size * cellSize + 2 * margin;
    const boardDepth = size * cellSize + 2 * margin;
    const thickness = options.thickness || 0.35;
    const bevel = options.bevel || 0.45;
    const surfaceY = 0;

    const texture = drawCaroTexture(theme, size, boardWidth, boardDepth, cellSize, margin);
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

    function textureSquareToWorld(row, col) {
        const u = (margin + (col + 0.5) * cellSize) / boardWidth;
        const v = (margin + (row + 0.5) * cellSize) / boardDepth;
        return new THREE.Vector3((u - 0.5) * boardWidth, surfaceY, (v - 0.5) * boardDepth);
    }

    const result = { group, squareToWorld, worldToSquare, textureSquareToWorld };
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
