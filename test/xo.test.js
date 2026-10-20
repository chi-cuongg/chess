const assert = require('assert');
const rules = require('../js/xo-rules');
const ai = require('../js/xo-ai');
const empty = () => Array.from({ length: 15 }, () => Array(15).fill(null));
let count = 0;
function test(name, fn) { fn(); count++; console.log('  ok   ' + name); }
for (const [dr, dc] of rules.directions) test(`win direction ${dr},${dc}`, () => {
    const b = empty(); for (let i = 0; i < 5; i++) b[5 + dr * i][7 + dc * i] = 'X';
    const line = rules.checkWin(b, 5 + dr * 2, 7 + dc * 2);
    assert.equal(line.length, 5); assert(line.every(p => b[p.r][p.c] === 'X'));
});
test('four is not a win and empty cell has no line', () => {
    const b = empty(); for (let c = 0; c < 4; c++) b[0][c] = 'O'; assert.equal(rules.checkWin(b, 0, 0), null); assert.equal(rules.checkWin(b, 1, 1), null);
});
test('overline returns five including last move', () => {
    const b = empty(); for (let c = 0; c < 7; c++) b[0][c] = 'X';
    const line = rules.checkWin(b, 0, 6); assert.equal(line.length, 5); assert(line.some(p => p.c === 6));
});
for (const difficulty of [2, 4, 6]) {
    test(`AI finishes four at difficulty ${difficulty}`, () => {
        const b = empty(); for (let c = 4; c < 8; c++) b[7][c] = 'O';
        const m = ai.findBestMove(b, 'O', { difficulty }); assert(m.r === 7 && [3, 8].includes(m.c));
    });
    test(`AI blocks opponent four at difficulty ${difficulty}`, () => {
        const b = empty(); for (let c = 0; c < 4; c++) b[0][c] = 'X';
        assert.deepEqual(ai.findBestMove(b, 'O', { difficulty }), { r: 0, c: 4 });
    });
}
test('AI takes win before blocking', () => {
    const b = empty(); for (let c = 0; c < 4; c++) { b[0][c] = 'X'; b[14][c] = 'O'; }
    assert.deepEqual(ai.findBestMove(b, 'O'), { r: 14, c: 4 });
});
test('AI opens center, stays within radius 2 and never mutates input', () => {
    const b = empty(); assert.deepEqual(ai.findBestMove(b, 'X'), { r: 7, c: 7 }); b[7][7] = 'X';
    const before = JSON.stringify(b), m = ai.findBestMove(b, 'O', { difficulty: 6, timeMs: 40 });
    assert(!b[m.r][m.c]); assert(Math.abs(m.r - 7) <= 2 && Math.abs(m.c - 7) <= 2); assert.equal(JSON.stringify(b), before);
});
test('full board has no move', () => {
    const b = empty().map(row => row.map(() => 'X')); assert(rules.isFull(b)); assert.equal(ai.findBestMove(b, 'O'), null);
});
console.log(count + ' Caro tests passed');
