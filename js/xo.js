class XOGame {
    constructor() {
        this.size = 15;
        this.playingAgainstAI = false;
        this.onClick = e => {
            const square = e.target.closest('.square');
            if (square && this.boardEl.contains(square)) this.handleClick(Number(square.dataset.row), Number(square.dataset.col));
        };
    }

    init() {
        this.active = true;
        this.boardEl = document.getElementById('chessboard');
        this.boardEl.className = 'xo-board';
        this.boardEl.innerHTML = '';
        this.squares = [];
        for (let r = 0; r < this.size; r++) for (let c = 0; c < this.size; c++) {
            const square = document.createElement('div');
            square.className = 'square';
            square.dataset.row = r;
            square.dataset.col = c;
            this.squares.push(square);
            this.boardEl.appendChild(square);
        }
        this.boardEl.addEventListener('click', this.onClick);
        this.newGame();
    }

    newGame() {
        this.cancelAI();
        this.board = Array.from({ length: this.size }, () => Array(this.size).fill(null));
        this.turn = 'X';
        this.history = [];
        this.isGameOver = false;
        this.winningLine = null;
        document.getElementById('game-over-modal').classList.remove('show');
        this.refresh();
    }

    handleClick(r, c) {
        if (!this.active || this.isGameOver || this.aiThinking || this.board[r][c] || this.playingAgainstAI && this.turn === 'O') return;
        this.makeMove({ r, c });
    }

    makeMove(move) {
        const { r, c } = move;
        if (this.board[r][c] || this.isGameOver) return;
        this.board[r][c] = this.turn;
        this.history.push({ r, c, player: this.turn });
        this.winningLine = XORules.checkWin(this.board, r, c);
        this.isGameOver = !!this.winningLine || XORules.isFull(this.board);
        if (this.isGameOver) {
            const message = this.winningLine ? `Người chơi ${this.turn} thắng!` : 'Hòa! Bàn cờ đã đầy.';
            this.updateStatus(message);
            document.getElementById('game-over-title').textContent = 'Kết thúc!';
            document.getElementById('game-over-message').textContent = message;
            document.getElementById('game-over-modal').classList.add('show');
        } else this.turn = this.turn === 'X' ? 'O' : 'X';
        this.refresh();
        this.scheduleAI();
    }

    refresh() {
        if (!this.isGameOver) this.updateStatus(`Lượt: ${this.turn}`);
        document.querySelector('#turn-indicator span:last-child').textContent = `Lượt: ${this.turn}`;
        document.querySelector('#turn-indicator .turn-dot').className = `turn-dot ${this.turn === 'X' ? 'red-turn' : 'white-turn'}`;
        this.renderBoard();
    }

    renderBoard() {
        this.boardEl.dataset.turn = this.turn;
        this.boardEl.classList.toggle('locked', this.isGameOver || this.aiThinking);
        const last = this.history[this.history.length - 1];
        for (const square of this.squares) {
            const r = Number(square.dataset.row), c = Number(square.dataset.col);
            const piece = this.board[r][c] || '';
            if (square.dataset.piece !== piece) {
                square.innerHTML = '';
                square.dataset.piece = piece;
                if (piece) {
                    const node = document.createElement('div');
                    node.className = 'xo-piece ' + piece.toLowerCase();
                    node.textContent = piece;
                    square.appendChild(node);
                }
            }
            square.classList.toggle('last-move', last?.r === r && last?.c === c);
            square.classList.toggle('winning-cell', !!this.winningLine?.some(p => p.r === r && p.c === c));
        }
    }

    undoMove() {
        this.cancelAI();
        const count = this.playingAgainstAI && this.history[this.history.length - 1]?.player === 'O' ? 2 : 1;
        for (let i = 0; i < count && this.history.length; i++) {
            const move = this.history.pop();
            this.board[move.r][move.c] = null;
            this.turn = move.player;
        }
        this.isGameOver = false;
        this.winningLine = null;
        document.getElementById('game-over-modal').classList.remove('show');
        this.refresh();
        this.scheduleAI();
    }

    setAI(enabled, difficulty) {
        this.cancelAI();
        this.playingAgainstAI = enabled && Number(difficulty) > 0;
        this.difficulty = Number(difficulty) || 4;
        this.refresh();
        this.scheduleAI();
    }

    scheduleAI() {
        if (!this.active || !this.playingAgainstAI || this.isGameOver || this.turn !== 'O' || this.aiThinking) return;
        this.aiThinking = true;
        this.updateStatus('AI đang suy nghĩ...');
        this.renderBoard();
        const requestId = this.requestId;
        const accept = move => {
            if (requestId !== this.requestId || !this.active || !this.aiThinking) return;
            this.aiThinking = false;
            this.worker?.terminate();
            this.worker = null;
            if (move && this.board[move.r]?.[move.c] === null) this.makeMove(move);
            else this.refresh();
        };
        const fallback = () => {
            if (requestId !== this.requestId || !this.active) return;
            this.worker?.terminate();
            this.worker = null;
            const search = XOAI.createSearch(this.board, 'O', { difficulty: this.difficulty });
            const step = () => {
                if (requestId !== this.requestId || !this.active) return;
                const state = search.step(8);
                if (state.done) accept(state.bestMove);
                else this.aiTimer = setTimeout(step, 0);
            };
            this.aiTimer = setTimeout(step, 0);
        };
        try {
            this.worker = new Worker('js/ai-worker.js');
            this.worker.onmessage = e => {
                if (e.data.requestId === requestId) accept(e.data.bestMove);
            };
            this.worker.onerror = fallback;
            this.worker.postMessage({ game: 'xo', requestId, board: this.board, color: 'O', difficulty: this.difficulty });
        } catch (error) { fallback(); }
    }

    cancelAI() {
        this.requestId = (this.requestId || 0) + 1;
        clearTimeout(this.aiTimer);
        this.worker?.terminate();
        this.worker = null;
        this.aiThinking = false;
    }

    updateStatus(message) {
        document.getElementById('game-status').textContent = message;
    }

    destroy() {
        this.cancelAI();
        this.active = false;
        this.boardEl.removeEventListener('click', this.onClick);
    }
}
