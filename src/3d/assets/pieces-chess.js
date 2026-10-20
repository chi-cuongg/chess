// Procedural 3D Chess Pieces
// Generates 6 Staunton chess pieces using LatheGeometry and ExtrudeGeometry
// King (cross finial), Queen (crenellated coronet), Bishop (diagonal slit),
// Rook (crenellated battlements), Knight (extruded beveled horse head), Pawn.
// Triangle count per piece <= 3000. Geometries are cached.

import * as THREE from 'three';
import { getTheme, DEFAULT_THEME } from './themes.js';

// Cache for BufferGeometries
const geometryCache = new Map();

// Materials cache by theme
let currentThemePreset = getTheme(DEFAULT_THEME);
let whiteMaterial = null;
let blackMaterial = null;

function ensureMaterials(themePreset) {
    const theme = getTheme(themePreset || currentThemePreset);
    currentThemePreset = theme;

    const w = theme.chess.white;
    const b = theme.chess.black;

    if (!whiteMaterial) {
        whiteMaterial = new THREE.MeshStandardMaterial({
            color: w.color,
            roughness: w.roughness,
            metalness: w.metalness,
            emissive: w.emissive || 0x000000
        });
    } else {
        whiteMaterial.color.setHex(w.color);
        whiteMaterial.roughness = w.roughness;
        whiteMaterial.metalness = w.metalness;
        whiteMaterial.emissive.setHex(w.emissive || 0x000000);
        whiteMaterial.needsUpdate = true;
    }

    if (!blackMaterial) {
        blackMaterial = new THREE.MeshStandardMaterial({
            color: b.color,
            roughness: b.roughness,
            metalness: b.metalness,
            emissive: b.emissive || 0x000000
        });
    } else {
        blackMaterial.color.setHex(b.color);
        blackMaterial.roughness = b.roughness;
        blackMaterial.metalness = b.metalness;
        blackMaterial.emissive.setHex(b.emissive || 0x000000);
        blackMaterial.needsUpdate = true;
    }

    return { white: whiteMaterial, black: blackMaterial };
}

// Helper: merge buffer geometries into one
function mergeGeometries(geometries) {
    let totalPositions = 0;
    let totalNormals = 0;
    let totalIndices = 0;

    for (const g of geometries) {
        const geom = g.index ? g.toNonIndexed() : g;
        totalPositions += geom.attributes.position.count;
    }

    const mergedPositions = new Float32Array(totalPositions * 3);
    const mergedNormals = new Float32Array(totalPositions * 3);
    let offset = 0;

    for (const g of geometries) {
        const geom = g.index ? g.toNonIndexed() : g;
        const pos = geom.attributes.position.array;
        const norm = geom.attributes.normal ? geom.attributes.normal.array : null;

        mergedPositions.set(pos, offset * 3);
        if (norm) {
            mergedNormals.set(norm, offset * 3);
        } else {
            // Generate dummy normals if missing
            for (let i = 0; i < geom.attributes.position.count * 3; i += 3) {
                mergedNormals[offset * 3 + i + 1] = 1.0;
            }
        }
        offset += geom.attributes.position.count;
    }

    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
    merged.computeVertexNormals();
    return merged;
}

// 1. PAWN GEOMETRY
function buildPawnGeometry() {
    const pts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.36, 0),
        new THREE.Vector2(0.36, 0.05),
        new THREE.Vector2(0.33, 0.09),
        new THREE.Vector2(0.28, 0.14),
        new THREE.Vector2(0.23, 0.20),
        new THREE.Vector2(0.18, 0.35),
        new THREE.Vector2(0.15, 0.52),
        new THREE.Vector2(0.19, 0.56),
        new THREE.Vector2(0.19, 0.59),
        new THREE.Vector2(0.13, 0.61)
    ];

    // Spherical head
    const headRadius = 0.135;
    const headCenterY = 0.745;
    const numArc = 10;
    for (let i = 0; i <= numArc; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / numArc;
        const r = Math.max(0, headRadius * Math.cos(a));
        const y = headCenterY + headRadius * Math.sin(a);
        pts.push(new THREE.Vector2(r, y));
    }

    const geom = new THREE.LatheGeometry(pts, 24);
    geom.computeVertexNormals();
    return geom;
}

