import * as THREE from 'three';
import { createXOMeshes, setXOTheme, getOrCreateXGeometry, getOrCreateOGeometry, dispose as disposeXOAssets } from '../assets/pieces-xo.js';
import { createXOBoard, setBoardTheme, dispose as disposeBoardAssets } from '../assets/boards.js';
import { getTheme, DEFAULT_THEME } from '../assets/themes.js';

const cloneBoard = board => board.map(row => [...row]);

export class XOView {
    constructor() {
        this.root = new THREE.Group();
        this.root.name = 'xo-view';
        this.cameraPreset = { position: [0, 13.5, 13.5], target: [0, 0, 0] };
        this.size = 15;
        this.ownedGeometries = new Set();
        this.ownedMaterials = new Set();
        this.pieceHeights = new Map();
        this.drops = new Map();
        this.pieceScales = new Map();
        this.xInstances = [];
        this.oInstances = [];
        this.disposed = false;
        this.pulseId = 0;
        this.finishId = 0;
        this.dropId = 0;
    }

    init(engine) {
        this.engine = engine;
        this.theme = getTheme(engine.themeId || DEFAULT_THEME);
        setXOTheme(this.theme);
        setBoardTheme(this.theme);

        this.boardAsset = createXOBoard(this.size, { theme: this.theme });
        this.root.add(this.boardAsset.group);

        const spacing = this.boardAsset.squareToWorld(0, 0).distanceTo(this.boardAsset.squareToWorld(0, 1));
        this.cellSize = spacing;

        this.meshes = createXOMeshes(this.size * this.size, this.theme);
        this.root.add(this.meshes.x);
        this.root.add(this.meshes.o);

        const geometry = value => { this.ownedGeometries.add(value); return value; };
        const material = color => {
            const value = new THREE.MeshBasicMaterial({
                color, transparent: true, opacity: 0.65,
                side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1
            });
            this.ownedMaterials.add(value);
            return value;
        };

        this.markerMaterials = {
            last: material(this.theme.highlights.lastMove),
            finish: material(this.theme.highlights.winLine)
        };
        this.markerMaterials.last.opacity = 0.45;
        // The expanding finish ring fades independently of the winning line.
        this.finishMaterial = material(this.theme.highlights.winLine);

        const marker = (shape, paint) => {
            const mesh = new THREE.Mesh(shape, paint);
            mesh.rotation.x = -Math.PI / 2;
            mesh.visible = false;
            mesh.renderOrder = 2;
            this.root.add(mesh);
            return mesh;
        };

        const lastGeometry = geometry(new THREE.RingGeometry(this.cellSize * 0.36, this.cellSize * 0.44, 32));
        this.lastMarker = marker(lastGeometry, this.markerMaterials.last);

        const winGeometry = geometry(new THREE.RingGeometry(this.cellSize * 0.16, this.cellSize * 0.42, 32));
        this.winMarkers = Array.from({ length: 5 }, () => marker(winGeometry, this.markerMaterials.finish));

        this.finishMarker = marker(geometry(new THREE.RingGeometry(this.cellSize * 0.45, this.cellSize * 0.65, 48)), this.finishMaterial);

        // Hover ghost preview for current player
        this.ghostMaterialX = new THREE.MeshStandardMaterial({
            color: this.theme.xo.x.color, transparent: true, opacity: 0.4, depthWrite: false
        });
        this.ghostMaterialO = new THREE.MeshStandardMaterial({
            color: this.theme.xo.o.color, transparent: true, opacity: 0.4, depthWrite: false
        });
        this.ownedMaterials.add(this.ghostMaterialX);
        this.ownedMaterials.add(this.ghostMaterialO);

        this.ghostX = new THREE.Mesh(getOrCreateXGeometry(), this.ghostMaterialX);
        this.ghostO = new THREE.Mesh(getOrCreateOGeometry(), this.ghostMaterialO);
        this.ghostX.visible = false;
        this.ghostO.visible = false;
        this.root.add(this.ghostX);
        this.root.add(this.ghostO);

        // Attach hover listeners to canvas
        this.domElement = engine.renderer?.domElement;
        if (this.domElement) {
            this.onPointerMove = event => this.handlePointerMove(event);
            this.onPointerLeave = () => this.handlePointerLeave();
            this.domElement.addEventListener('pointermove', this.onPointerMove);
            this.domElement.addEventListener('pointerleave', this.onPointerLeave);
        }
    }

