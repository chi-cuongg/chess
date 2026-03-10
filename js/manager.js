class GameManager {
    constructor() {
        this.currentGame = null;
        this.gameType = 'chess';
        this.init();
    }

    init() {
        // Initialize with Chess by default
        this.currentGame = window.chessGame; // Existing instance

        // Setup selector listener
        const selector = document.getElementById('game-type-selector');
        if (selector) {
            selector.addEventListener('change', (e) => this.switchGame(e.target.value));
        }

        this.bindGlobalEvents();
    }

    bindGlobalEvents() {
        document.getElementById('new-game-btn')?.addEventListener('click', () => {
            if (this.currentGame && typeof this.currentGame.newGame === 'function') {
                this.currentGame.newGame();
            } else if (this.currentGame && typeof this.currentGame.init === 'function') {
                this.currentGame.init();
            }
        });

        document.getElementById('undo-btn')?.addEventListener('click', () => {
            if (this.currentGame && typeof this.currentGame.undoMove === 'function') {
                this.currentGame.undoMove();
            }
        });

        document.getElementById('play-again-btn')?.addEventListener('click', () => {
            document.getElementById('game-over-modal')?.classList.remove('show');
            if (this.currentGame && typeof this.currentGame.newGame === 'function') {
                this.currentGame.newGame();
            } else if (this.currentGame && typeof this.currentGame.init === 'function') {
                this.currentGame.init();
            }
        });
    }

    switchGame(type) {
        if (this.gameType === type) return;

        // Cleanup current game if needed
        const oldBoard = document.getElementById('chessboard');
        const newBoard = oldBoard.cloneNode(false); // Clone without children to be safe and clear listeners
        oldBoard.parentNode.replaceChild(newBoard, oldBoard);

        const chessboard = newBoard;
        chessboard.innerHTML = '';
        chessboard.className = 'chessboard'; // Default reset

        this.gameType = type;

        switch (type) {

            case 'chess':
                chessboard.className = 'chessboard';
                this.currentGame = window.chessGame;
                this.currentGame.init(); // Re-init chess
                break;
            case 'xiangqi':
                chessboard.className = 'xiangqi-board'; // Reset class completely
                if (!window.xiangqiGame) window.xiangqiGame = new XiangqiGame();
                this.currentGame = window.xiangqiGame;
                this.currentGame.init();
                break;
            case 'xo':
                chessboard.className = 'xo-board'; // Reset class completely
                if (!window.xoGame) window.xoGame = new XOGame();
                this.currentGame = window.xoGame;
                this.currentGame.init();
                break;
        }

        // Update labels
        this.updateUI(type);
    }

    updateUI(type) {
        const rowLabels = document.querySelector('.row-labels');
        const colLabels = document.querySelector('.col-labels');
        const capturedSections = document.querySelectorAll('.captured-section');

        if (type === 'chess') {
            rowLabels.style.display = 'flex';
            colLabels.style.display = 'flex';
            capturedSections.forEach(el => el.style.display = 'block');
        } else {
            rowLabels.style.display = 'none';
            colLabels.style.display = 'none';
            capturedSections.forEach(el => el.style.display = 'none');
        }
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    // Wait for other scripts to load
    setTimeout(() => {
        window.gameManager = new GameManager();
    }, 200);
});
