import * as THREE from 'three';
import { createXiangqiPiece, setXiangqiTheme, dispose as disposeXiangqiAssets } from '../assets/pieces-xiangqi.js';
import { createXiangqiBoard, setBoardTheme, dispose as disposeBoardAssets } from '../assets/boards.js';
import { getTheme, DEFAULT_THEME } from '../assets/themes.js';

const keyOf = point => `${point.row},${point.col}`;
const sameColor = (a, b) => a && b && a.startsWith(b[0]);
const cloneBoard = board => board.map(row => [...row]);

export class XiangqiView {
    constructor() {
        this.root = new THREE.Group();
        this.root.name = 'xiangqi-view';
        this.cameraPreset = { position: [0, 12.5, 13], target: [0, 0, 0] };
        this.pieces = new Map();
        this.retiring = new Set();
        this.ownedGeometries = new Set();
        this.ownedMaterials = new Set();
        this.disposed = false;
        this.pulseId = 0;
        this.cameraId = 0;
        this.flipped = false;
    }

    init(engine) {
        this.engine = engine;
        this.theme = getTheme(engine.themeId || DEFAULT_THEME);
        setXiangqiTheme(this.theme);
        setBoardTheme(this.theme);
        this.boardAsset = createXiangqiBoard({ theme: this.theme });
        this.root.add(this.boardAsset.group);
        const spacing = this.boardAsset.squareToWorld(0, 0).distanceTo(this.boardAsset.squareToWorld(0, 1));
        this.cellSize = spacing;
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
            hint: material(this.theme.highlights.validMove),
            capture: material(this.theme.highlights.validCapture),
            selected: material(this.theme.highlights.selected),
            last: material(this.theme.highlights.lastMove),
            check: material(this.theme.highlights.check),
            finish: material(this.theme.highlights.winLine)
        };
        this.hintGeometry = geometry(new THREE.RingGeometry(spacing * 0.16, spacing * 0.23, 40));
        this.captureGeometry = geometry(new THREE.RingGeometry(spacing * 0.38, spacing * 0.46, 40));
        const lastGeometry = geometry(new THREE.RingGeometry(spacing * 0.36, spacing * 0.44, 40));
        const ringGeometry = geometry(new THREE.RingGeometry(spacing * 0.40, spacing * 0.49, 48));
        const marker = (shape, paint) => {
            const mesh = new THREE.Mesh(shape, paint);
            mesh.rotation.x = -Math.PI / 2;
            mesh.visible = false;
            mesh.renderOrder = 2;
            this.root.add(mesh);
            return mesh;
        };
        this.hints = Array.from({ length: 64 }, () => marker(this.hintGeometry, this.markerMaterials.hint));
        this.lastMarkers = [marker(lastGeometry, this.markerMaterials.last), marker(lastGeometry, this.markerMaterials.last)];
        this.markerMaterials.last.opacity = 0.35;
        this.selectedMarker = marker(ringGeometry, this.markerMaterials.selected);
        this.checkMarker = marker(ringGeometry, this.markerMaterials.check);
        this.finishMarker = marker(geometry(new THREE.RingGeometry(spacing * 0.42, spacing * 0.52, 64)), this.markerMaterials.finish);
    }

    get pickObjects() {
        return this.boardAsset ? [this.boardAsset.group, ...[...this.pieces.values()].map(record => record.object)] : [];
    }

    makePiece(code, row, col) {
        const object = new THREE.Group();
        object.name = `xiangqi-${code}`;
        const model = createXiangqiPiece(code);
        object.add(model);
        const record = {
            object, model, code, row, col,
            base: this.boardAsset.squareToWorld(row, col).clone(),
            lift: 0, arc: 0, rotationY: this.flipped ? Math.PI : 0,
            motionId: 0, liftId: 0, clones: new Map(), selected: false
        };
        this.root.add(object);
        this.placeRecord(record);
        return record;
    }

    placeRecord(record) {
        record.object.position.copy(record.base);
        record.object.position.y += record.lift + record.arc;
        record.object.userData.square = { row: record.row, col: record.col };
        record.object.rotation.y = record.rotationY !== undefined ? record.rotationY : (this.flipped ? Math.PI : 0);
    }

    restoreMaterials(record) {
        for (const [mesh, entry] of record.clones) {
            mesh.material = entry.original;
            entry.copies.forEach(material => material.dispose());
        }
        record.clones.clear();
    }

    cloneMaterials(record) {
        if (record.clones.size) return;
        record.object.traverse(mesh => {
            if (!mesh.material) return;
            const original = mesh.material;
            const copies = (Array.isArray(original) ? original : [original]).map(material => material.clone());
            record.clones.set(mesh, { original, copies });
            mesh.material = Array.isArray(original) ? copies : copies[0];
        });
    }

    paintClones(record) {
        for (const entry of record.clones.values()) {
            const originals = Array.isArray(entry.original) ? entry.original : [entry.original];
            entry.copies.forEach((copy, index) => {
                copy.copy(originals[index]);
                if (record.selected && copy.emissive) {
                    copy.emissive.set(this.theme.highlights.selected);
                    copy.emissiveIntensity = 0.4;
                }
                if (record.captureProgress !== undefined) {
                    copy.transparent = true;
                    copy.opacity = 1 - record.captureProgress;
                    copy.depthWrite = false;
                }
            });
        }
    }

    finishMotion(record) {
        record.motionId++;
        if (record.motionEnd) record.motionEnd();
        record.motionEnd = null;
    }

    removePiece(record) {
        this.finishMotion(record);
        record.liftId++;
        this.restoreMaterials(record);
        record.object.removeFromParent();
        record.object.clear();
        this.retiring.delete(record);
    }

    movePiece(record, row, col, code = record.code, animate = true) {
        this.finishMotion(record);
        const from = record.base.clone(), to = this.boardAsset.squareToWorld(row, col).clone();
        const initialLift = record.lift;
        record.liftId++;
        record.lift = 0;
        this.restoreMaterials(record);
        record.selected = false;
        record.row = row;
        record.col = col;
        record.code = code;
        const id = ++record.motionId;
        const finish = () => {
            record.base.copy(to);
            record.arc = 0;
            this.placeRecord(record);
        };
        record.motionEnd = finish;
        this.engine.animate(animate ? 380 : 0, t => {
            if (this.disposed || record.motionId !== id) return;
            record.base.lerpVectors(from, to, t);
            record.arc = (1 - t) * initialLift + Math.sin(Math.PI * t) * this.cellSize * 0.85;
            this.placeRecord(record);
            if (t === 1) { finish(); record.motionEnd = null; }
        });
    }

    capturePiece(record) {
        this.finishMotion(record);
        record.liftId++;
        record.selected = false;
        this.restoreMaterials(record);
        this.cloneMaterials(record);
        this.retiring.add(record);
        const base = record.base.clone(), id = ++record.motionId;
        record.lift = 0;
        this.engine.animate(420, t => {
            if (this.disposed || record.motionId !== id) return;
            record.captureProgress = t;
            record.base.copy(base);
            record.base.y += Math.sin(t * Math.PI * 0.75) * this.cellSize * 1.8;
            record.object.scale.setScalar(1 - t * 0.65);
            this.paintClones(record);
            this.placeRecord(record);
            if (t === 1) this.removePiece(record);
        });
    }

    forwardMoves(next, previous) {
        const move = next.lastMove;
        if (!previous || !move || next.moveId === previous.moveId) return [];
        const from = previous.board[move.from.row]?.[move.from.col];
        const to = next.board[move.to.row]?.[move.to.col];
        if (!from || next.board[move.from.row]?.[move.from.col] || !sameColor(from, to) || from !== to) return [];
        return [{ from: move.from, to: move.to, code: to }];
    }

    reconcile(next, previous) {
        const moves = this.forwardMoves(next, previous);
        const moving = moves.map(move => ({ ...move, record: this.pieces.get(keyOf(move.from)) })).filter(move => move.record);
        const capture = moving.length && next.captured;
        if (capture) {
            const record = this.pieces.get(keyOf(capture));
            if (record && record.code === capture.piece && next.board[capture.row][capture.col] !== capture.piece) {
                this.pieces.delete(keyOf(capture));
                this.capturePiece(record);
            }
        }
        for (const move of moving) this.pieces.delete(keyOf(move.from));
        for (const move of moving) {
            const occupied = this.pieces.get(keyOf(move.to));
            if (occupied) this.removePiece(occupied);
            this.movePiece(move.record, move.to.row, move.to.col, move.code);
            this.pieces.set(keyOf(move.to), move.record);
        }
        const unmatched = [];
        for (const [key, record] of this.pieces) {
            if (next.board[record.row][record.col] !== record.code) {
                this.pieces.delete(key);
                unmatched.push(record);
            }
        }
        for (let row = 0; row < 10; row++) for (let col = 0; col < 9; col++) {
            const code = next.board[row][col], key = keyOf({ row, col });
            if (!code || this.pieces.has(key)) continue;
            const candidates = unmatched.filter(record => record.code === code).sort((a, b) =>
                Math.hypot(a.row - row, a.col - col) - Math.hypot(b.row - row, b.col - col));
            let record = candidates[0];
            if (record) {
                unmatched.splice(unmatched.indexOf(record), 1);
                this.movePiece(record, row, col, code, !!next.lastMove);
            } else record = this.makePiece(code, row, col);
            this.pieces.set(key, record);
        }
        unmatched.forEach(record => this.removePiece(record));
        if (!moving.length) [...this.retiring].forEach(record => this.removePiece(record));
    }

    setMarker(mesh, point, height = 0.025) {
        mesh.visible = !!point;
        if (point) {
            mesh.position.copy(this.boardAsset.squareToWorld(point.row, point.col));
            mesh.position.y += height;
        }
    }

    updateMarkers(state) {
        this.setMarker(this.selectedMarker, state.selected, 0.04);
        this.lastMarkers.forEach((mesh, index) => this.setMarker(mesh, state.lastMove?.[index ? 'to' : 'from']));
        this.hints.forEach((mesh, index) => {
            const hint = state.hints[index];
            this.setMarker(mesh, hint, 0.035);
            if (hint) {
                mesh.geometry = hint.capture ? this.captureGeometry : this.hintGeometry;
                mesh.material = hint.capture ? this.markerMaterials.capture : this.markerMaterials.hint;
            }
        });
        for (const record of this.pieces.values()) {
            const selected = state.selected?.row === record.row && state.selected?.col === record.col;
            if (record.selected === selected) continue;
            record.selected = selected;
            if (selected) { this.cloneMaterials(record); this.paintClones(record); }
            else this.restoreMaterials(record);
            const from = record.lift, to = selected ? this.cellSize * 0.24 : 0, id = ++record.liftId;
            this.engine.animate(160, t => {
                if (this.disposed || record.liftId !== id) return;
                record.lift = from + (to - from) * t;
                this.placeRecord(record);
            });
        }
        this.setMarker(this.checkMarker, state.check, 0.05);
        const checkKey = state.check ? `${keyOf(state.check)}:${state.moveId}` : '';
        if (checkKey !== this.checkKey) {
            this.checkKey = checkKey;
            const id = ++this.pulseId;
            this.markerMaterials.check.opacity = 0.65;
            this.checkMarker.scale.setScalar(1);
            if (state.check) this.engine.animate(1500, t => {
                if (this.disposed || this.pulseId !== id) return;
                const pulse = Math.sin(t * Math.PI * 6) ** 2;
                this.markerMaterials.check.opacity = 0.55 + pulse * 0.45;
                this.checkMarker.scale.setScalar(1 + pulse * 0.08);
            });
        }
        if (state.gameOver && !this.state?.gameOver) {
            this.setMarker(this.finishMarker, state.lastMove?.to || state.check || { row: 4, col: 4 }, 0.07);
            const id = this.finishId = (this.finishId || 0) + 1;
            this.engine.animate(700, t => {
                if (this.disposed || this.finishId !== id) return;
                this.finishMarker.scale.setScalar(1 + t * 3);
                this.markerMaterials.finish.opacity = 0.75 * (1 - t);
                if (t === 1) this.finishMarker.visible = false;
            });
        } else if (!state.gameOver) {
            this.finishId = (this.finishId || 0) + 1;
            this.finishMarker.visible = false;
        }
    }

    rotatePieces(flipped, animate = true) {
        this.flipped = !!flipped;
        const targetRot = this.flipped ? Math.PI : 0;
        for (const record of this.pieces.values()) {
            const fromRot = record.rotationY !== undefined ? record.rotationY : (record.object.rotation.y || 0);
            const diff = targetRot - fromRot;
            if (Math.abs(diff) < 1e-4) continue;
            const id = ++record.motionId;
            this.engine.animate(animate ? 450 : 0, t => {
                if (this.disposed || record.motionId !== id) return;
                record.rotationY = fromRot + diff * t;
                record.object.rotation.y = record.rotationY;
            });
        }
    }

    flipCamera(flipped) {
        const engine = this.engine, target = new THREE.Vector3(...this.cameraPreset.target);
        const from = engine.camera.position.clone(), fromTarget = engine.controls.target.clone();
        const radius = Math.hypot(this.cameraPreset.position[0], this.cameraPreset.position[2]);
        const angle = Math.atan2(from.x - target.x, from.z - target.z);
        const end = flipped ? Math.PI : 0;
        const delta = Math.atan2(Math.sin(end - angle), Math.cos(end - angle));
        const id = ++this.cameraId;
        if (engine.cameraFlight) engine.cameraFlight.cancelled = true;
        const flight = engine.cameraFlight = { cancelled: false };
        this.cameraFlight = flight;
        this.rotatePieces(flipped, true);
        engine.animate(450, t => {
            if (this.disposed || this.cameraId !== id || flight.cancelled) return;
            const currentRadius = Math.hypot(from.x - target.x, from.z - target.z) * (1 - t) + radius * t;
            engine.camera.position.set(target.x + Math.sin(angle + delta * t) * currentRadius,
                from.y + (this.cameraPreset.position[1] - from.y) * t, target.z + Math.cos(angle + delta * t) * currentRadius);
            engine.controls.target.lerpVectors(fromTarget, target, t);
            engine.controls.update();
        });
    }

    update(state, prevState) {
        if (this.disposed) return;
        const previous = this.state || prevState;
        const changed = !this.board || state.board.some((row, r) => row.some((code, c) => code !== this.board[r][c]));
        if (changed) this.reconcile(state, previous);
        this.updateMarkers(state);
        if (previous ? state.flipped !== previous.flipped : state.flipped) this.flipCamera(state.flipped);
        this.board = cloneBoard(state.board);
        this.state = { ...state, board: this.board };
        this.engine.requestRender();
    }

    pickSquare(intersection) {
        if (!intersection || this.disposed) return null;
        let object = intersection.object;
        while (object && object !== this.root) {
            if (object.userData.square) return { ...object.userData.square };
            object = object.parent;
        }
        if (!intersection.point) return null;
        const local = this.root.worldToLocal(intersection.point.clone());
        return this.boardAsset.worldToSquare(local);
    }

    setTheme(preset) {
        if (this.disposed) return;
        const theme = getTheme(preset?.xiangqi ? preset : preset?.id || this.engine.themeId || DEFAULT_THEME);
        const changed = this.theme.id !== theme.id;
        this.theme = theme;
        setXiangqiTheme(theme);
        if (changed) {
            this.root.remove(this.boardAsset.group);
            disposeBoardAssets();
            setBoardTheme(theme);
            this.boardAsset = createXiangqiBoard({ theme });
            this.root.add(this.boardAsset.group);
        }
        const colors = { hint: 'validMove', capture: 'validCapture', selected: 'selected', last: 'lastMove', check: 'check', finish: 'winLine' };
        for (const [name, key] of Object.entries(colors)) this.markerMaterials[name].color.set(theme.highlights[key]);
        [...this.pieces.values(), ...this.retiring].forEach(record => this.paintClones(record));
        this.engine.requestRender();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.pulseId++;
        this.cameraId++;
        this.finishId = (this.finishId || 0) + 1;
        if (this.cameraFlight) this.cameraFlight.cancelled = true;
        [...this.pieces.values(), ...this.retiring].forEach(record => this.removePiece(record));
        this.pieces.clear();
        this.ownedGeometries.forEach(geometry => geometry.dispose());
        this.ownedMaterials.forEach(material => material.dispose());
        this.ownedGeometries.clear();
        this.ownedMaterials.clear();
        disposeXiangqiAssets();
        disposeBoardAssets();
        this.root.removeFromParent();
        this.root.clear();
    }
}