// 2. ROOK GEOMETRY
function buildRookGeometry() {
    // Body lathe
    const pts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.38, 0),
        new THREE.Vector2(0.38, 0.06),
        new THREE.Vector2(0.34, 0.11),
        new THREE.Vector2(0.29, 0.18),
        new THREE.Vector2(0.24, 0.26),
        new THREE.Vector2(0.21, 0.50),
        new THREE.Vector2(0.22, 0.72),
        new THREE.Vector2(0.27, 0.78),
        new THREE.Vector2(0.31, 0.84),
        new THREE.Vector2(0.31, 0.90),
        new THREE.Vector2(0.23, 0.90),
        new THREE.Vector2(0.23, 0.84),
        new THREE.Vector2(0, 0.84)
    ];

    const bodyGeom = new THREE.LatheGeometry(pts, 24);

    // 4 Crenellations (merlons)
    const geoms = [bodyGeom];
    const merlonWidth = 0.14;
    const merlonHeight = 0.14;
    const merlonDepth = 0.10;
    const radius = 0.27;

    for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const box = new THREE.BoxGeometry(merlonWidth, merlonHeight, merlonDepth);
        box.rotateY(angle);
        box.translate(
            Math.cos(angle) * radius,
            0.90 + merlonHeight / 2,
            Math.sin(angle) * radius
        );
        geoms.push(box);
    }

    const merged = mergeGeometries(geoms);
    for (let i = 1; i < geoms.length; i++) {
        geoms[i].dispose();
    }
    bodyGeom.dispose();
    return merged;
}

// 3. KNIGHT GEOMETRY (Extruded beveled horse head atop lathe base)
function buildKnightGeometry() {
    // Pedestal
    const basePts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.38, 0),
        new THREE.Vector2(0.38, 0.06),
        new THREE.Vector2(0.34, 0.11),
        new THREE.Vector2(0.29, 0.18),
        new THREE.Vector2(0.26, 0.25),
        new THREE.Vector2(0.24, 0.32),
        new THREE.Vector2(0, 0.32)
    ];
    const baseGeom = new THREE.LatheGeometry(basePts, 24);

    // Horse head shape (side silhouette in X-Y)
    const shape = new THREE.Shape();
    shape.moveTo(-0.16, 0.32);
    shape.lineTo(0.18, 0.32);
    shape.quadraticCurveTo(0.22, 0.44, 0.28, 0.54);
    shape.lineTo(0.32, 0.60);
    shape.lineTo(0.25, 0.64);
    shape.lineTo(0.22, 0.72);
    shape.quadraticCurveTo(0.16, 0.82, 0.10, 0.90);
    shape.lineTo(0.08, 1.05); // ear tip
    shape.lineTo(0.02, 0.94); // back of ear
    shape.quadraticCurveTo(-0.06, 0.92, -0.14, 0.82);
    shape.quadraticCurveTo(-0.21, 0.68, -0.22, 0.52);
    shape.quadraticCurveTo(-0.20, 0.40, -0.16, 0.32);

    const extrudeSettings = {
        steps: 1,
        depth: 0.20,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 2
    };

    const headGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // Center head on Z
    headGeom.translate(0, 0, -0.13);

    const merged = mergeGeometries([baseGeom, headGeom]);
    baseGeom.dispose();
    headGeom.dispose();
    return merged;
}

