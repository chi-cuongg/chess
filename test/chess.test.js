// ========================================
// Chess engine smoke tests
// ========================================
// Runs with plain Node (no test framework / dependencies):
//     npm test
//
// The chess logic lives in classic browser scripts (globals, no modules), so
// we load pieces.js + moves.js + ai.js into this scope with a single direct
// eval. Function declarations and their closures remain usable afterwards.

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sources = ['public/js/pieces.js', 'public/js/moves.js', 'public/js/ai.js']
    .map(f => fs.readFileSync(path.join(root, f), 'utf8'))
    .join('\n');

// eslint-disable-next-line no-eval
eval(sources);

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ok   ${name}`);
    } catch (err) {
        failed++;
        console.error(`  FAIL ${name}`);
        console.error(`       ${err.message}`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'assertion failed');
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'not equal'} (expected ${expected}, got ${actual})`);
    }
}

function emptyBoard() {
    return Array(8).fill(null).map(() => Array(8).fill(null));
}

function initialBoard() {
    return [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
}

const ALL_RIGHTS = {
    whiteKingside: true, whiteQueenside: true,
    blackKingside: true, blackQueenside: true
};

console.log('Chess engine tests');

// ---- Move generation ----------------------------------------------------
test('initial position has 20 legal moves for white', () => {
    const moves = getAllLegalMoves(initialBoard(), 'white', null, ALL_RIGHTS);
    assertEqual(moves.length, 20);
});

test('knight on b1 has 2 moves from start', () => {
    const moves = getLegalMoves(initialBoard(), 7, 1, null, ALL_RIGHTS);
    assertEqual(moves.length, 2);
});

test('pawn generates 4 promotion moves on last rank', () => {
    const board = emptyBoard();
    board[1][0] = 'P'; // white pawn a7 -> a8
    board[7][4] = 'K';
    board[0][4] = 'k';
    const moves = getLegalMoves(board, 1, 0, null, ALL_RIGHTS);
    const promotions = moves.filter(m => m.type === 'promotion');
    assertEqual(promotions.length, 4);
});

test('en passant capture is generated', () => {
    const board = emptyBoard();
    board[3][4] = 'P'; // white pawn e5
    board[3][3] = 'p'; // black pawn just moved d7-d5
    board[7][0] = 'K';
    board[0][0] = 'k';
    const ep = { row: 2, col: 3 }; // d6
    const moves = getLegalMoves(board, 3, 4, ep, ALL_RIGHTS);
    assert(moves.some(m => m.row === 2 && m.col === 3 && m.type === 'enpassant'), 'missing en passant');
});

test('castling available when path clear', () => {
    const board = emptyBoard();
    board[7][4] = 'K';
    board[7][7] = 'R';
    board[0][4] = 'k';
    const moves = getLegalMoves(board, 7, 4, null, ALL_RIGHTS);
    assert(moves.some(m => m.type === 'castling' && m.col === 6), 'kingside castling missing');
});

test('castling blocked when rights revoked', () => {
    const board = emptyBoard();
    board[7][4] = 'K';
    board[7][7] = 'R';
    board[0][4] = 'k';
    const rights = { ...ALL_RIGHTS, whiteKingside: false };
    const moves = getLegalMoves(board, 7, 4, null, rights);
    assert(!moves.some(m => m.type === 'castling'), 'castling should be blocked');
});

// ---- Game state ---------------------------------------------------------
test("fool's mate is detected as checkmate", () => {
    const board = [
        ['r', 'n', 'b', null, 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', null, 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, 'p', null, null, null],
        [null, null, null, null, null, null, 'P', 'q'],
        [null, null, null, null, null, 'P', null, null],
        ['P', 'P', 'P', 'P', 'P', null, null, 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    assert(isInCheck(board, 'white'), 'white should be in check');
    assert(isCheckmate(board, 'white', null, ALL_RIGHTS), "should be checkmate");
});

test('king vs king is insufficient material', () => {
    const board = emptyBoard();
    board[7][4] = 'K';
    board[0][4] = 'k';
    assert(isInsufficientMaterial(board), 'should be a draw');
});

// ---- Pure helpers used by AI / replay ----------------------------------
test('computeCastlingRights removes white rights after king move', () => {
    const rights = computeCastlingRights(ALL_RIGHTS, 7, 4, 7, 5);
    assertEqual(rights.whiteKingside, false);
    assertEqual(rights.whiteQueenside, false);
    assertEqual(rights.blackKingside, true);
    assertEqual(ALL_RIGHTS.whiteKingside, true, 'input must not be mutated');
});

test('computeEnPassantTarget set only after double pawn push', () => {
    const ep = computeEnPassantTarget({ row: 1, col: 3 }, { row: 3, col: 3 }, 'double');
    assert(ep && ep.row === 2 && ep.col === 3, 'wrong en passant target');
    assertEqual(computeEnPassantTarget({ row: 1, col: 3 }, { row: 2, col: 3 }, 'normal'), null);
});

// ---- AI -----------------------------------------------------------------
test('findBestMove returns a legal move', () => {
    const move = findBestMove(initialBoard(), 'white', 2, null, ALL_RIGHTS);
    assert(move, 'expected a move');
    const legal = getAllLegalMoves(initialBoard(), 'white', null, ALL_RIGHTS);
    assert(legal.some(m =>
        m.from.row === move.from.row && m.from.col === move.from.col &&
        m.to.row === move.to.row && m.to.col === move.to.col), 'AI move is not legal');
});

test('findBestMove finds a back-rank mate in one', () => {
    const board = emptyBoard();
    board[7][0] = 'K';   // white king a1
    board[7][4] = 'R';   // white rook e1
    board[0][6] = 'k';   // black king g8
    board[1][5] = 'p';   // f7
    board[1][6] = 'p';   // g7
    board[1][7] = 'p';   // h7
    const move = findBestMove(board, 'white', 3, null, ALL_RIGHTS);
    assert(move, 'expected a move');
    assertEqual(move.from.col, 4, 'should move the e-file rook');
    assertEqual(move.to.row, 0, 'should go to the back rank');
    assertEqual(move.to.col, 4, 'should land on e8');
});

// ---- Summary ------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
