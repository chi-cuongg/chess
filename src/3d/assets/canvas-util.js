// Procedural canvas texture utilities for 3D assets
// Supports browser DOM canvas and Node.js test stub injection

import * as THREE from 'three';

let customCanvasFactory = null;

export function setCanvasFactory(factory) {
    customCanvasFactory = factory;
}

export function getCanvasFactory() {
    return customCanvasFactory;
}

export function createStubContext() {
    const gradientStub = {
        addColorStop: () => {}
    };
    return {
        canvas: null,
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        font: '10px sans-serif',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        globalAlpha: 1,
        shadowColor: 'transparent',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        fillRect: () => {},
        strokeRect: () => {},
        clearRect: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        stroke: () => {},
        fill: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        setLineDash: () => {},
        measureText: (text) => ({ width: (text ? text.length : 1) * 16 }),
        fillText: () => {},
        strokeText: () => {},
        createLinearGradient: () => gradientStub,
        createRadialGradient: () => gradientStub,
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData: () => {}
    };
}

export function createStubCanvas(width = 256, height = 256) {
    const ctx = createStubContext();
    const canvas = {
        width,
        height,
        getContext: (type) => {
            if (type === '2d') {
                ctx.canvas = canvas;
                return ctx;
            }
            return null;
        }
    };
    return canvas;
}

export function createCanvas(width = 256, height = 256) {
    if (customCanvasFactory) {
        return customCanvasFactory(width, height);
    }
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }
    return createStubCanvas(width, height);
}

/**
 * Creates a procedural wood grain CanvasTexture
 */
export function createWoodTexture({
    baseColor = '#d2a679',
    darkColor = '#8b5a2b',
    width = 512,
    height = 512,
    rings = 14,
    noiseIntensity = 0.08
} = {}) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, width, height);

    // Subtle grain bands
    for (let y = 0; y < height; y += 2) {
        const factor = Math.sin((y / height) * Math.PI * rings) * 0.5 + 0.5;
        ctx.fillStyle = darkColor;
        ctx.globalAlpha = 0.08 + factor * 0.12;
        ctx.fillRect(0, y, width, 1.5);
    }
    ctx.globalAlpha = 1.0;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

/**
 * Creates top face CanvasTexture for Xiangqi piece disc
 */
export function createXiangqiSymbolTexture({
    symbol = '帥',
    charColor = '#d32f2f',
    ringColor = '#c62828',
    discBgColor = '#f5e6c8',
    fontScale = 0.52,
    width = 256,
    height = 256
} = {}) {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const cx = width / 2;
    const cy = height / 2;
    const r = width * 0.46;

    // Disc face background
    ctx.fillStyle = discBgColor;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Subtle radial gradient for 3D bevel illusion
    const grad = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0.25)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Outer decorative ring
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = width * 0.04;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
    ctx.stroke();

    // Inner thin decorative ring
    ctx.lineWidth = width * 0.015;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.76, 0, Math.PI * 2);
    ctx.stroke();

    // Chinese character: rotated -Math.PI / 2 to align with CylinderGeometry top UV
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = charColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.round(width * fontScale)}px "Kaiti", "STKaiti", "Noto Serif SC", "SimSun", "Times New Roman", serif`;
    ctx.fillText(symbol, 0, width * 0.02);
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
