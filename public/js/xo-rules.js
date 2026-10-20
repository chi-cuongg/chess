const XORules = (() => {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    function checkWin(board, r, c) {
        const player = board[r]?.[c];
        if (!player) return null;
        for (const [dr, dc] of directions) {
            const line = [{ r, c }];
            for (let i = 1; i < 5 && board[r - dr * i]?.[c - dc * i] === player; i++) line.unshift({ r: r - dr * i, c: c - dc * i });
            const index = line.length - 1;
            for (let i = 1; i < 5 && board[r + dr * i]?.[c + dc * i] === player; i++) line.push({ r: r + dr * i, c: c + dc * i });
            if (line.length >= 5) return line.slice(Math.max(0, index - 4), Math.max(0, index - 4) + 5);
        }
        return null;
    }
    const isFull = board => board.every(row => row.every(Boolean));
    return { checkWin, isFull, directions };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = XORules;
