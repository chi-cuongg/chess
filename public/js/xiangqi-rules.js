// Pure Xiangqi rules shared by the browser, Node and workers.
const XiangqiRules = (() => {
    const inside = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;
    const colorOf = code => code ? (code[0] === 'R' ? 'red' : 'black') : null;
    const opponent = color => color === 'red' ? 'black' : 'red';
    const palace = (r, c, color) => c >= 3 && c <= 5 && (color === 'red' ? r >= 7 && r <= 9 : r >= 0 && r <= 2);

    function createInitialBoard() {
        const board = Array.from({ length: 10 }, () => Array(9).fill(null));
        const back = ['R', 'H', 'E', 'A', 'K', 'A', 'E', 'H', 'R'];
        for (let c = 0; c < 9; c++) {
            board[0][c] = 'B_' + back[c];
            board[9][c] = 'R_' + back[c];
            if (c % 2 === 0) { board[3][c] = 'B_P'; board[6][c] = 'R_P'; }
        }
        for (const c of [1, 7]) { board[2][c] = 'B_C'; board[7][c] = 'R_C'; }
        return board;
    }

    function applyMove(board, move) {
        const next = board.map(row => [...row]);
        next[move.to.r][move.to.c] = next[move.from.r][move.from.c];
        next[move.from.r][move.from.c] = null;
        return next;
    }

    function pseudoMoves(board, r, c) {
        const code = board[r][c];
        if (!code) return [];
        const color = colorOf(code);
        const type = code[2];
        const moves = [];
        const add = (tr, tc) => {
            if (inside(tr, tc) && colorOf(board[tr][tc]) !== color) moves.push({ from: { r, c }, to: { r: tr, c: tc } });
        };
        if (type === 'R' || type === 'C') {
            for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                let screen = false;
                for (let tr = r + dr, tc = c + dc; inside(tr, tc); tr += dr, tc += dc) {
                    if (!screen) {
                        if (!board[tr][tc]) add(tr, tc);
                        else {
                            if (type === 'R') { add(tr, tc); break; }
                            screen = true;
                        }
                    } else if (board[tr][tc]) { add(tr, tc); break; }
                }
            }
        } else if (type === 'H') {
            for (const [dr, dc] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]]) {
                const lr = r + (Math.abs(dr) === 2 ? Math.sign(dr) : 0);
                const lc = c + (Math.abs(dc) === 2 ? Math.sign(dc) : 0);
                if (inside(lr, lc) && !board[lr][lc]) add(r + dr, c + dc);
            }
        } else if (type === 'E') {
            for (const dr of [-2, 2]) for (const dc of [-2, 2]) {
                const tr = r + dr, tc = c + dc;
                if (inside(tr, tc) && (color === 'red' ? tr >= 5 : tr <= 4) && !board[r + dr / 2][c + dc / 2]) add(tr, tc);
            }
        } else if (type === 'A' || type === 'K') {
            const steps = type === 'A' ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
            for (const [dr, dc] of steps) if (palace(r + dr, c + dc, color)) add(r + dr, c + dc);
            // Flying general is also an attack along an otherwise empty file.
            if (type === 'K') for (const dr of [-1, 1]) {
                for (let tr = r + dr; inside(tr, c); tr += dr) {
                    if (board[tr][c]) {
                        if (board[tr][c][2] === 'K') add(tr, c);
                        break;
                    }
                }
            }
        } else if (type === 'P') {
            add(r + (color === 'red' ? -1 : 1), c);
            if (color === 'red' ? r <= 4 : r >= 5) { add(r, c - 1); add(r, c + 1); }
        }
        return moves;
    }

    function findGeneral(board, color) {
        const code = color === 'red' ? 'R_K' : 'B_K';
        for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) if (board[r][c] === code) return { r, c };
        return null;
    }

    function isInCheck(board, color) {
        const king = findGeneral(board, color);
        if (!king) return true;
        for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
            if (colorOf(board[r][c]) === opponent(color) && pseudoMoves(board, r, c).some(m => m.to.r === king.r && m.to.c === king.c)) return true;
        }
        return false;
    }

    function generateLegalMoves(board, color) {
        if (!findGeneral(board, color)) return [];
        const moves = [];
        for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
            if (colorOf(board[r][c]) !== color) continue;
            for (const move of pseudoMoves(board, r, c)) {
                // A checked general must escape; games finish before a general is captured.
                if (board[move.to.r][move.to.c]?.[2] === 'K') continue;
                if (!isInCheck(applyMove(board, move), color)) moves.push(move);
            }
        }
        return moves;
    }

    const isCheckmate = (board, color) => isInCheck(board, color) && generateLegalMoves(board, color).length === 0;
    const isStalemate = (board, color) => !isInCheck(board, color) && generateLegalMoves(board, color).length === 0;
    return { createInitialBoard, applyMove, generateLegalMoves, isInCheck, isCheckmate, isStalemate, findGeneral, colorOf, opponent, pseudoMoves };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = XiangqiRules;
