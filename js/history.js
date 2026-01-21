// ========================================
// Game History - Save & Replay Games
// ========================================

class GameHistory {
    constructor() {
        this.storageKey = 'chess-game-history';
        this.currentGame = null;
        this.maxGames = 20;
    }

    // ========================================
    // Start Recording a Game
    // ========================================
    startGame(mode, opponent = 'AI') {
        this.currentGame = {
            id: Date.now(),
            date: new Date().toISOString(),
            mode: mode, // 'local', 'ai', 'online'
            opponent: opponent,
            moves: [],
            result: null,
            winner: null,
            playerColor: 'white'
        };
    }

    // ========================================
    // Record a Move
    // ========================================
    recordMove(from, to, piece, captured = null, special = null) {
        if (!this.currentGame) return;

        this.currentGame.moves.push({
            from: { row: from.row, col: from.col },
            to: { row: to.row, col: to.col },
            piece: piece,
            captured: captured,
            special: special, // 'castle', 'enpassant', 'promotion'
            time: Date.now()
        });
    }

    // ========================================
    // End Game
    // ========================================
    endGame(result, winner = null) {
        if (!this.currentGame) return;

        this.currentGame.result = result; // 'checkmate', 'stalemate', 'resign', 'draw'
        this.currentGame.winner = winner;
        this.currentGame.duration = Date.now() - this.currentGame.id;

        this.saveGame(this.currentGame);
        this.currentGame = null;
    }

    // ========================================
    // Save Game to localStorage
    // ========================================
    saveGame(game) {
        const history = this.getHistory();
        history.unshift(game);

        // Limit history
        if (history.length > this.maxGames) {
            history.pop();
        }

        localStorage.setItem(this.storageKey, JSON.stringify(history));
    }

    // ========================================
    // Get All History
    // ========================================
    getHistory() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    // ========================================
    // Get Specific Game
    // ========================================
    getGame(id) {
        const history = this.getHistory();
        return history.find(g => g.id === id);
    }

    // ========================================
    // Delete Game
    // ========================================
    deleteGame(id) {
        const history = this.getHistory();
        const filtered = history.filter(g => g.id !== id);
        localStorage.setItem(this.storageKey, JSON.stringify(filtered));
    }

    // ========================================
    // Clear All History
    // ========================================
    clearHistory() {
        localStorage.removeItem(this.storageKey);
    }

    // ========================================
    // Convert to PGN Format
    // ========================================
    toPGN(game) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        let pgn = '';

        // Headers
        pgn += `[Event "Chess Master Game"]\n`;
        pgn += `[Date "${new Date(game.date).toISOString().split('T')[0]}"]\n`;
        pgn += `[White "Player"]\n`;
        pgn += `[Black "${game.opponent}"]\n`;
        pgn += `[Result "${this.getResultString(game)}"]\n\n`;

        // Moves
        game.moves.forEach((move, index) => {
            if (index % 2 === 0) {
                pgn += `${Math.floor(index / 2) + 1}. `;
            }

            const fromSquare = files[move.from.col] + ranks[move.from.row];
            const toSquare = files[move.to.col] + ranks[move.to.row];

            pgn += `${fromSquare}-${toSquare} `;
        });

        pgn += this.getResultString(game);

        return pgn;
    }

    getResultString(game) {
        if (game.result === 'checkmate') {
            return game.winner === 'white' ? '1-0' : '0-1';
        }
        if (game.result === 'stalemate' || game.result === 'draw') {
            return '1/2-1/2';
        }
        if (game.result === 'resign') {
            return game.winner === 'white' ? '1-0' : '0-1';
        }
        return '*';
    }

    // ========================================
    // Render History Modal
    // ========================================
    renderHistoryModal() {
        const history = this.getHistory();
        const container = document.getElementById('history-list');

        if (!container) return;

        if (history.length === 0) {
            container.innerHTML = '<p class="no-history">Chưa có ván đấu nào được lưu.</p>';
            return;
        }

        container.innerHTML = history.map(game => `
            <div class="history-item" data-id="${game.id}">
                <div class="history-info">
                    <div class="history-date">${new Date(game.date).toLocaleDateString('vi-VN')}</div>
                    <div class="history-opponent">vs ${game.opponent}</div>
                    <div class="history-result ${game.winner === 'white' ? 'win' : game.winner === 'black' ? 'loss' : 'draw'}">
                        ${this.getResultText(game)}
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn-replay" data-id="${game.id}">▶ Xem lại</button>
                    <button class="btn-export" data-id="${game.id}">📄 PGN</button>
                    <button class="btn-delete" data-id="${game.id}">🗑️</button>
                </div>
            </div>
        `).join('');

        // Add event listeners
        container.querySelectorAll('.btn-replay').forEach(btn => {
            btn.addEventListener('click', () => this.replayGame(parseInt(btn.dataset.id)));
        });

        container.querySelectorAll('.btn-export').forEach(btn => {
            btn.addEventListener('click', () => this.exportPGN(parseInt(btn.dataset.id)));
        });

        container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('Xóa ván đấu này?')) {
                    this.deleteGame(parseInt(btn.dataset.id));
                    this.renderHistoryModal();
                }
            });
        });
    }

    getResultText(game) {
        if (game.result === 'checkmate') {
            return game.winner === 'white' ? '🏆 Thắng' : '❌ Thua';
        }
        if (game.result === 'stalemate') return '🤝 Hòa (Pat)';
        if (game.result === 'draw') return '🤝 Hòa';
        if (game.result === 'resign') {
            return game.winner === 'white' ? '🏆 Thắng' : '❌ Thua';
        }
        return '⏸️ Chưa kết thúc';
    }

    // ========================================
    // Replay Game
    // ========================================
    replayGame(id) {
        const game = this.getGame(id);
        if (!game || !window.chessGame) return;

        // Close modal
        document.getElementById('history-modal')?.classList.remove('show');

        // Start replay mode
        window.chessGame.startReplay(game);
    }

    // ========================================
    // Export PGN
    // ========================================
    exportPGN(id) {
        const game = this.getGame(id);
        if (!game) return;

        const pgn = this.toPGN(game);
        const blob = new Blob([pgn], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `chess-game-${game.id}.pgn`;
        a.click();

        URL.revokeObjectURL(url);
    }
}

// Export for global access
window.GameHistory = GameHistory;