// 4. BISHOP GEOMETRY (with diagonal mitre slit groove)
function buildBishopGeometry() {
    const pts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.37, 0),
        new THREE.Vector2(0.37, 0.06),
        new THREE.Vector2(0.33, 0.10),
        new THREE.Vector2(0.28, 0.16),
        new THREE.Vector2(0.23, 0.24),
        new THREE.Vector2(0.18, 0.45),
        new THREE.Vector2(0.16, 0.65),
        new THREE.Vector2(0.23, 0.70), // collar
        new THREE.Vector2(0.23, 0.74),
        new THREE.Vector2(0.16, 0.76)
    ];

    // Oval mitre head
    const numHead = 12;
    for (let i = 0; i <= numHead; i++) {
        const a = -Math.PI / 2 + (Math.PI * i) / numHead;
        const r = Math.max(0, 0.20 * Math.cos(a));
        const y = 1.00 + 0.23 * Math.sin(a);
        pts.push(new THREE.Vector2(r, y));
    }

    // Top small sphere finial
    pts.push(new THREE.Vector2(0.04, 1.25));
    pts.push(new THREE.Vector2(0.05, 1.28));
    pts.push(new THREE.Vector2(0, 1.32));

    const bodyGeom = new THREE.LatheGeometry(pts, 24);

    // Diagonal mitre slit (recessed cut)
    const slitBox = new THREE.BoxGeometry(0.04, 0.18, 0.32);
    slitBox.rotateZ(Math.PI / 5);
    slitBox.translate(0.12, 1.05, 0);

    const merged = mergeGeometries([bodyGeom, slitBox]);
    bodyGeom.dispose();
    slitBox.dispose();
    return merged;
}

// 5. QUEEN GEOMETRY (coronet with crenellated points and pearl)
function buildQueenGeometry() {
    const pts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.39, 0),
        new THREE.Vector2(0.39, 0.06),
        new THREE.Vector2(0.35, 0.11),
        new THREE.Vector2(0.29, 0.18),
        new THREE.Vector2(0.23, 0.26),
        new THREE.Vector2(0.18, 0.50),
        new THREE.Vector2(0.17, 0.75),
        new THREE.Vector2(0.24, 0.82), // lower collar
        new THREE.Vector2(0.24, 0.86),
        new THREE.Vector2(0.17, 0.89),
        new THREE.Vector2(0.18, 1.08), // neck
        new THREE.Vector2(0.28, 1.25), // coronet flare
        new THREE.Vector2(0.29, 1.33),
        new THREE.Vector2(0.25, 1.33),
        new THREE.Vector2(0.20, 1.26),
        new THREE.Vector2(0.06, 1.28),
        new THREE.Vector2(0, 1.29)
    ];

    const bodyGeom = new THREE.LatheGeometry(pts, 24);
    const geoms = [bodyGeom];

    // Coronet teeth: 8 points around the rim
    const numPoints = 8;
    const rimRadius = 0.28;
    for (let i = 0; i < numPoints; i++) {
        const a = (i * 2 * Math.PI) / numPoints;
        const tooth = new THREE.ConeGeometry(0.035, 0.09, 8);
        tooth.translate(
            Math.cos(a) * rimRadius,
            1.36,
            Math.sin(a) * rimRadius
        );
        geoms.push(tooth);
    }

    // Queen center pearl
    const pearl = new THREE.SphereGeometry(0.06, 12, 10);
    pearl.translate(0, 1.38, 0);
    geoms.push(pearl);

    const merged = mergeGeometries(geoms);
    for (let i = 1; i < geoms.length; i++) {
        geoms[i].dispose();
    }
    bodyGeom.dispose();
    return merged;
}

