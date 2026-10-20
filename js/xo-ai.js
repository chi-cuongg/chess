const XOAI = (() => {
    const rules = typeof module !== 'undefined' && module.exports ? require('./xo-rules') : XORules;
    const other = side => side === 'X' ? 'O' : 'X';
    function candidates(board) {
        const cells = new Map();
        for (let r = 0; r < board.length; r++) for (let c = 0; c < board[r].length; c++) {
            if (!board[r][c]) continue;
            for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < board.length && nc >= 0 && nc < board[nr].length && !board[nr][nc]) cells.set(nr + ':' + nc, { r: nr, c: nc });
            }
        }
        if (!cells.size && !rules.isFull(board)) return [{ r: Math.floor(board.length / 2), c: Math.floor(board[0].length / 2) }];
        return [...cells.values()];
    }
    // Score both contiguous and broken threats through the proposed move.
    function pattern(board, move, side) {
        const { r, c } = move;
        let score = 0;
        for (const [dr, dc] of rules.directions) {
            let line = '';
            for (let i = -4; i <= 4; i++) {
                const nr = r + dr * i, nc = c + dc * i;
                const cell = i === 0 ? side : board[nr]?.[nc];
                line += nr < 0 || nr >= board.length || nc < 0 || nc >= board[0].length ? '#' : cell === side ? 'S' : cell ? '#' : '.';
            }
            let left = 3, right = 5;
            while (left >= 0 && line[left] === 'S') left--;
            while (right < 9 && line[right] === 'S') right++;
            const length = right - left - 1;
            const open = Number(line[left] === '.') + Number(line[right] === '.');
            if (length >= 5) score += 10000000;
            else if (length === 4) score += open === 2 ? 100000 : open === 1 ? 15000 : 0;
            else if (length === 3) score += open === 2 ? 6000 : open === 1 ? 400 : 0;
            else if (length === 2) score += open === 2 ? 300 : open === 1 ? 30 : 0;
            for (let start = 0; start <= 4; start++) {
                const window = line.slice(start, start + 5);
                if (window.includes('#')) continue;
                const stones = window.split('S').length - 1;
                score += [0, 1, 10, 150, 3500, 1000000][stones];
            }
        }
        return score;
    }
    function ranked(board, side) {
        return candidates(board).map(move => ({ ...move, score: pattern(board, move, side) + pattern(board, move, other(side)) * 1.15 }))
            .sort((a, b) => b.score - a.score);
    }
    function winAt(board, move, side) {
        board[move.r][move.c] = side;
        const win = !!rules.checkWin(board, move.r, move.c);
        board[move.r][move.c] = null;
        return win;
    }
    function createSearch(input, side, options = {}) {
        const board = input.map(row => [...row]);
        const deadline = Date.now() + (options.timeMs ?? (options.difficulty === 6 ? 800 : 200));
        const moves = ranked(board, side);
        let bestMove = moves[0] || null;
        let done = !bestMove;
        // Forced wins/blocks are considered over every candidate, before top-N pruning.
        const win = moves.find(m => winAt(board, m, side));
        const block = moves.find(m => winAt(board, m, other(side)));
        if (win || block) { bestMove = win || block; done = true; }
        if ((options.difficulty || 2) <= 2) done = true;
        const timeout = Symbol('timeout');
        function* negamax(player, depth, alpha, beta, ply) {
            if (Date.now() >= deadline) throw timeout;
            yield;
            const rankedMoves = ranked(board, player);
            if (!rankedMoves.length) return 0;
            const immediate = rankedMoves.find(m => winAt(board, m, player));
            if (immediate) return 100000000 - ply;
            if (depth === 0) {
                const attack = Math.max(...rankedMoves.map(m => pattern(board, m, player)));
                const defense = Math.max(...rankedMoves.map(m => pattern(board, m, other(player))));
                return attack - defense * 1.2;
            }
            const forced = rankedMoves.find(m => winAt(board, m, other(player)));
            const next = forced ? [forced] : rankedMoves.slice(0, 8);
            let value = -Infinity;
            for (const move of next) {
                board[move.r][move.c] = player;
                let score;
                try { score = -(yield* negamax(other(player), depth - 1, -beta, -alpha, ply + 1)); }
                finally { board[move.r][move.c] = null; }
                value = Math.max(value, score); alpha = Math.max(alpha, score);
                if (alpha >= beta) break;
            }
            return value;
        }
        function* deepen() {
            for (let depth = 1; depth <= (options.difficulty === 6 ? 4 : 2); depth++) {
                let iteration = bestMove, bestScore = -Infinity;
                for (const move of moves.slice(0, 8)) {
                    board[move.r][move.c] = side;
                    let score;
                    try { score = -(yield* negamax(other(side), depth - 1, -Infinity, -bestScore, 1)); }
                    finally { board[move.r][move.c] = null; }
                    if (score > bestScore) { bestScore = score; iteration = move; }
                }
                bestMove = iteration;
            }
        }
        const iterator = deepen();
        return { step(sliceMs = 8) {
            const end = Math.min(deadline, Date.now() + sliceMs);
            try { while (!done && Date.now() < end) done = iterator.next().done; }
            catch (error) { if (error !== timeout) throw error; done = true; }
            if (Date.now() >= deadline) done = true;
            return { done, bestMove: bestMove ? { r: bestMove.r, c: bestMove.c } : null };
        } };
    }
    function findBestMove(board, side, options = {}) {
        const search = createSearch(board, side, options);
        let result;
        do { result = search.step(20); } while (!result.done);
        return result.bestMove;
    }
    return { findBestMove, createSearch, candidates, pattern };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = XOAI;
