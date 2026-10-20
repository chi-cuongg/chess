const XiangqiAI = (() => {
    const rules = typeof module !== 'undefined' && module.exports ? require('./xiangqi-rules') : XiangqiRules;
    const values = { K: 10000, R: 900, C: 450, H: 400, E: 200, A: 200, P: 100 };
    const tables = {};
    for (const type of Object.keys(values)) {
        tables[type] = Array.from({ length: 10 }, (_, advance) => Array.from({ length: 9 }, (_, c) => {
            const center = 4 - Math.abs(4 - c);
            return type === 'P' ? advance * 8 + (advance >= 5 ? 30 + center * 4 : 0)
                : ['H', 'C', 'R'].includes(type) ? center * 5 + advance * 2 : center * 2;
        }));
    }
    function evaluate(board, color) {
        let score = 0;
        for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
            const code = board[r][c];
            if (!code) continue;
            const side = rules.colorOf(code);
            const advance = side === 'red' ? 9 - r : r;
            score += (side === color ? 1 : -1) * (values[code[2]] + tables[code[2]][advance][c]);
        }
        return score;
    }
    function ordered(board, moves, preferred) {
        const priority = m => {
            const target = board[m.to.r][m.to.c];
            const capture = target ? values[target[2]] * 10 - values[board[m.from.r][m.from.c][2]] : 0;
            const same = preferred && m.from.r === preferred.from.r && m.from.c === preferred.from.c && m.to.r === preferred.to.r && m.to.c === preferred.to.c;
            return capture + (same ? 100000 : 0);
        };
        return moves.sort((a, b) => priority(b) - priority(a));
    }

    // A resumable generator allows the main-thread fallback to yield between nodes.
    function createSearch(board, color, options = {}) {
        const timeMs = options.timeMs ?? ({ 2: 200, 4: 800, 6: 2000 }[options.difficulty] || 800);
        const deadline = Date.now() + timeMs;
        const timeout = Symbol('timeout');
        const rootMoves = ordered(board, rules.generateLegalMoves(board, color));
        let bestMove = rootMoves[0] || null;
        let completedDepth = 0;
        let done = rootMoves.length === 0;
        function* negamax(position, side, depth, alpha, beta, ply) {
            if (Date.now() >= deadline) throw timeout;
            yield;
            const moves = ordered(position, rules.generateLegalMoves(position, side));
            if (!moves.length) return -100000 + ply;
            if (depth === 0) return evaluate(position, side);
            let value = -Infinity;
            for (const move of moves) {
                const score = -(yield* negamax(rules.applyMove(position, move), rules.opponent(side), depth - 1, -beta, -alpha, ply + 1));
                value = Math.max(value, score);
                alpha = Math.max(alpha, score);
                if (alpha >= beta) break;
            }
            return value;
        }
        function* deepen() {
            for (let depth = 1; depth <= (options.maxDepth || 6); depth++) {
                let iterationMove = bestMove, score = -Infinity;
                for (const move of ordered(board, [...rootMoves], bestMove)) {
                    const value = -(yield* negamax(rules.applyMove(board, move), rules.opponent(color), depth - 1, -Infinity, -score, 1));
                    if (value > score) { score = value; iterationMove = move; }
                }
                bestMove = iterationMove;
                completedDepth = depth;
                if (score >= 99900) return;
            }
        }
        const iterator = deepen();
        return {
            step(sliceMs = 8) {
                const end = Math.min(deadline, Date.now() + sliceMs);
                try {
                    while (!done && Date.now() < end) done = iterator.next().done;
                } catch (error) {
                    if (error !== timeout) throw error;
                    done = true;
                }
                if (Date.now() >= deadline) done = true;
                return { done, bestMove, completedDepth };
            }
        };
    }
    function findBestMove(board, color, options = {}) {
        const search = createSearch(board, color, options);
        let state;
        do { state = search.step(20); } while (!state.done);
        return state.bestMove;
    }
    return { createSearch, findBestMove, evaluate };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = XiangqiAI;
