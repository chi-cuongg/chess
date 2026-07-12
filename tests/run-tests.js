// ========================================
// Unit tests for the chess move logic
// Run with: npm test  (node tests/run-tests.js)
// ========================================

const assert = require('assert');

// The game files are plain browser scripts sharing globals,
// so expose each module's exports globally before loading the next
Object.assign(global, require('../js/pieces.js'));
Object.assign(global, require('../js/moves.js'));

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
        console.log(`  ✔ ${name}`);
    } catch (e) {
        failed++;
        console.error(`  ✘ ${name}`);
        console.error(`    ${e.message}`);
    }
}

function emptyBoard() {
    return Array.from({ length: 8 }, () => Array(8).fill(null));
}

const ALL_RIGHTS = {
    whiteKingside: true,
    whiteQueenside: true,
    blackKingside: true,
    blackQueenside: true
};

console.log('Pawn attacks');

test('pawn does NOT attack the square directly in front of it', () => {
    const b = emptyBoard();
    b[4][4] = 'P';
    assert.strictEqual(isSquareAttacked(b, 3, 4, 'white'), false);
});

test('pawn attacks its two diagonal squares', () => {
    const b = emptyBoard();
    b[4][4] = 'P';
    assert.strictEqual(isSquareAttacked(b, 3, 3, 'white'), true);
    assert.strictEqual(isSquareAttacked(b, 3, 5, 'white'), true);
});

test('king may stand directly in front of an enemy pawn', () => {
    const b = emptyBoard();
    b[4][4] = 'P';
    b[7][4] = 'K';
    b[3][4] = 'k';
    assert.strictEqual(isInCheck(b, 'black'), false);
});

test('king may MOVE to the square in front of an enemy pawn', () => {
    const b = emptyBoard();
    b[4][4] = 'P';
    b[7][0] = 'K';
    b[2][4] = 'k';
    const moves = getLegalMoves(b, 2, 4, null, null);
    assert.ok(moves.some(m => m.row === 3 && m.col === 4),
        'expected Kd5->e5-equivalent square to be legal');
});

console.log('Castling');

test('kingside castling is legal on a clear back rank', () => {
    const b = emptyBoard();
    b[7][4] = 'K';
    b[7][7] = 'R';
    b[0][4] = 'k';
    const moves = getLegalMoves(b, 7, 4, null, ALL_RIGHTS);
    assert.ok(moves.some(m => m.type === 'castling' && m.col === 6));
});

test('castling is blocked when the king passes through an attacked square', () => {
    const b = emptyBoard();
    b[7][4] = 'K';
    b[7][7] = 'R';
    b[0][4] = 'k';
    b[0][5] = 'r'; // attacks f1
    const moves = getLegalMoves(b, 7, 4, null, ALL_RIGHTS);
    assert.ok(!moves.some(m => m.type === 'castling'));
});

test('castling is NOT blocked by a pawn that merely faces the path', () => {
    // Regression: pawn forward moves used to count as attacks
    const b = emptyBoard();
    b[7][4] = 'K';
    b[7][7] = 'R';
    b[0][4] = 'k';
    b[5][5] = 'p'; // faces the f-file, but attacks only (6,4)/(6,6) - not f1/g1
    const moves = getLegalMoves(b, 7, 4, null, ALL_RIGHTS);
    assert.ok(moves.some(m => m.type === 'castling' && m.col === 6));
});

console.log('En passant');

test('en passant capture is generated and removes the captured pawn', () => {
    const b = emptyBoard();
    b[7][4] = 'K';
    b[0][4] = 'k';
    b[3][4] = 'P'; // white pawn on e5
    b[3][3] = 'p'; // black pawn just double-moved to d5
    const ep = { row: 2, col: 3 };
    const moves = getLegalMoves(b, 3, 4, ep, null);
    const epMove = moves.find(m => m.type === 'enpassant');
    assert.ok(epMove, 'en passant move should exist');
    const after = makeMoveCopy(b, 3, 4, epMove.row, epMove.col, 'enpassant');
    assert.strictEqual(after[3][3], null, 'captured pawn should be removed');
    assert.strictEqual(after[2][3], 'P');
});

console.log('Game end detection');

test('checkmate is detected (queen supported by king)', () => {
    const b = emptyBoard();
    b[0][7] = 'k';
    b[1][6] = 'Q';
    b[2][6] = 'K';
    assert.strictEqual(isCheckmate(b, 'black'), true);
});

test('stalemate is detected', () => {
    const b = emptyBoard();
    b[0][0] = 'k';
    b[1][2] = 'Q';
    b[7][7] = 'K';
    assert.strictEqual(isInCheck(b, 'black'), false);
    assert.strictEqual(isStalemate(b, 'black'), true);
});

test('back-rank position is NOT mate when an escape exists', () => {
    const b = emptyBoard();
    b[0][4] = 'k';
    b[0][0] = 'R';
    b[7][4] = 'K';
    assert.strictEqual(isCheckmate(b, 'black'), false); // king can step to row 1
});

console.log('Insufficient material');

test('K vs K is a draw', () => {
    const b = emptyBoard();
    b[0][0] = 'k';
    b[7][7] = 'K';
    assert.strictEqual(isInsufficientMaterial(b), true);
});

test('K+B vs K is a draw', () => {
    const b = emptyBoard();
    b[0][0] = 'k';
    b[7][7] = 'K';
    b[4][4] = 'B';
    assert.strictEqual(isInsufficientMaterial(b), true);
});

test('K+Q vs K is NOT a draw', () => {
    const b = emptyBoard();
    b[0][0] = 'k';
    b[7][7] = 'K';
    b[4][4] = 'Q';
    assert.strictEqual(isInsufficientMaterial(b), false);
});

console.log('Move counts');

test('initial position: white has 20 legal moves', () => {
    const b = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    assert.strictEqual(getAllLegalMoves(b, 'white', null, ALL_RIGHTS).length, 20);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
