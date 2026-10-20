// Shared controller contract: init, newGame, undoMove, setAI, destroy.
class GameManager {
    constructor() {
        this.gameType = 'chess';
        this.currentGame = window.chessGame;
        const selector = document.getElementById('game-type-selector');
        selector.addEventListener('change', e => this.switchGame(e.target.value));
        this.bindGlobalEvents();
        this.updateUI();
        new MutationObserver(() => this.updateOnlineLock()).observe(
            document.getElementById('online-status'), { childList: true, subtree: true });
        try {
            const saved = localStorage.getItem('board-game-type');
            if (!new URLSearchParams(location.search).has('room')) this.switchGame(saved);
        } catch (e) { /* Storage may be unavailable. */ }
    }

    inOnlineRoom() {
        const online = window.onlineManager;
        return !!(online && (online.isConnected || online.roomId && online.peer));
    }

    updateOnlineLock() {
        const locked = this.inOnlineRoom();
        const selector = document.getElementById('game-type-selector');
        selector.disabled = locked;
        selector.title = locked ? 'Không thể đổi loại cờ khi đang trong phòng online.' : '';
        document.getElementById('play-ai-btn').disabled = locked;
        document.getElementById('ai-difficulty').disabled = locked;
    }

    bindGlobalEvents() {
        for (const id of ['new-game-btn', 'play-again-btn']) {
            document.getElementById(id).addEventListener('click', () => {
                document.getElementById('game-over-modal').classList.remove('show');
                if (this.inOnlineRoom()) return;
                this.currentGame.newGame();
            });
        }
        document.getElementById('undo-btn').addEventListener('click', () => {
            if (!this.inOnlineRoom()) this.currentGame.undoMove();
        });
        document.getElementById('play-ai-btn').addEventListener('click', () => {
            if (!this.inOnlineRoom()) this.setAI(!this.currentGame.playingAgainstAI);
        });
        document.getElementById('ai-difficulty').addEventListener('change', () => {
            if (!this.inOnlineRoom()) this.setAI(this.currentGame.playingAgainstAI);
        });
        document.getElementById('history-btn').addEventListener('click', () => {
            if (this.gameType !== 'chess') return;
            window.gameHistory.renderHistoryModal();
            document.getElementById('history-modal').classList.add('show');
        });
    }

    setAI(enabled) {
        this.currentGame.setAI(enabled, document.getElementById('ai-difficulty').value);
        this.updateUI();
    }

    switchGame(type) {
        if (!['chess', 'xiangqi', 'xo'].includes(type) || type === this.gameType) return;
        if (this.inOnlineRoom()) {
            document.getElementById('game-type-selector').value = this.gameType;
            this.currentGame.updateStatus('Không thể đổi loại cờ khi đang trong phòng online.');
            return;
        }
        this.currentGame.destroy();
        document.querySelectorAll('.modal.show').forEach(el => el.classList.remove('show'));
        document.querySelectorAll('.flipped').forEach(el => el.classList.remove('flipped'));
        const oldBoard = document.getElementById('chessboard');
        const board = oldBoard.cloneNode(false);
        board.className = type === 'chess' ? 'chessboard' : `${type}-board`;
        oldBoard.replaceWith(board);
        this.gameType = type;
        if (type === 'chess') this.currentGame = window.chessGame;
        else {
            const key = type === 'xiangqi' ? 'xiangqiGame' : 'xoGame';
            if (!window[key]) window[key] = type === 'xiangqi' ? new XiangqiGame() : new XOGame();
            this.currentGame = window[key];
            // Legacy UI adapters, replaced by each controller's implementation below.
            if (!this.currentGame.destroy) this.currentGame.destroy = function () { this.active = false; };
            if (!this.currentGame.setAI) this.currentGame.setAI = function () {
                this.playingAgainstAI = false;
                this.updateStatus('AI sẽ được bổ sung cho loại cờ này.');
            };
        }
        this.currentGame.init();
        try { localStorage.setItem('board-game-type', type); } catch (e) { /* Optional persistence. */ }
        this.updateUI();
    }

    updateUI() {
        const chess = this.gameType === 'chess';
        document.getElementById('game-type-selector').value = this.gameType;
        for (const selector of ['.row-labels', '.col-labels', '#online-panel', '#history-btn']) {
            document.querySelector(selector).style.display = chess ? '' : 'none';
        }
        document.getElementById('history-btn').disabled = !chess;
        document.querySelectorAll('.captured-section').forEach(el => {
            el.style.display = this.gameType === 'xo' ? 'none' : '';
        });
        const ai = this.currentGame.playingAgainstAI;
        document.getElementById('play-ai-btn').textContent = ai ? '👥 Chơi 2 người' : '🤖 Chơi với AI';
        this.updateOnlineLock();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.gameManager = new GameManager();
});
