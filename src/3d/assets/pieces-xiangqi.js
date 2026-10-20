// Procedural 3D Xiangqi Pieces
// Cylinder disc with beveled edge and procedural CanvasTexture Chinese characters.
// Supports 7 piece types for Red and Black (14 total).
// Triangle count <= 3000. Geometries and textures are cached.

import * as THREE from 'three';
import { getTheme, DEFAULT_THEME } from './themes.js';
import { createXiangqiSymbolTexture } from './canvas-util.js';

export const XIANGQI_PIECES = {
    'R_K': { symbol: '帥', color: 'red', name: 'General' },
    'R_A': { symbol: '仕', color: 'red', name: 'Advisor' },
    'R_E': { symbol: '相', color: 'red', name: 'Elephant' },
    'R_H': { symbol: '傌', color: 'red', name: 'Horse' },
    'R_R': { symbol: '俥', color: 'red', name: 'Chariot' },
    'R_C': { symbol: '炮', color: 'red', name: 'Cannon' },
    'R_P': { symbol: '兵', color: 'red', name: 'Soldier' },

    'B_K': { symbol: '將', color: 'black', name: 'General' },
    'B_A': { symbol: '士', color: 'black', name: 'Advisor' },
    'B_E': { symbol: '象', color: 'black', name: 'Elephant' },
    'B_H': { symbol: '馬', color: 'black', name: 'Horse' },
    'B_R': { symbol: '車', color: 'black', name: 'Chariot' },
    'B_C': { symbol: '砲', color: 'black', name: 'Cannon' },
    'B_P': { symbol: '卒', color: 'black', name: 'Soldier' }
};

let sharedDiscGeometry = null;
const textureCache = new Map();
const materialCache = new Map();
let currentThemePreset = getTheme(DEFAULT_THEME);

function getOrCreateDiscGeometry() {
    if (sharedDiscGeometry) return sharedDiscGeometry;

    // Beveled disc: radiusTop 0.41, radiusBottom 0.43, height 0.16, 36 segments
    const geom = new THREE.CylinderGeometry(0.41, 0.43, 0.16, 36);
    geom.translate(0, 0.08, 0); // Ground at y = 0
    geom.computeVertexNormals();
    sharedDiscGeometry = geom;
    return geom;
}

export function parseXiangqiCode(code) {
    if (!code) return { code: 'R_K', info: XIANGQI_PIECES['R_K'] };
    const clean = String(code).trim().toUpperCase();
    if (XIANGQI_PIECES[clean]) {
        return { code: clean, info: XIANGQI_PIECES[clean] };
    }
    // Try underscore normalization
    const parts = clean.split('_');
    if (parts.length === 2) {
        const colorPrefix = parts[0].startsWith('R') ? 'R' : 'B';
        const typeChar = parts[1][0];
        const key = `${colorPrefix}_${typeChar}`;
        if (XIANGQI_PIECES[key]) {
            return { code: key, info: XIANGQI_PIECES[key] };
        }
    }
    return { code: 'R_K', info: XIANGQI_PIECES['R_K'] };
}

function getOrCreateSymbolTexture(code, info, theme) {
    const cached = textureCache.get(code);
    if (cached?.userData.themeId === theme.id) return cached;
    cached?.dispose();

    const isRed = info.color === 'red';
    const cfg = isRed ? theme.xiangqi.red : theme.xiangqi.black;

    // Disc face background color: light ivory/cream for contrast, or themed
    let discBg = isRed ? '#f5e8d0' : '#21170e';
    if (theme.id === 'cyber') {
        discBg = isRed ? '#20081c' : '#081c24';
    } else if (theme.id === 'vampire') {
        discBg = isRed ? '#300a12' : '#1e1418';
    }

    const texture = createXiangqiSymbolTexture({
        symbol: info.symbol,
        charColor: cfg.charColor,
        ringColor: cfg.ringColor,
        discBgColor: discBg,
        fontScale: cfg.fontScale || 0.60,
        width: 256,
        height: 256
    });

    texture.userData.themeId = theme.id;
    textureCache.set(code, texture);
    return texture;
}

function getOrCreateMaterials(code, info, theme) {
    const key = code;

    const isRed = info.color === 'red';
    const cfg = isRed ? theme.xiangqi.red : theme.xiangqi.black;
    const symbolTexture = getOrCreateSymbolTexture(code, info, theme);

    if (materialCache.has(key)) {
        const mats = materialCache.get(key);
        for (const material of [mats[0], mats[2]]) {
            material.color.setHex(cfg.discColor);
            material.roughness = cfg.roughness;
            material.metalness = cfg.metalness;
        }
        mats[1].map = symbolTexture;
        mats[1].emissiveMap = symbolTexture;
        mats[1].emissive.setHex(0xffffff);
        mats[1].emissiveIntensity = 0.3;
        mats[1].roughness = cfg.roughness * 0.9;
        mats[1].metalness = cfg.metalness * 0.5;
        mats[1].needsUpdate = true;
        return mats;
    }

    // 0: side, 1: top, 2: bottom
    const sideMat = new THREE.MeshStandardMaterial({
        color: cfg.discColor,
        roughness: cfg.roughness,
        metalness: cfg.metalness
    });

    const topMat = new THREE.MeshStandardMaterial({
        map: symbolTexture,
        emissiveMap: symbolTexture,
        emissive: 0xffffff,
        emissiveIntensity: 0.3,
        roughness: cfg.roughness * 0.9,
        metalness: cfg.metalness * 0.5
    });

    const bottomMat = new THREE.MeshStandardMaterial({
        color: cfg.discColor,
        roughness: cfg.roughness,
        metalness: cfg.metalness
    });

    const mats = [sideMat, topMat, bottomMat];
    materialCache.set(key, mats);
    return mats;
}

/**
 * Creates a Xiangqi 3D piece Object3D
 * @param {string} code - e.g. 'R_K', 'R_C', 'B_P', etc.
 * @param {object|string} [themePreset] - optional theme preset
 * @returns {THREE.Mesh}
 */
export function createXiangqiPiece(code, themePreset = null) {
    const { code: normCode, info } = parseXiangqiCode(code);
    const theme = getTheme(themePreset || currentThemePreset);
    currentThemePreset = theme;

    const geom = getOrCreateDiscGeometry();
    const materials = getOrCreateMaterials(normCode, info, theme);

    const mesh = new THREE.Mesh(geom, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
        code: normCode,
        symbol: info.symbol,
        color: info.color,
        name: info.name
    };

    return mesh;
}

export function setXiangqiTheme(themePreset) {
    currentThemePreset = getTheme(themePreset);
    for (const code of materialCache.keys()) getOrCreateMaterials(code, XIANGQI_PIECES[code], currentThemePreset);
}

export function disposeXiangqiPieces() {
    if (sharedDiscGeometry) {
        sharedDiscGeometry.dispose();
        sharedDiscGeometry = null;
    }

    for (const tex of textureCache.values()) {
        tex.dispose();
    }
    textureCache.clear();

    for (const mats of materialCache.values()) {
        for (const m of mats) m.dispose();
    }
    materialCache.clear();
}

export function dispose() {
    disposeXiangqiPieces();
}