    get pickObjects() {
        return this.boardAsset ? [this.boardAsset.group, this.meshes.x, this.meshes.o] : [];
    }

    handlePointerMove(event) {
        if (this.disposed || !this.engine || !this.state || this.state.gameOver) {
            this.hideHoverPreview();
            return;
        }
        const hit = this.engine.pick(event.clientX, event.clientY, this.pickObjects);
        const square = this.pickSquare(hit);
        if (square && (!this.board || !this.board[square.row][square.col])) {
            this.showHoverPreview(square.row, square.col, this.state.turn);
        } else {
            this.hideHoverPreview();
        }
    }

    handlePointerLeave() {
        this.hideHoverPreview();
    }

    showHoverPreview(row, col, turn) {
        const pos = this.boardAsset.squareToWorld(row, col);
        if (turn === 'O') {
            this.ghostO.position.set(pos.x, pos.y, pos.z);
            this.ghostO.visible = true;
            this.ghostX.visible = false;
        } else {
            this.ghostX.position.set(pos.x, pos.y, pos.z);
            this.ghostX.visible = true;
            this.ghostO.visible = false;
        }
        this.engine.requestRender();
    }

    hideHoverPreview() {
        if (!this.ghostX.visible && !this.ghostO.visible) return;
        this.ghostX.visible = false;
        this.ghostO.visible = false;
        this.engine?.requestRender();
    }

    getPieceMatrix(r, c) {
        const key = `${r},${c}`;
        const pos = this.boardAsset.squareToWorld(r, c);
        const h = this.pieceHeights.get(key) || 0;
        const s = this.pieceScales.get(key) || 1;

        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3(pos.x, pos.y + h, pos.z);
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(s, s, s);
        matrix.compose(position, quaternion, scale);
        return matrix;
    }

