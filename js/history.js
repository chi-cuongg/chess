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
    startGame(mode, opponent = 'AI', playerColor = 'white') {
        this.currentGame = {
            id: Date.now(),
            date: new Date().toISOString(),
            mode: mode, // 'local', 'ai', 'online'
            opponent: opponent,
            moves: [],
            result: null,
            winner: null,
            playerColor: playerColor
        };
    }

    // ========================================
    // Record a Move
    // ========================================
    recordMove(from, to, piece, captured = null, special = null, promoteTo = null) {
        if (!this.currentGame) return;

        this.currentGame.moves.push({
            from: { row: from.row, col: from.col },
            to: { row: to.row, col: to.col },
            piece: piece,
            captured: captured,
            special: special, // 'castling', 'enpassant', 'promotion'
            promoteTo: promoteTo,
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
    // Convert to PGN Format (standard SAN notation)
    // ========================================
    toPGN(game) {
        const playerColor = game.playerColor || 'white';
        const whiteName = playerColor === 'white' ? 'Player' : game.opponent;
        const blackName = playerColor === 'white' ? game.opponent : 'Player';

        let pgn = '';
        pgn += `[Event "Chess Master Game"]\n`;
        pgn += `[Date "${new Date(game.date).toISOString().split('T')[0].replace(/-/g, '.')}"]\n`;
        pgn += `[White "${whiteName}"]\n`;
        pgn += `[Black "${blackName}"]\n`;
        pgn += `[Result "${this.getResultString(game)}"]\n\n`;

        const sanMoves = this.movesToSAN(game.moves);
        sanMoves.forEach((san, index) => {
            if (index % 2 === 0) {
                pgn += `${Math.floor(index / 2) + 1}. `;
            }
            pgn += `${san} `;
        });

        pgn += this.getResultString(game);
        return pgn;
    }

    // Replays the game from the initial position to build proper SAN
    // (needs the chess move functions loaded globally). Falls back to
    // simple from-to notation if anything goes wrong.
    movesToSAN(moves) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        const square = (m) => files[m.col] + ranks[m.row];

        try {
            if (typeof getLegalMoves !== 'function' || typeof isInCheck !== 'function') {
                throw new Error('chess engine not loaded');
            }

            let board = [
                ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
                ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
                [null, null, null, null, null, null, null, null],
                [null, null, null, null, null, null, null, null],
                [null, null, null, null, null, null, null, null],
                [null, null, null, null, null, null, null, null],
                ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
                ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
            ];

            return moves.map(mv => {
                const piece = board[mv.from.row][mv.from.col];
                if (!piece) throw new Error('replay desync');

                const pieceType = piece.toUpperCase();
                const color = getPieceByCode(piece).color;
                const isCapture = !!mv.captured || mv.special === 'enpassant';
                let san;

                if (mv.special === 'castling') {
                    san = mv.to.col === 6 ? 'O-O' : 'O-O-O';
                } else {
                    let prefix = '';
                    if (pieceType === 'P') {
                        if (isCapture) prefix = files[mv.from.col];
                    } else {
                        prefix = pieceType;
                        // Disambiguation: another piece of the same type can reach the target
                        const others = [];
                        for (let r = 0; r < 8; r++) {
                            for (let c = 0; c < 8; c++) {
                                if ((r !== mv.from.row || c !== mv.from.col) && board[r][c] === piece) {
                                    const legal = getLegalMoves(board, r, c, null, null);
                                    if (legal.some(m => m.row === mv.to.row && m.col === mv.to.col)) {
                                        others.push({ r, c });
                                    }
                                }
                            }
                        }
                        if (others.length > 0) {
                            if (others.every(o => o.c !== mv.from.col)) {
                                prefix += files[mv.from.col];
                            } else if (others.every(o => o.r !== mv.from.row)) {
                                prefix += ranks[mv.from.row];
                            } else {
                                prefix += files[mv.from.col] + ranks[mv.from.row];
                            }
                        }
                    }

                    san = prefix + (isCapture ? 'x' : '') + square(mv.to);
                    if (mv.special === 'promotion') {
                        san += '=' + (mv.promoteTo || 'Q').toUpperCase();
                    }
                }

                // Apply the move to the board
                if (mv.special === 'enpassant') {
                    const capturedPawnRow = color === 'white' ? mv.to.row + 1 : mv.to.row - 1;
                    board[capturedPawnRow][mv.to.col] = null;
                }
                if (mv.special === 'castling') {
                    if (mv.to.col === 6) {
                        board[mv.to.row][5] = board[mv.to.row][7];
                        board[mv.to.row][7] = null;
                    } else {
                        board[mv.to.row][3] = board[mv.to.row][0];
                        board[mv.to.row][0] = null;
                    }
                }
                let placed = piece;
                if (mv.special === 'promotion') {
                    const p = (mv.promoteTo || 'Q');
                    placed = color === 'white' ? p.toUpperCase() : p.toLowerCase();
                }
                board[mv.to.row][mv.to.col] = placed;
                board[mv.from.row][mv.from.col] = null;

                // Check / checkmate suffix
                const opponent = color === 'white' ? 'black' : 'white';
                if (isInCheck(board, opponent)) {
                    san += (typeof isCheckmate === 'function' && isCheckmate(board, opponent, null, null)) ? '#' : '+';
                }

                return san;
            });
        } catch (e) {
            // Fallback: simple coordinate notation
            return moves.map(mv => `${square(mv.from)}-${square(mv.to)}`);
        }
    }

    getResultString(game) {
        if (game.result === 'checkmate' || game.result === 'resign') {
            return game.winner === 'white' ? '1-0' : '0-1';
        }
        if (game.result === 'stalemate' || game.result === 'draw') {
            return '1/2-1/2';
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

        container.innerHTML = history.map(game => {
            const playerColor = game.playerColor || 'white';
            const resultClass = !game.winner ? 'draw' : (game.winner === playerColor ? 'win' : 'loss');
            return `
            <div class="history-item" data-id="${game.id}">
                <div class="history-info">
                    <div class="history-date">${new Date(game.date).toLocaleDateString('vi-VN')}</div>
                    <div class="history-opponent">vs ${this.escapeHtml(game.opponent || '?')}</div>
                    <div class="history-result ${resultClass}">
                        ${this.getResultText(game)}
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn-replay" data-id="${game.id}">▶ Xem lại</button>
                    <button class="btn-export" data-id="${game.id}">📄 PGN</button>
                    <button class="btn-delete" data-id="${game.id}">🗑️</button>
                </div>
            </div>
        `;
        }).join('');

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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getResultText(game) {
        const playerColor = game.playerColor || 'white';
        if (game.result === 'checkmate' || game.result === 'resign') {
            return game.winner === playerColor ? '🏆 Thắng' : '❌ Thua';
        }
        if (game.result === 'stalemate') return '🤝 Hòa (Pat)';
        if (game.result === 'draw') return '🤝 Hòa';
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
