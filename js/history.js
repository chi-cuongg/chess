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
    // Convert to PGN Format (Standard Algebraic Notation)
    // ========================================
    toPGN(game) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

        let pgn = '';

        // Headers
        pgn += `[Event "Chess Master Game"]\n`;
        pgn += `[Date "${new Date(game.date).toISOString().split('T')[0]}"]\n`;
        pgn += `[White "Player"]\n`;
        pgn += `[Black "${this.escapePgn(game.opponent)}"]\n`;
        pgn += `[Result "${this.getResultString(game)}"]\n\n`;

        // Replay the moves to build proper SAN, which requires knowing the
        // legal moves at each position (for disambiguation, check, mate, ...).
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
        let enPassant = null;
        let rights = {
            whiteKingside: true, whiteQueenside: true,
            blackKingside: true, blackQueenside: true
        };

        let moveText = '';

        game.moves.forEach((m, index) => {
            const legal = getLegalMoves(board, m.from.row, m.from.col, enPassant, rights);
            const mv = legal.find(x => x.row === m.to.row && x.col === m.to.col);
            if (!mv) return;

            const piece = board[m.from.row][m.from.col];
            const san = this.moveToSAN(board, m.from, m.to, piece, mv, enPassant, rights);

            if (index % 2 === 0) {
                moveText += `${Math.floor(index / 2) + 1}. `;
            }
            moveText += san + ' ';

            board = makeMoveCopy(board, m.from.row, m.from.col, m.to.row, m.to.col, mv.type, mv.promoteTo);
            enPassant = computeEnPassantTarget(m.from, m.to, mv.type);
            rights = computeCastlingRights(rights, m.from.row, m.from.col, m.to.row, m.to.col);
        });

        pgn += moveText.trim() + ' ' + this.getResultString(game);

        return pgn;
    }

    moveToSAN(board, from, to, piece, mv, enPassant, rights) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];
        const pieceInfo = getPieceByCode(piece);
        const color = pieceInfo.color;
        const type = piece.toUpperCase();
        const isCapture = !!board[to.row][to.col] || mv.type === 'enpassant';

        let san = '';

        if (mv.type === 'castling') {
            return to.col === 6 ? 'O-O' : 'O-O-O';
        }

        if (type === 'P') {
            if (isCapture) san += files[from.col] + 'x';
            san += files[to.col] + ranks[to.row];
            if (mv.type === 'promotion') san += '=' + (mv.promoteTo || 'Q').toUpperCase();
        } else {
            san += type;

            // Disambiguation: are other pieces of the same type able to reach
            // the same target square?
            const others = [];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    if (r === from.row && c === from.col) continue;
                    const p = board[r][c];
                    if (!p) continue;
                    const info = getPieceByCode(p);
                    if (info.color !== color || p.toUpperCase() !== type) continue;
                    const lm = getLegalMoves(board, r, c, enPassant, rights);
                    if (lm.some(x => x.row === to.row && x.col === to.col)) {
                        others.push({ row: r, col: c });
                    }
                }
            }
            if (others.length > 0) {
                const sameFile = others.some(o => o.col === from.col);
                const sameRank = others.some(o => o.row === from.row);
                if (!sameFile) san += files[from.col];
                else if (!sameRank) san += ranks[from.row];
                else san += files[from.col] + ranks[from.row];
            }

            if (isCapture) san += 'x';
            san += files[to.col] + ranks[to.row];
        }

        // Check / checkmate suffix
        const newBoard = makeMoveCopy(board, from.row, from.col, to.row, to.col, mv.type, mv.promoteTo);
        const newEnPassant = computeEnPassantTarget(from, to, mv.type);
        const newRights = computeCastlingRights(rights, from.row, from.col, to.row, to.col);
        const opponent = getOpponentColor(color);
        if (isInCheck(newBoard, opponent)) {
            san += isCheckmate(newBoard, opponent, newEnPassant, newRights) ? '#' : '+';
        }

        return san;
    }

    escapePgn(text) {
        return String(text == null ? '' : text).replace(/[\\"]/g, '\\$&');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text == null ? '' : text;
        return div.innerHTML;
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
                    <div class="history-opponent">vs ${this.escapeHtml(game.opponent)}</div>
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