    syncInstances() {
        if (!this.board) return;
        let countX = 0, countO = 0;
        this.xInstances = [];
        this.oInstances = [];

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const piece = this.board[r][c];
                if (piece === 'X') {
                    const matrix = this.getPieceMatrix(r, c);
                    this.meshes.x.setMatrixAt(countX, matrix);
                    this.xInstances[countX] = { row: r, col: c };
                    countX++;
                } else if (piece === 'O') {
                    const matrix = this.getPieceMatrix(r, c);
                    this.meshes.o.setMatrixAt(countO, matrix);
                    this.oInstances[countO] = { row: r, col: c };
                    countO++;
                }
            }
        }

        this.meshes.x.count = countX;
        this.meshes.x.instanceMatrix.needsUpdate = true;
        this.meshes.o.count = countO;
        this.meshes.o.instanceMatrix.needsUpdate = true;
        this.meshes.x.computeBoundingSphere();
        this.meshes.o.computeBoundingSphere();
        this.engine.requestRender();
    }

    setMarker(mesh, point, height = 0.025) {
        mesh.visible = !!point;
        if (point) {
            mesh.position.copy(this.boardAsset.squareToWorld(point.row, point.col));
            mesh.position.y += height;
        }
    }

    animateDrop(row, col, animate = true) {
        const key = `${row},${col}`;
        const id = ++this.dropId;
        this.drops.set(key, id);
        const initialHeight = 3.2;

        if (!animate || !this.engine.motionEnabled) {
            this.pieceHeights.delete(key);
            this.drops.delete(key);
            this.syncInstances();
            return;
        }

        this.pieceHeights.set(key, initialHeight);
        this.syncInstances();

        this.engine.animate(350, t => {
            if (this.disposed || this.drops.get(key) !== id) return;
            const h = (1 - t * t) * initialHeight;
            if (t >= 1) {
                this.pieceHeights.delete(key);
                this.drops.delete(key);
            } else {
                this.pieceHeights.set(key, h);
            }
            this.syncInstances();
        });
    }

    updateMarkers(state) {
        this.setMarker(this.lastMarker, state.lastMove?.to, 0.02);

        if (state.winLine && state.winLine.length >= 5) {
            for (let i = 0; i < 5; i++) {
                this.setMarker(this.winMarkers[i], state.winLine[i], 0.025);
            }
            const winKey = state.winLine.map(p => `${p.row},${p.col}`).join(';');
            if (winKey !== this.winKey) {
                this.winKey = winKey;
                const id = ++this.pulseId;
                this.markerMaterials.finish.opacity = 0.65;
                state.winLine.forEach(p => this.pieceScales.set(`${p.row},${p.col}`, 1.0));

                this.engine.animate(1800, t => {
                    if (this.disposed || this.pulseId !== id) return;
                    const pulse = Math.sin(t * Math.PI * 6) ** 2;
                    this.markerMaterials.finish.opacity = 0.5 + pulse * 0.5;
                    const scale = 1.0 + pulse * 0.18;
                    state.winLine.forEach(p => this.pieceScales.set(`${p.row},${p.col}`, scale));
                    this.syncInstances();
                });
            }
        } else {
            this.pulseId++;
            this.winKey = '';
            this.winMarkers.forEach(m => { m.visible = false; });
            this.pieceScales.clear();
        }

        if (state.gameOver && !this.state?.gameOver) {
            this.setMarker(this.finishMarker, state.lastMove?.to || { row: 7, col: 7 }, 0.05);
            const id = this.finishId = (this.finishId || 0) + 1;
            this.engine.animate(700, t => {
                if (this.disposed || this.finishId !== id) return;
                this.finishMarker.scale.setScalar(1 + t * 3);
                this.finishMaterial.opacity = 0.75 * (1 - t);
                if (t === 1) this.finishMarker.visible = false;
            });
        } else if (!state.gameOver) {
            this.finishId = (this.finishId || 0) + 1;
            this.finishMarker.visible = false;
        }
    }

    update(state, prevState) {
        if (this.disposed) return;
        const previous = this.state || prevState;
        const to = state.lastMove?.to;
        const isNewMove = previous && to && state.moveId !== previous.moveId
            && !previous.board[to.row][to.col] && !!state.board[to.row][to.col];
        const boardChanged = !previous || state.board.some((row, r) => row.some((piece, c) => piece !== previous.board[r][c]));

        this.hideHoverPreview();

        this.board = cloneBoard(state.board);
        if (isNewMove && state.lastMove.to) {
            this.animateDrop(state.lastMove.to.row, state.lastMove.to.col, true);
        } else if (boardChanged) {
            this.drops.clear();
            this.pieceHeights.clear();
            this.pieceScales.clear();
            this.syncInstances();
        }

        this.updateMarkers(state);
        this.state = { ...state, board: this.board };
        this.engine.requestRender();
    }

    pickSquare(intersection) {
        if (!intersection || this.disposed) return null;
        if (intersection.object === this.meshes?.x && intersection.instanceId !== undefined) {
            const square = this.xInstances[intersection.instanceId];
            if (square) return { ...square };
        }
        if (intersection.object === this.meshes?.o && intersection.instanceId !== undefined) {
            const square = this.oInstances[intersection.instanceId];
            if (square) return { ...square };
        }
        if (!intersection.point) return null;
        const local = this.root.worldToLocal(intersection.point.clone());
        return this.boardAsset.worldToSquare(local);
    }

    setTheme(preset) {
        if (this.disposed) return;
        const theme = getTheme(preset?.xo ? preset : preset?.id || this.engine.themeId || DEFAULT_THEME);
        const changed = this.theme.id !== theme.id;
        this.theme = theme;
        setXOTheme(theme);

        if (changed) {
            this.root.remove(this.boardAsset.group);
            disposeBoardAssets();
            setBoardTheme(theme);
            this.boardAsset = createXOBoard(this.size, { theme });
            this.root.add(this.boardAsset.group);
        }

        this.markerMaterials.last.color.set(theme.highlights.lastMove);
        this.markerMaterials.finish.color.set(theme.highlights.winLine);
        this.finishMaterial.color.set(theme.highlights.winLine);
        this.ghostMaterialX.color.set(theme.xo.x.color);
        this.ghostMaterialO.color.set(theme.xo.o.color);

        this.syncInstances();
        this.engine.requestRender();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.dropId++;
        this.pulseId++;
        this.finishId = (this.finishId || 0) + 1;

        if (this.domElement) {
            this.domElement.removeEventListener('pointermove', this.onPointerMove);
            this.domElement.removeEventListener('pointerleave', this.onPointerLeave);
        }

        this.pieceHeights.clear();
        this.drops.clear();
        this.pieceScales.clear();

        this.ownedGeometries.forEach(geometry => geometry.dispose());
        this.ownedMaterials.forEach(material => material.dispose());
        this.ownedGeometries.clear();
        this.ownedMaterials.clear();

        this.meshes.x.dispose();
        this.meshes.o.dispose();
        disposeXOAssets();
        disposeBoardAssets();

        this.root.removeFromParent();
        this.root.clear();
    }
}
