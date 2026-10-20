const assert = require('assert');
const rules = require('../public/js/xiangqi-rules');
let count = 0;
function test(name, fn) { fn(); count++; console.log('  ok   ' + name); }
function empty() {
    const b = Array.from({ length: 10 }, () => Array(9).fill(null));
    b[0][4] = 'B_K'; b[9][4] = 'R_K'; b[5][4] = 'R_P';
    return b;
}
const has = (b, r, c, tr, tc) => rules.generateLegalMoves(b, rules.colorOf(b[r][c])).some(m => m.from.r === r && m.from.c === c && m.to.r === tr && m.to.c === tc);
test('initial red and black positions have 44 legal moves', () => {
    assert.equal(rules.generateLegalMoves(rules.createInitialBoard(), 'red').length, 44);
    assert.equal(rules.generateLegalMoves(rules.createInitialBoard(), 'black').length, 44);
});
test('horse leg blocks jumps', () => {
    const b = empty(); b[7][1] = 'R_H'; assert(has(b, 7, 1, 5, 2)); b[6][1] = 'R_P'; assert(!has(b, 7, 1, 5, 2));
});
test('elephant eye blocks diagonal', () => {
    const b = empty(); b[9][2] = 'R_E'; assert(has(b, 9, 2, 7, 0)); b[8][1] = 'R_P'; assert(!has(b, 9, 2, 7, 0));
});
test('elephant cannot cross river', () => {
    const b = empty(); b[5][2] = 'R_E'; assert(!has(b, 5, 2, 3, 0));
});
test('cannon captures through exactly one screen', () => {
    const b = empty(); b[7][0] = 'R_C'; b[3][0] = 'B_R';
    assert(!has(b, 7, 0, 3, 0)); b[6][0] = 'R_P'; assert(has(b, 7, 0, 3, 0)); b[5][0] = 'B_P'; assert(!has(b, 7, 0, 3, 0));
});
test('soldier gains sideways moves after river, never backwards', () => {
    const b = empty(); b[6][0] = 'R_P'; assert(has(b, 6, 0, 5, 0)); assert(!has(b, 6, 0, 6, 1));
    b[4][0] = 'R_P'; assert(has(b, 4, 0, 4, 1)); assert(!has(b, 4, 0, 5, 0));
});
test('black soldier moves downward after crossing', () => {
    const b = empty(); b[5][0] = 'B_P'; assert(has(b, 5, 0, 6, 0)); assert(has(b, 5, 0, 5, 1)); assert(!has(b, 5, 0, 4, 0));
});
test('general and advisor stay inside palace', () => {
    const b = empty(); b[9][3] = 'R_A'; assert(has(b, 9, 3, 8, 4)); assert(!has(b, 9, 3, 8, 2));
    assert(!has(b, 9, 4, 9, 2));
});
test('uncovering flying generals is forbidden', () => {
    const b = empty(); b[5][4] = 'R_R'; assert(!has(b, 5, 4, 5, 3)); b[5][4] = null; assert(rules.isInCheck(b, 'red')); assert(rules.isInCheck(b, 'black'));
});
test('pinned piece cannot expose own general to rook', () => {
    const b = empty(); b[9][0] = 'B_R'; b[9][2] = 'R_R'; assert(!has(b, 9, 2, 8, 2));
});
test('checkmate is a loss', () => {
    const b = empty(); b[1][4] = 'R_R'; b[1][3] = 'R_R'; b[1][5] = 'R_R'; assert(rules.isCheckmate(b, 'black'));
});
test('stalemate is a loss without check', () => {
    const b = empty(); b[2][3] = 'R_R'; b[2][5] = 'R_R'; b[1][0] = 'R_R'; assert(rules.isStalemate(b, 'black')); assert.equal(rules.generateLegalMoves(b, 'black').length, 0);
});
test('applyMove and legal generation do not mutate input', () => {
    const b = rules.createInitialBoard(), before = JSON.stringify(b);
    const moves = rules.generateLegalMoves(b, 'red'); const next = rules.applyMove(b, moves[0]);
    assert.equal(JSON.stringify(b), before); assert.notDeepEqual(next, b);
});

const ai = require('../public/js/xiangqi-ai');
test('AI returns a legal move without mutating the board', () => {
    const b = rules.createInitialBoard(), before = JSON.stringify(b);
    const move = ai.findBestMove(b, 'red', { timeMs: 100 });
    assert(rules.generateLegalMoves(b, 'red').some(m => JSON.stringify(m) === JSON.stringify(move)));
    assert.equal(JSON.stringify(b), before);
});
test('AI finds mate in one', () => {
    const b = empty(); b[1][3] = 'R_R'; b[1][5] = 'R_R'; b[2][4] = 'R_R';
    const move = ai.findBestMove(b, 'red', { timeMs: 1000 });
    assert(rules.isCheckmate(rules.applyMove(b, move), 'black'));
});
test('AI resumable fallback respects time budget and no legal moves', () => {
    const b = empty(); b[1][4] = 'R_R'; b[1][3] = 'R_R'; b[1][5] = 'R_R';
    assert.equal(ai.findBestMove(b, 'black', { timeMs: 20 }), null);
    const start = Date.now(); const search = ai.createSearch(rules.createInitialBoard(), 'red', { timeMs: 30 });
    let state; do { state = search.step(3); } while (!state.done);
    assert(state.bestMove); assert(Date.now() - start < 500);
});

console.log(count + ' Xiangqi tests passed');
