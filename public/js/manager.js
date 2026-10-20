// Shared controller contract: init, newGame, undoMove, setAI, destroy.
class GameManager {
    constructor() {
        this.gameType = 'chess';
        this.currentGame = window.chessGame;
        const selector = document.getElementById('game-type-selector');
        selector.addEventListener('change', e => this.switchGame(e.target.value));
        this.bindGlobalEvents();
        this.setupBoardSizing();
        this.updateUI();
        new MutationObserver(() => this.updateOnlineLock()).observe(
            document.getElementById('online-status'), { childList: true, subtree: true });
        try {
            const saved = localStorage.getItem('board-game-type');
            if (!new URLSearchParams(location.search).has('room')) this.switchGame(saved);
        } catch (e) { /* Storage may be unavailable. */ }
    }

    setupBoardSizing() {
        const header = document.querySelector('.header');
        const update = () => {
            document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height}px`);
        };
        update();
        if (typeof ResizeObserver !== 'undefined') {
            this.headerObserver = new ResizeObserver(update);
            this.headerObserver.observe(header);
        } else window.addEventListener('resize', update);
        // Fonts may arrive after the initial layout. Re-measure their actual height.
        document.fonts?.ready.then(update);
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
        // Closing promotion cancels the pending choice before any piece is moved.
        const closeModal = modal => {
            if (modal.id === 'promotion-modal' && this.gameType === 'chess') {
                this.currentGame.pendingPromotion = null;
                this.currentGame.clearSelection();
                this.currentGame.emitState();
            }
            modal.classList.remove('show');
            document.getElementById('new-game-btn').focus();
        };
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', e => {
                if (e.target === modal || e.target.closest('.modal-close')) closeModal(modal);
            });
        });
        document.addEventListener('keydown', e => {
            const modal = document.querySelector('.modal.show');
            if (!modal) return;
            if (e.key === 'Escape') { e.preventDefault(); closeModal(modal); }
            if (e.key === 'Tab') {
                const controls = [...modal.querySelectorAll('button, input, select, [tabindex="0"]')].filter(el => !el.disabled);
                const first = controls[0], last = controls[controls.length - 1];
                if (first && !modal.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
                else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
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
        window.themeSwitcher?.resetEffects();
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
        }
        this.currentGame.init();
        this.currentGame.emitState?.();
        // Ambient effects restart with fresh timers; no old capture can fire.
        window.themeSwitcher?.applyEffectsState();
        try { localStorage.setItem('board-game-type', type); } catch (e) { /* Optional persistence. */ }
        this.updateUI();
    }

    updateUI() {
        const chess = this.gameType === 'chess';
        const name = { chess: 'Cờ vua', xiangqi: 'Cờ tướng', xo: 'Cờ Caro' }[this.gameType];
        document.getElementById('game-title').textContent = name;
        document.title = name + ' — Bàn cờ Việt';
        document.getElementById('captured-first-title').textContent = chess ? '⚪ Quân trắng bị bắt' : '🔴 Quân đỏ bị bắt';
        document.getElementById('captured-second-title').textContent = '⚫ Quân đen bị bắt';
        document.getElementById('chessboard').setAttribute('aria-label', 'Bàn ' + name.toLowerCase());
        document.getElementById('game-type-selector').value = this.gameType;
        for (const selector of ['.row-labels', '.col-labels', '#online-panel', '#chat-panel', '#history-btn']) {
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
