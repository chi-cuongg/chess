class XOGame {
    constructor() {
        this.size = 15;
        this.board = Array(this.size).fill().map(() => Array(this.size).fill(null));
        this.turn = 'X';
        this.isGameOver = false;
        // init is called externally or we can default call it logic-wise, 
        // but manager handles UI init via CreateBoard
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
        // ... (unchanged, just omitting from replace block if possible, but replace_file needs contiguous)
        // Wait, init calls createBoard. Let's just replace Init and HandleClick logic separately or carefully.
        // Actually replacement chunk needs contiguous. Let's do Init first.
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

        // Update Logic
        this.board[r][c] = this.turn;
        this.renderPiece(r, c, this.turn);

        // Track history
        this.history.push({ r, c, player: this.turn });


        // Check win
        if (this.checkWin(r, c, this.turn)) {
            this.isGameOver = true;
            this.updateStatus(`Người thắng: ${this.turn}!`);
            this.showGameOver(`Người chơi ${this.turn} thắng!`);
            return;
        }

        // Switch turn
        this.turn = this.turn === 'X' ? 'O' : 'X';
        this.updateStatus(`Lượt: ${this.turn}`);
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
                if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size && this.board[nr][nc] === player) {
                    count++;
                } else {
                    break;
                }
            }

            // Check backward
            for (let i = 1; i < 5; i++) {
                const nr = r - dr * i;
                const nc = c - dc * i;
                if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size && this.board[nr][nc] === player) {
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

            // Re-bind play again button specific to this instance if needed, 
            // but Manager handles "New Game". 
            // The modal's "Play Again" button might still be bound to ChessGame's internal logic 
            // if we don't handle it globally or locally. 
            // For now, let's just show the modal.
        }
    }

    newGame() {
        this.init();
        document.getElementById('game-over-modal')?.classList.remove('show');
    }

    undoMove() {
        if (this.history.length === 0 || this.isGameOver) return;
        const lastMove = this.history.pop();
        this.board[lastMove.r][lastMove.c] = null;

        const square = document.querySelector(`.xo-board .square[data-row="${lastMove.r}"][data-col="${lastMove.c}"]`);
        if (square) {
            square.innerHTML = '';
            square.className = 'square';
            square.classList.remove(lastMove.player.toLowerCase());
        }

        this.turn = lastMove.player;
        this.updateStatus(`Lượt: ${this.turn}`);
        this.isGameOver = false;
    }
}
