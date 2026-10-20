// Controller/lifecycle regressions with real chess logic and deterministic timers.
// Minimal DOM doubles keep these tests dependency-free and runnable in Node.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let passed = 0;
function test(name, fn) {
    fn();
    passed++;
    console.log('  ok   ' + name);
}
function environment() {
    let nextId = 1;
    const timers = new Map(), elements = new Map(), events = new Map(), storage = new Map(), states = [];
    function node(id = '') {
        const classes = new Set();
        return {
            id, dataset: {}, style: { setProperty() {} }, children: [], textContent: '', innerHTML: '',
            classList: {
                add(...names) { names.forEach(name => classes.add(name)); },
                remove(...names) { names.forEach(name => classes.delete(name)); },
                contains(name) { return classes.has(name); },
                toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }
            },
            setAttribute(name, value) { this[name] = value; },
            addEventListener() {}, removeEventListener() {},
            appendChild(child) { child.parentNode = this; this.children.push(child); this.firstElementChild = this.children[0]; },
            remove() { this.parentNode = null; },
            contains(child) { return this.children.includes(child); },
            querySelectorAll() { return []; },
            cloneNode() { return node(id); },
            replaceWith(replacement) { elements.set(id, replacement); }
        };
    }
    const get = id => {
        if (!elements.has(id)) elements.set(id, node(id));
        return elements.get(id);
    };
    const document = {
        hidden: false, body: node('body'), getElementById: get,
        createElement() { return node(); },
        querySelector(selector) { return get(selector); },
        querySelectorAll() { return []; },
        addEventListener(type, fn) { events.set(type, fn); }
    };
    document.body.contains = () => true;
    const setTimer = (fn, ms) => { const id = nextId++; timers.set(id, { fn, ms }); return id; };
    const clearTimer = id => timers.delete(id);
    class Worker {
        constructor() { this.listeners = {}; }
        addEventListener(type, fn) { this.listeners[type] = fn; }
        removeEventListener(type) { delete this.listeners[type]; }
        postMessage(payload) { this.payload = payload; }
        terminate() { this.terminated = true; }
    }
    const context = vm.createContext({
        document, window: { matchMedia: () => ({ matches: false, addEventListener() {} }),
            dispatchEvent(event) { if (event.type === 'game:state') states.push(event.detail); } },
        CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
        setTimeout: setTimer, clearTimeout: clearTimer, setInterval: setTimer, clearInterval: clearTimer,
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
        Worker, console
    });
    for (const file of ['pieces', 'moves', 'ai', 'game', 'theme', 'manager', 'history',
        'xiangqi-rules', 'xiangqi-ai', 'xiangqi', 'xo-rules', 'xo-ai', 'xo']) {
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/' + file + '.js'), 'utf8'), context);
    }
    const classes = vm.runInContext('({ ChessGame, ThemeSwitcher, GameManager, GameHistory, XiangqiGame, XOGame })', context);
    class HeadlessGame extends classes.ChessGame { init() {} }
    function chess() {
        const game = new HeadlessGame();
        game.active = true;
        game.renderBoard = () => {};
        game.updateUI = () => {};
        game.updateStatus = message => { game.status = message; };
        game.newGame();
        return game;
    }
    function move(game, fr, fc, tr, tc) {
        const legal = game.getValidMoves(fr, fc).find(m => m.row === tr && m.col === tc);
        assert(legal, 'fixture move must be legal');
        game.makeMove(fr, fc, tr, tc, legal);
    }
    return { ...classes, chess, move, node, get, context, document, timers, events, storage, states };
}