// 6. KING GEOMETRY (with finial Cross)
function buildKingGeometry() {
    const pts = [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.40, 0),
        new THREE.Vector2(0.40, 0.06),
        new THREE.Vector2(0.36, 0.11),
        new THREE.Vector2(0.30, 0.18),
        new THREE.Vector2(0.24, 0.27),
        new THREE.Vector2(0.19, 0.55),
        new THREE.Vector2(0.18, 0.82),
        new THREE.Vector2(0.26, 0.90), // collar
        new THREE.Vector2(0.26, 0.94),
        new THREE.Vector2(0.18, 0.97),
        new THREE.Vector2(0.20, 1.15),
        new THREE.Vector2(0.31, 1.34), // flared crown
        new THREE.Vector2(0.32, 1.40),
        new THREE.Vector2(0.26, 1.44),
        new THREE.Vector2(0.12, 1.44),
        new THREE.Vector2(0.08, 1.47),
        new THREE.Vector2(0, 1.47)
    ];

    const bodyGeom = new THREE.LatheGeometry(pts, 24);
    const geoms = [bodyGeom];

    // Finial Cross: vertical beam
    const vBeam = new THREE.BoxGeometry(0.05, 0.20, 0.04);
    vBeam.translate(0, 1.57, 0);
    geoms.push(vBeam);

    // Horizontal crossbeam
    const hBeam = new THREE.BoxGeometry(0.15, 0.045, 0.04);
    hBeam.translate(0, 1.60, 0);
    geoms.push(hBeam);

    const merged = mergeGeometries(geoms);
    for (let i = 1; i < geoms.length; i++) {
        geoms[i].dispose();
    }
    bodyGeom.dispose();
    return merged;
}

function getOrCreateGeometry(type) {
    if (geometryCache.has(type)) {
        return geometryCache.get(type);
    }

    let geom = null;
    switch (type) {
        case 'p':
            geom = buildPawnGeometry();
            break;
        case 'r':
            geom = buildRookGeometry();
            break;
        case 'n':
            geom = buildKnightGeometry();
            break;
        case 'b':
            geom = buildBishopGeometry();
            break;
        case 'q':
            geom = buildQueenGeometry();
            break;
        case 'k':
            geom = buildKingGeometry();
            break;
        default:
            geom = buildPawnGeometry();
    }

    geometryCache.set(type, geom);
    return geom;
}

/**
 * Parses piece code into { type: 'k'|'q'|'r'|'b'|'n'|'p', isWhite: boolean }
 */
export function parseChessCode(code) {
    if (!code) return { type: 'p', isWhite: true };
    const str = String(code).trim();
    if (str.length === 1) {
        const isWhite = str === str.toUpperCase();
        return { type: str.toLowerCase(), isWhite };
    }
    const lower = str.toLowerCase();
    const isWhite = lower.startsWith('w') || lower.startsWith('white');
    const type = lower[lower.length - 1];
    return { type, isWhite };
}

/**
 * Creates a 3D chess piece Object3D
 * @param {string} code - 'K','Q','R','B','N','P' for white, 'k','q','r','b','n','p' for black
 * @param {object|string} [themePreset] - optional theme preset or name
 * @returns {THREE.Mesh}
 */
export function createChessPiece(code, themePreset = null) {
    const { type, isWhite } = parseChessCode(code);
    const materials = ensureMaterials(themePreset);
    const material = isWhite ? materials.white : materials.black;
    const geom = getOrCreateGeometry(type);

    const mesh = new THREE.Mesh(geom, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = {
        code,
        pieceType: type,
        color: isWhite ? 'white' : 'black'
    };

    return mesh;
}

/**
 * Updates theme for chess pieces
 */
export function setChessTheme(themePreset) {
    return ensureMaterials(themePreset);
}

/**
 * Disposes all cached geometries and materials
 */
export function disposeChessPieces() {
    for (const geom of geometryCache.values()) {
        geom.dispose();
    }
    geometryCache.clear();

    if (whiteMaterial) {
        whiteMaterial.dispose();
        whiteMaterial = null;
    }
    if (blackMaterial) {
        blackMaterial.dispose();
        blackMaterial = null;
    }
}

// Module export for contract
export function dispose() {
    disposeChessPieces();
}
