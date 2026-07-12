/* exported XOGame */
class XOGame {
    constructor() {
        this.size = 15;
        this.board = Array(this.size).fill().map(() => Array(this.size).fill(null));
        this.turn = 'X';
        this.isGameOver = false;
        this.history = [];
        this.playingAgainstAI = false;
        this.aiPlayer = 'O';
    }

    init() {
        this.board = Array(this.size).fill().map(() => Array(this.size).fill(null));
        this.turn = 'X';
        this.isGameOver = false;
        this.history = []; // Track moves for undo
        this.createBoard();
        this.updateStatus('Lượt: X');
    }

    createBoard() {
        const chessboard = document.getElementById('chessboard');
        chessboard.innerHTML = '';
        chessboard.className = 'xo-board';

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.dataset.row = r;
                square.dataset.col = c;
                square.addEventListener('click', () => this.handleClick(r, c));
                chessboard.appendChild(square);
            }
        }
    }

    handleClick(r, c) {
        if (this.isGameOver || this.board[r][c]) return;
        if (this.playingAgainstAI && this.turn === this.aiPlayer) return;

        this.placeMove(r, c);

        if (this.playingAgainstAI && !this.isGameOver && this.turn === this.aiPlayer) {
            this.updateStatus('AI đang suy nghĩ...');
            setTimeout(() => this.makeAIMove(), 300);
        }
    }

    placeMove(r, c) {
        this.board[r][c] = this.turn;
        this.renderPiece(r, c, this.turn);
        this.history.push({ r, c, player: this.turn });

        // Check win
        if (this.checkWin(r, c, this.turn)) {
            this.isGameOver = true;
            this.updateStatus(`Người thắng: ${this.turn}!`);
            this.showGameOver(`Người chơi ${this.turn} thắng!`);
            return;
        }

        // Check draw: board is full
        if (this.history.length >= this.size * this.size) {
            this.isGameOver = true;
            this.updateStatus('Hòa - Bàn cờ đã đầy!');
            this.showGameOver('Hòa! Bàn cờ đã đầy.');
            return;
        }

        // Switch turn
        this.turn = this.turn === 'X' ? 'O' : 'X';
        this.updateStatus(`Lượt: ${this.turn}`);
    }

    toggleAI() {
        const button = document.getElementById('play-ai-btn');

        if (this.playingAgainstAI) {
            this.playingAgainstAI = false;
            if (button) {
                button.innerHTML = '<span class="btn-icon">🤖</span> Chơi với AI';
                button.classList.remove('btn-secondary');
                button.classList.add('btn-accent');
            }
            this.updateStatus('Chế độ 2 người chơi');
        } else {
            this.playingAgainstAI = true;
            if (button) {
                button.innerHTML = '<span class="btn-icon">👥</span> Chơi 2 người';
                button.classList.remove('btn-accent');
                button.classList.add('btn-secondary');
            }
            this.updateStatus('Chế độ chơi với AI (AI cầm quân O)');

            if (!this.isGameOver && this.turn === this.aiPlayer) {
                setTimeout(() => this.makeAIMove(), 300);
            }
        }
    }

    makeAIMove() {
        if (this.isGameOver || !this.playingAgainstAI || this.turn !== this.aiPlayer) return;

        const cell = this.findBestCell();
        if (cell) {
            this.placeMove(cell.r, cell.c);
        }
    }

    // ========================================
    // Heuristic AI: score every candidate cell by the strength of the
    // lines it creates (attack) and the opponent lines it blocks (defense)
    // ========================================
    findBestCell() {
        const opponent = this.aiPlayer === 'O' ? 'X' : 'O';

        // First move: play the center
        if (this.history.length === 0) {
            const mid = Math.floor(this.size / 2);
            return { r: mid, c: mid };
        }

        let best = null;
        let bestScore = -Infinity;

        for (const { r, c } of this.candidateCells()) {
            const score =
                this.scorePlacement(r, c, this.aiPlayer) +
                0.9 * this.scorePlacement(r, c, opponent);
            if (score > bestScore) {
                bestScore = score;
                best = { r, c };
            }
        }

        return best;
    }

    // Only consider empty cells within distance 2 of an existing stone
    candidateCells() {
        const seen = new Set();
        const cells = [];

        for (const mv of this.history) {
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    const r = mv.r + dr;
                    const c = mv.c + dc;
                    if (r < 0 || r >= this.size || c < 0 || c >= this.size) continue;
                    if (this.board[r][c]) continue;
                    const key = r * this.size + c;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    cells.push({ r, c });
                }
            }
        }

        return cells;
    }

    // Score of placing `player` at (r,c): sum the value of the runs it
    // would form in all 4 directions
    scorePlacement(r, c, player) {
        const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
        let total = 0;

        for (const [dr, dc] of directions) {
            let run = 1;
            let openEnds = 0;

            // Forward
            let i = 1;
            while (this.inBounds(r + dr * i, c + dc * i) && this.board[r + dr * i][c + dc * i] === player) {
                run++;
                i++;
            }
            if (this.inBounds(r + dr * i, c + dc * i) && !this.board[r + dr * i][c + dc * i]) openEnds++;

            // Backward
            i = 1;
            while (this.inBounds(r - dr * i, c - dc * i) && this.board[r - dr * i][c - dc * i] === player) {
                run++;
                i++;
            }
            if (this.inBounds(r - dr * i, c - dc * i) && !this.board[r - dr * i][c - dc * i]) openEnds++;

            total += this.runValue(run, openEnds);
        }

        return total;
    }

    runValue(run, openEnds) {
        if (run >= 5) return 10000000;               // five in a row
        if (openEnds === 0) return 0;                // dead line
        if (run === 4) return openEnds === 2 ? 1000000 : 100000;
        if (run === 3) return openEnds === 2 ? 10000 : 500;
        if (run === 2) return openEnds === 2 ? 100 : 10;
        return openEnds === 2 ? 5 : 1;
    }

    inBounds(r, c) {
        return r >= 0 && r < this.size && c >= 0 && c < this.size;
    }

    renderPiece(r, c, type) {
        const square = document.querySelector(`.xo-board .square[data-row="${r}"][data-col="${c}"]`);
        if (square) {
            square.classList.add(type.toLowerCase());
            const piece = document.createElement('div');
            piece.className = `xo-piece ${type.toLowerCase()}`;
            piece.textContent = type;
            square.appendChild(piece);
        }
    }

    checkWin(r, c, player) {
        const directions = [
            [0, 1],   // Horizontal
            [1, 0],   // Vertical
            [1, 1],   // Diagonal \
            [1, -1]   // Diagonal /
        ];

        for (const [dr, dc] of directions) {
            let count = 1;

            // Check forward
            for (let i = 1; i < 5; i++) {
                const nr = r + dr * i;
                const nc = c + dc * i;
                if (this.inBounds(nr, nc) && this.board[nr][nc] === player) {
                    count++;
                } else {
                    break;
                }
            }

            // Check backward
            for (let i = 1; i < 5; i++) {
                const nr = r - dr * i;
                const nc = c - dc * i;
                if (this.inBounds(nr, nc) && this.board[nr][nc] === player) {
                    count++;
                } else {
                    break;
                }
            }

            if (count >= 5) return true;
        }
        return false;
    }

    updateStatus(msg) {
        const status = document.getElementById('game-status');
        if (status) status.textContent = msg;
    }

    showGameOver(msg) {
        const modal = document.getElementById('game-over-modal');
        const message = document.getElementById('game-over-message');
        const title = document.getElementById('game-over-title');

        if (modal && message && title) {
            title.textContent = 'Kết thúc!';
            message.textContent = msg;
            modal.classList.add('show');
        }
    }

    newGame() {
        this.init();
        document.getElementById('game-over-modal')?.classList.remove('show');
    }

    undoMove() {
        if (this.history.length === 0) return;
        if (this.isGameOver) {
            document.getElementById('game-over-modal')?.classList.remove('show');
        }

        // Undo one move (or two when playing against the AI)
        const undoCount = this.playingAgainstAI ? 2 : 1;
        for (let i = 0; i < undoCount && this.history.length > 0; i++) {
            const lastMove = this.history.pop();
            this.board[lastMove.r][lastMove.c] = null;

            const square = document.querySelector(`.xo-board .square[data-row="${lastMove.r}"][data-col="${lastMove.c}"]`);
            if (square) {
                square.innerHTML = '';
                square.className = 'square';
            }

            this.turn = lastMove.player;
        }

        this.updateStatus(`Lượt: ${this.turn}`);
        this.isGameOver = false;
    }
}