test('undo while AI waits for second human move returns to human, not Black', () => {
    const e = environment(), game = e.chess();
    game.playingAgainstAI = true;
    e.move(game, 6, 4, 4, 4); e.move(game, 1, 4, 3, 4);
    const previous = JSON.stringify(game.board);
    e.move(game, 7, 6, 5, 5);
    assert(e.timers.has(game.aiTimer));
    game.undoMove();
    assert.equal(game.currentTurn, 'white');
    assert.equal(game.moveHistory.length, 2);
    assert.equal(JSON.stringify(game.board), previous);
    assert.equal(e.timers.size, 0);
});
test('undo cancels an in-flight worker and ignores its late reply', () => {
    const e = environment(), game = e.chess();
    game.playingAgainstAI = true;
    e.move(game, 6, 4, 4, 4);
    game.makeAIMove();
    const worker = game.aiWorker, lateReply = worker.listeners.message;
    game.undoMove();
    const restored = JSON.stringify(game.board);
    lateReply({ data: { bestMove: { from: { row: 1, col: 4 }, to: { row: 3, col: 4 }, type: 'double' } } });
    assert(worker.terminated);
    assert.equal(game.currentTurn, 'white');
    assert.equal(JSON.stringify(game.board), restored);
    assert(!game.aiThinking);
});
test('undo after completed AI reply reverts the pair; local mode reverts one', () => {
    for (const ai of [false, true]) {
        const e = environment(), game = e.chess();
        game.playingAgainstAI = ai;
        e.move(game, 6, 4, 4, 4); e.move(game, 1, 4, 3, 4);
        game.undoMove();
        assert.equal(game.moveHistory.length, ai ? 0 : 1);
        assert.equal(game.currentTurn, ai ? 'white' : 'black');
    }
});
test('undo from an AI checkmate restores a playable human turn', () => {
    const e = environment(), game = e.chess(); game.playingAgainstAI = true;
    e.move(game, 6, 5, 5, 5); e.move(game, 1, 4, 3, 4);
    e.move(game, 6, 6, 4, 6); e.move(game, 0, 3, 4, 7);
    assert(game.isGameOver);
    game.undoMove();
    assert(!game.isGameOver); assert.equal(game.currentTurn, 'white'); assert.equal(game.moveHistory.length, 2);
});
test('undo reschedules AI if a restored turn belongs to a White AI', () => {
    const e = environment(), game = e.chess();
    game.playingAgainstAI = true; game.aiColor = 'white';
    e.move(game, 6, 4, 4, 4);
    game.undoMove();
    assert.equal(game.currentTurn, 'white'); assert(e.timers.has(game.aiTimer));
});
test('destroy stops replay/AI timers and removes delegated board listener', () => {
    const e = environment(), game = e.chess();
    const record = { moves: [{ from: { row: 6, col: 4 }, to: { row: 4, col: 4 } }] };
    game.startReplay(record);
    const replay = game.replayTimer;
    assert(e.timers.has(replay));
    let removed = 0;
    game.boardEl = { removeEventListener() { removed++; } }; game.boardClickHandler = () => {};
    game.destroy();
    assert(!game.active); assert(!game.isReplaying); assert(!e.timers.has(replay)); assert.equal(removed, 1);
});
test('T7 render preserves cached squares and unchanged piece nodes', () => {
    const e = environment(), game = e.chess();
    delete game.renderBoard;
    game.boardEl = e.node('board');
    game.squares = Array.from({ length: 64 }, (_, index) => {
        const square = e.node(); square.dataset.row = String(Math.floor(index / 8)); square.dataset.col = String(index % 8);
        game.boardEl.appendChild(square); return square;
    });
    game.renderBoard();
    const squares = [...game.squares], queen = game.squares[59].firstElementChild;
    e.move(game, 6, 4, 4, 4);
    assert(game.squares.every((square, index) => square === squares[index]));
    assert.strictEqual(game.squares[59].firstElementChild, queen);
    assert.equal(game.squares[36].dataset.piece, 'P'); assert.equal(game.squares[52].dataset.piece, '');
});
test('T7 replay snapshots and SAN PGN still agree on a completed game', () => {
    const e = environment(), game = e.chess(), history = new e.GameHistory();
    const moves = [
        { from: { row: 6, col: 5 }, to: { row: 5, col: 5 }, piece: 'P' },
        { from: { row: 1, col: 4 }, to: { row: 3, col: 4 }, piece: 'p' },
        { from: { row: 6, col: 6 }, to: { row: 4, col: 6 }, piece: 'P' },
        { from: { row: 0, col: 3 }, to: { row: 4, col: 7 }, piece: 'q' }
    ];
    const record = { moves, date: '2026-10-20', mode: 'local', opponent: 'Test', result: 'checkmate', winner: 'black' };
    const snapshots = game.buildReplaySnapshots(record);
    assert.equal(snapshots.length, 4); assert.equal(snapshots[3][4][7], 'q');
    assert(history.toPGN(record).includes('1. f3 e5 2. g4 Qh4# 0-1'));
});
test('theme toggle persists aria state and clears all effect timers', () => {
    const e = environment(), theme = new e.ThemeSwitcher();
    theme.changeTheme('vampire'); theme.showVampireBite(10, 20); theme.createBat();
    assert(e.timers.size > 0);
    theme.setEffectsEnabled(false);
    assert.equal(e.timers.size, 0); assert.equal(theme.activeParticles.length, 0);
    assert.equal(e.storage.get('chess-effects'), 'false');
    assert.equal(e.get('toggle-effects-btn')['aria-pressed'], 'false');
});
test('visibility and theme change cancel pending capture effects and bats', () => {
    const e = environment(), theme = new e.ThemeSwitcher();
    theme.changeTheme('vampire'); theme.showVampireBite(10, 20);
    e.document.hidden = true; e.events.get('visibilitychange')();
    assert.equal(e.timers.size, 0);
    e.document.hidden = false; e.events.get('visibilitychange')();
    assert(e.timers.size > 0);
    theme.changeTheme('greek'); assert.equal(e.timers.size, 0);
});
test('switchGame destroys replay and resets old theme effects before new game', () => {
    const e = environment(), game = e.chess(), theme = new e.ThemeSwitcher();
    game.startReplay({ moves: [{ from: { row: 6, col: 4 }, to: { row: 4, col: 4 } }] });
    theme.showVampireBite(10, 20);
    const oldTimers = [...e.timers.keys()];
    const manager = Object.create(e.GameManager.prototype);
    let initialized = 0;
    e.context.window.chessGame = game;
    e.context.window.themeSwitcher = theme;
    e.context.window.xoGame = { init() { initialized++; } };
    manager.gameType = 'chess'; manager.currentGame = game; manager.updateUI = () => {};
    manager.switchGame('xo');
    assert.equal(initialized, 1); assert(!game.active); assert(!game.isReplaying);
    assert(oldTimers.every(id => !e.timers.has(id)));
    assert.equal(theme.activeParticles.length, 0);
});
test('reduced motion suppresses bats/particles and cleanup clears callbacks', () => {
    const e = environment();
    e.context.window.matchMedia = () => ({ matches: true, addEventListener() {} });
    const theme = new e.ThemeSwitcher();
    theme.changeTheme('vampire'); theme.createBat(); theme.showVampireBite(10, 20);
    // A pending capture callback can be scheduled, but it cannot create particles.
    for (const timer of [...e.timers.values()]) timer.fn();
    assert.equal(theme.batsInterval, null); assert.equal(theme.activeBats.length, 0); assert.equal(theme.activeParticles.length, 0);
    theme.resetEffects(); assert.equal(e.timers.size, 0);
});
test('online room locks selector/AI controls and rejects programmatic game switch', () => {
    const e = environment(), manager = Object.create(e.GameManager.prototype);
    e.context.window.onlineManager = { isConnected: true };
    manager.gameType = 'chess'; manager.currentGame = { updateStatus() {}, destroy() { throw new Error('online game must not be destroyed'); } };
    manager.updateOnlineLock(); manager.switchGame('xo');
    assert(e.get('game-type-selector').disabled); assert(e.get('play-ai-btn').disabled); assert(e.get('ai-difficulty').disabled);
    assert.equal(manager.gameType, 'chess'); assert.equal(e.get('game-type-selector').value, 'chess');
});
test('Chat/online are hidden for Xiangqi and Caro and restored for chess', () => {
    const e = environment(), manager = Object.create(e.GameManager.prototype);
    manager.currentGame = { playingAgainstAI: false };
    for (const type of ['chess', 'xiangqi', 'xo', 'chess']) {
        manager.gameType = type; manager.updateUI();
        const display = type === 'chess' ? '' : 'none';
        assert.equal(e.get('#chat-panel').style.display, display);
        assert.equal(e.get('#online-panel').style.display, display);
    }
});
test('theme banners apply to every game instead of advertising chess only', () => {
    const e = environment(), theme = new e.ThemeSwitcher();
    for (const name of ['harry-potter', 'greek', 'cyber', 'vampire']) {
        theme.changeTheme(name);
        const banner = e.get('.title').textContent;
        assert(banner.length > 0); assert(!/chess|Σκάκι/i.test(banner));
    }
});
test('header sizing follows font/viewport-driven header height changes', () => {
    const e = environment(), manager = Object.create(e.GameManager.prototype);
    const properties = new Map();
    e.document.documentElement = { style: { setProperty: (key, value) => properties.set(key, value) } };
    let height = 180, observed = null, onResize;
    const header = e.get('.header');
    header.getBoundingClientRect = () => ({ height });
    e.context.ResizeObserver = class {
        constructor(callback) { onResize = callback; }
        observe(element) { observed = element; }
    };
    manager.setupBoardSizing();
    assert.strictEqual(observed, header);
    assert.equal(properties.get('--header-height'), '180px');
    height = 220; onResize();
    assert.equal(properties.get('--header-height'), '220px');
});
test('snapshots expose the complete contract and cannot mutate any controller', () => {
    const e = environment();
    for (const [game, name, rows, cols] of [[e.chess(), 'chess', 8, 8],
        [new e.XiangqiGame(), 'xiangqi', 10, 9], [new e.XOGame(), 'xo', 15, 15]]) {
        if (name !== 'chess') game.init();
        const state = game.getState();
        assert.equal(state.game, name); assert.equal(state.rows, rows); assert.equal(state.cols, cols);
        assert.equal(state.board.length, rows); assert(state.board.every(row => row.length === cols));
        assert.deepEqual(Object.keys(state).sort(), ['game', 'rows', 'cols', 'board', 'turn', 'selected', 'hints',
            'lastMove', 'captured', 'check', 'winLine', 'gameOver', 'flipped', 'aiThinking', 'moveId'].sort());
        const before = JSON.stringify(game.board); state.board[0][0] = 'corrupt';
        e.states[e.states.length - 1].board[0][1] = 'corrupt';
        assert.equal(JSON.stringify(game.board), before);
        game.selectSquare(-1, 100); game.selectSquare(1.5, 0);
    }
});
test('chess common input selects, hints, moves, deselects and increments only on board changes', () => {
    const e = environment(), game = e.chess(), id = game.getState().moveId;
    game.selectSquare(6, 4);
    assert.equal(game.getState().selected.row, 6); assert.equal(game.getState().hints.length, 2);
    assert.equal(game.getState().moveId, id);
    game.selectSquare(4, 4);
    assert.equal(e.states.at(-1).board[4][4], 'P'); assert.equal(e.states.at(-1).moveId, id + 1);
    game.handleSquareClick(1, 4); game.selectSquare(1, 4);
    assert.equal(game.getState().selected, null);
    game.undoMove(); assert(game.getState().moveId > id + 1); assert.equal(game.getState().captured, null);
    const undoId = game.getState().moveId; game.newGame(); assert(game.getState().moveId > undoId);
});
test('chess capture and en passant snapshots use the actual captured square and clear on undo', () => {
    const e = environment(), game = e.chess();
    e.move(game, 6, 4, 4, 4); e.move(game, 1, 0, 2, 0);
    e.move(game, 4, 4, 3, 4); e.move(game, 1, 3, 3, 3);
    game.selectSquare(3, 4);
    assert(game.getState().hints.some(h => h.row === 2 && h.col === 3 && h.capture));
    game.selectSquare(2, 3);
    assert.deepEqual(JSON.parse(JSON.stringify(game.getState().captured)), { row: 3, col: 3, piece: 'p' });
    const snapshot = game.getState(); game.undoMove();
    assert.equal(game.getState().captured, null); assert.equal(snapshot.board[3][3], null);
    e.move(game, 3, 4, 2, 3); game.selectSquare(1, 4); assert.equal(game.getState().captured, null);
});
test('chess publishes worker thinking, reply, checkmate and flipped state', () => {
    const e = environment(), game = e.chess(); game.playingAgainstAI = true;
    e.move(game, 6, 4, 4, 4); game.makeAIMove();
    assert(e.states.at(-1).aiThinking);
    game.aiWorker.listeners.message({ data: { bestMove: { from: { row: 1, col: 4 }, to: { row: 3, col: 4 }, type: 'double' } } });
    assert(!e.states.at(-1).aiThinking); assert.equal(e.states.at(-1).board[3][4], 'p');
    game.flipBoard(true); assert(e.states.at(-1).flipped);
    game.newGame(); game.playingAgainstAI = false;
    e.move(game, 6, 5, 5, 5); e.move(game, 1, 4, 3, 4);
    e.move(game, 6, 6, 4, 6); e.move(game, 0, 3, 4, 7);
    assert(e.states.at(-1).gameOver); assert.equal(e.states.at(-1).check.row, 7);
});
test('promotion and replay publish new boards and move IDs', () => {
    const e = environment(), game = e.chess();
    game.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    game.board[7][4] = 'K'; game.board[0][4] = 'k'; game.board[1][0] = 'P';
    const id = game.getState().moveId;
    game.makeMove(1, 0, 0, 0, { type: 'promotion' });
    assert.equal(game.getState().moveId, id);
    game.completePromotion('Q'); assert.equal(e.states.at(-1).board[0][0], 'Q');
    assert.equal(e.states.at(-1).moveId, id + 1);
    game.newGame(); game.startReplay({ moves: [{ from: { row: 6, col: 4 }, to: { row: 4, col: 4 } }] });
    const replayId = game.getState().moveId;
    e.timers.get(game.replayTimer).fn();
    assert(e.states.at(-1).moveId > replayId); assert.equal(e.states.at(-1).board[4][4], 'P');
});
test('xiangqi normalizes selection, capture, undo, AI and orientation snapshots', () => {
    const e = environment(), game = new e.XiangqiGame(); game.init();
    const id = game.getState().moveId;
    game.selectSquare(7, 1);
    assert.equal(game.getState().selected.col, 1);
    assert(game.getState().hints.some(h => h.row === 0 && h.col === 1 && h.capture));
    game.handleSquareClick(0, 1);
    assert.equal(game.getState().moveId, id + 1); assert.equal(game.getState().captured.piece, 'B_H');
    assert.equal(game.getState().lastMove.to.row, 0);
    game.undoMove(); assert.equal(game.getState().captured, null);
    assert(game.getState().moveId > id + 1);
    game.humanColor = 'black'; game.setAI(true, 2);
    assert(e.states.at(-1).flipped); assert(e.states.at(-1).aiThinking);
    const move = game.legalMoves[0], before = game.getState().moveId;
    game.worker.onmessage({ data: { requestId: game.requestId, bestMove: move } });
    assert(game.getState().moveId > before); assert(!e.states.at(-1).aiThinking);
});
test('caro normalizes last move/win line and publishes AI, undo and new game', () => {
    const e = environment(), game = new e.XOGame(); game.init();
    game.setAI(true, 2); game.selectSquare(7, 7);
    assert(e.states.at(-1).aiThinking);
    game.worker.onmessage({ data: { requestId: game.requestId, bestMove: { r: 7, c: 8 } } });
    assert(!e.states.at(-1).aiThinking); assert.equal(e.states.at(-1).board[7][8], 'O');
    const id = game.getState().moveId; game.undoMove(); assert(game.getState().moveId > id);
    game.setAI(false, 2); game.newGame();
    for (let c = 0; c < 4; c++) { game.selectSquare(0, c); game.selectSquare(1, c); }
    game.handleClick(0, 4);
    assert(e.states.at(-1).gameOver); assert.equal(e.states.at(-1).winLine.length, 5);
    assert(e.states.at(-1).winLine.every(p => p.row === 0));
    assert.deepEqual(game.getState().lastMove.from, game.getState().lastMove.to);
    game.undoMove(); assert.equal(game.getState().winLine, null); assert(!game.getState().gameOver);
});
console.log(passed + ' controller/lifecycle tests passed');
