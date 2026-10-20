// Procedural 3D Caro (X/O) pieces using InstancedMesh
// X: 2 beveled crossed boxes
// O: TorusGeometry flat on X-Z plane
// Geometries are cached and materials follow theme presets.

import * as THREE from 'three';
import { getTheme, DEFAULT_THEME } from './themes.js';

let sharedXGeometry = null;
let sharedOGeometry = null;

let currentThemePreset = getTheme(DEFAULT_THEME);
let xMaterial = null;
let oMaterial = null;

function mergeGeometries(geometries) {
    let totalPositions = 0;
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

export function getOrCreateXGeometry() {
    if (sharedXGeometry) return sharedXGeometry;

    // 2 crossed boxes rotated +-45 degrees
    const barWidth = 0.52;
    const barHeight = 0.08;
    const barDepth = 0.12;

    const bar1 = new THREE.BoxGeometry(barWidth, barHeight, barDepth);
    bar1.rotateY(Math.PI / 4);

    const bar2 = new THREE.BoxGeometry(barWidth, barHeight, barDepth);
    bar2.rotateY(-Math.PI / 4);

    const merged = mergeGeometries([bar1, bar2]);
    merged.translate(0, barHeight / 2, 0); // Ground at y = 0
    bar1.dispose();
    bar2.dispose();

    sharedXGeometry = merged;
    return merged;
}

export function getOrCreateOGeometry() {
    if (sharedOGeometry) return sharedOGeometry;

    // TorusGeometry lying flat on X-Z plane
    const radius = 0.20;
    const tube = 0.055;
    const radialSegments = 16;
    const tubularSegments = 32;

    const torus = new THREE.TorusGeometry(radius, tube, radialSegments, tubularSegments);
    torus.rotateX(Math.PI / 2); // Lie flat in X-Z
    torus.translate(0, tube, 0); // Ground at y = 0
    torus.computeVertexNormals();

    sharedOGeometry = torus;
    return torus;
}

function ensureXOMaterials(themePreset) {
    const theme = getTheme(themePreset || currentThemePreset);
    currentThemePreset = theme;

    const xCfg = theme.xo.x;
    const oCfg = theme.xo.o;

    if (!xMaterial) {
        xMaterial = new THREE.MeshStandardMaterial({
            color: xCfg.color,
            roughness: xCfg.roughness,
            metalness: xCfg.metalness,
            emissive: xCfg.emissive || 0x000000
        });
    } else {
        xMaterial.color.setHex(xCfg.color);
        xMaterial.roughness = xCfg.roughness;
        xMaterial.metalness = xCfg.metalness;
        xMaterial.emissive.setHex(xCfg.emissive || 0x000000);
        xMaterial.needsUpdate = true;
    }

    if (!oMaterial) {
        oMaterial = new THREE.MeshStandardMaterial({
            color: oCfg.color,
            roughness: oCfg.roughness,
            metalness: oCfg.metalness,
            emissive: oCfg.emissive || 0x000000
        });
    } else {
        oMaterial.color.setHex(oCfg.color);
        oMaterial.roughness = oCfg.roughness;
        oMaterial.metalness = oCfg.metalness;
        oMaterial.emissive.setHex(oCfg.emissive || 0x000000);
        oMaterial.needsUpdate = true;
    }

    return { x: xMaterial, o: oMaterial };
}

/**
 * Creates InstancedMesh for X and O pieces
 * @param {number} [maxCount=225] - Max count of instances (default 15x15 = 225)
 * @param {object|string} [themePreset] - Optional theme preset
 * @returns {{ x: THREE.InstancedMesh, o: THREE.InstancedMesh }}
 */
export function createXOMeshes(maxCount = 225, themePreset = null) {
    const materials = ensureXOMaterials(themePreset);
    const xGeom = getOrCreateXGeometry();
    const oGeom = getOrCreateOGeometry();

    const xMesh = new THREE.InstancedMesh(xGeom, materials.x, maxCount);
    const oMesh = new THREE.InstancedMesh(oGeom, materials.o, maxCount);

    xMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    oMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    xMesh.castShadow = true;
    xMesh.receiveShadow = true;
    oMesh.castShadow = true;
    oMesh.receiveShadow = true;

    // Initially 0 instances active
    xMesh.count = 0;
    oMesh.count = 0;

    return { x: xMesh, o: oMesh };
}

export function setXOTheme(themePreset) {
    return ensureXOMaterials(themePreset);
}

export function disposeXOMeshes() {
    if (sharedXGeometry) {
        sharedXGeometry.dispose();
        sharedXGeometry = null;
    }
    if (sharedOGeometry) {
        sharedOGeometry.dispose();
        sharedOGeometry = null;
    }
    if (xMaterial) {
        xMaterial.dispose();
        xMaterial = null;
    }
    if (oMaterial) {
        oMaterial.dispose();
        oMaterial = null;
    }
}

export function dispose() {
    disposeXOMeshes();
}
