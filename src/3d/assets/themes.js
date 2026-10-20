// Preset themes for 3D boards and pieces
// Harry Potter, Greek, Cyber, Vampire

export const DEFAULT_THEME = 'harry-potter';

export const THEMES = {
    'harry-potter': {
        id: 'harry-potter',
        name: 'Harry Potter',
        scene: {
            background: 0x140e08,
            fogColor: 0x140e08,
            fogNear: 25,
            fogFar: 90
        },
        lights: {
            ambient: { color: 0xffeedd, intensity: 0.65 },
            directional: { color: 0xffe8c8, intensity: 1.4, position: [6, 14, 8] }
        },
        chess: {
            white: { color: 0xf3e5c8, roughness: 0.28, metalness: 0.15 },
            black: { color: 0x1f1712, roughness: 0.25, metalness: 0.12 }
        },
        xiangqi: {
            red: { discColor: 0x2e1a12, charColor: '#d32f2f', ringColor: '#c62828', roughness: 0.35, metalness: 0.1 },
            black: { discColor: 0x1a120e, charColor: '#e0c080', ringColor: '#997744', roughness: 0.35, metalness: 0.1 }
        },
        xo: {
            x: { color: 0x841b25, roughness: 0.3, metalness: 0.15 },
            o: { color: 0x243f73, roughness: 0.3, metalness: 0.15 }
        },
        board: {
            woodLight: '#e8dcc4',
            woodDark: '#8b4513',
            border: 0x331a0a,
            borderTrim: 0xb8860b,
            gridLine: '#a08b65',
            riverText: '#b8860b',
            roughness: 0.45,
            metalness: 0.1
        },
        highlights: {
            selected: 0xffd700,
            validMove: 0x00ffc8,
            validCapture: 0xff3232,
            lastMove: 0xffd700,
            check: 0xff0000,
            winLine: 0xa8d18d
        }
    },
    'greek': {
        id: 'greek',
        name: 'Greek Antiquity',
        scene: {
            background: 0x1b1814,
            fogColor: 0x1b1814,
            fogNear: 25,
            fogFar: 90
        },
        lights: {
            ambient: { color: 0xfff0e4, intensity: 0.72 },
            directional: { color: 0xfff6ea, intensity: 1.45, position: [6, 14, 8] }
        },
        chess: {
            white: { color: 0xf5f2eb, roughness: 0.35, metalness: 0.05 },
            black: { color: 0x3a291d, roughness: 0.35, metalness: 0.35 }
        },
        xiangqi: {
            red: { discColor: 0x362316, charColor: '#d64020', ringColor: '#b83416', roughness: 0.4, metalness: 0.2 },
            black: { discColor: 0x221a14, charColor: '#e6c875', ringColor: '#a68835', roughness: 0.4, metalness: 0.2 }
        },
        xo: {
            x: { color: 0x8a3418, roughness: 0.35, metalness: 0.15 },
            o: { color: 0x22536c, roughness: 0.35, metalness: 0.15 }
        },
        board: {
            woodLight: '#fff8e8',
            woodDark: '#995c2e',
            border: 0x482d16,
            borderTrim: 0x9b761d,
            gridLine: '#8a6230',
            riverText: '#8a6230',
            roughness: 0.4,
            metalness: 0.1
        },
        highlights: {
            selected: 0xdaa520,
            validMove: 0x4682b4,
            validCapture: 0xb22222,
            lastMove: 0xdaa520,
            check: 0xb22222,
            winLine: 0xa6d1a0
        }
    },
    'cyber': {
        id: 'cyber',
        name: 'Cyberpunk',
        scene: {
            background: 0x030a0e,
            fogColor: 0x030a0e,
            fogNear: 25,
            fogFar: 90
        },
        lights: {
            ambient: { color: 0x4088aa, intensity: 0.55 },
            directional: { color: 0x00ffff, intensity: 1.15, position: [6, 14, 8] }
        },
        chess: {
            white: { color: 0x00f5ff, roughness: 0.15, metalness: 0.85, emissive: 0x002233 },
            black: { color: 0x160c22, roughness: 0.2, metalness: 0.75, emissive: 0x220033 }
        },
        xiangqi: {
            red: { discColor: 0x120818, charColor: '#ff007f', ringColor: '#ff007f', roughness: 0.25, metalness: 0.6 },
            black: { discColor: 0x06141c, charColor: '#00ffff', ringColor: '#00ffff', roughness: 0.25, metalness: 0.6 }
        },
        xo: {
            x: { color: 0xff007f, roughness: 0.2, metalness: 0.6, emissive: 0x33001a },
            o: { color: 0x00ffff, roughness: 0.2, metalness: 0.6, emissive: 0x002233 }
        },
        board: {
            woodLight: '#16213e',
            woodDark: '#0a0a14',
            border: 0x071c1b,
            borderTrim: 0x00ff88,
            gridLine: '#245c58',
            riverText: '#00ff88',
            roughness: 0.25,
            metalness: 0.7
        },
        highlights: {
            selected: 0x00ffff,
            validMove: 0x00ff88,
            validCapture: 0xff0055,
            lastMove: 0x00ffaa,
            check: 0xff0033,
            winLine: 0x285f36
        }
    },
    'vampire': {
        id: 'vampire',
        name: 'Vampire Gothic',
        scene: {
            background: 0x10040c,
            fogColor: 0x10040c,
            fogNear: 25,
            fogFar: 90
        },
        lights: {
            ambient: { color: 0xffd0d8, intensity: 0.68 },
            directional: { color: 0xffe8ec, intensity: 1.5, position: [6, 14, 8] }
        },
        chess: {
            white: { color: 0xeae0e0, roughness: 0.28, metalness: 0.25 },
            black: { color: 0x1c060a, roughness: 0.22, metalness: 0.2 }
        },
        xiangqi: {
            red: { discColor: 0x30080e, charColor: '#ff2244', ringColor: '#cc1133', roughness: 0.3, metalness: 0.2 },
            black: { discColor: 0x18050a, charColor: '#ffe4ec', ringColor: '#994455', roughness: 0.3, metalness: 0.2 }
        },
        xo: {
            x: { color: 0xff8fa3, roughness: 0.28, metalness: 0.25 },
            o: { color: 0x8a628a, roughness: 0.28, metalness: 0.25 }
        },
        board: {
            woodLight: '#4a252b',
            woodDark: '#1c070c',
            border: 0x240a14,
            borderTrim: 0xe63946,
            gridLine: '#945366',
            riverText: '#e63946',
            roughness: 0.35,
            metalness: 0.15
        },
        highlights: {
            selected: 0x8b0000,
            validMove: 0x800020,
            validCapture: 0xff0000,
            lastMove: 0x583022,
            check: 0xff0000,
            winLine: 0x44365f
        }
    }
};

export function getTheme(themeOrId) {
    if (!themeOrId) return THEMES[DEFAULT_THEME];
    if (typeof themeOrId === 'object' && themeOrId.chess) return themeOrId;
    return THEMES[themeOrId] || THEMES[DEFAULT_THEME];
}
