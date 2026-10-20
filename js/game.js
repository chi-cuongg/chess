// ========================================
// Chess Game - Main Game Controller
// ========================================

class ChessGame {
    constructor() {
        // Initial board setup
        this.initialBoard = [
            ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
            ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
            ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
        ];

        this.board = null;
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.validMoves = [];
        this.enPassantTarget = null;
        this.castlingRights = null;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.isGameOver = false;
        this.playingAgainstAI = false;
        this.aiColor = 'black';
        this.aiDepth = 4;
        this.lastMove = null;
        this.pendingPromotion = null;

        // Draw-rule tracking
        this.halfmoveClock = 0;
        this.positionCounts = {};

        // Replay state
        this.isReplaying = false;
        this.replayTimer = null;

        // AI worker state
        this.aiWorker = null;
        this.aiThinking = false;
        this.aiWorkerDisabled = false;

        // Guard so button listeners are only bound once
        this._buttonsBound = false;

        this.init();
    }

    init() {
        this.active = true;
        this.createBoard();
        this.setupEventListeners();
        this.newGame();
    }

    createBoard() {
        const chessboard = document.getElementById('chessboard');
        chessboard.innerHTML = '';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                chessboard.appendChild(square);
            }
        }
    }

    setupEventListeners() {
        // The board element can be replaced when switching game types, so the
        // click handler must be (re)bound on every init. Button handlers live on
        // stable elements and must only be bound once to avoid duplicates.
        const chessboard = document.getElementById('chessboard');
        chessboard.addEventListener('click', (e) => this.handleSquareClick(e));

        if (this._buttonsBound) return;
        this._buttonsBound = true;


        // Promotion piece selection
        document.getElementById('promotion-pieces')?.addEventListener('click', (e) => {
            const piece = e.target.closest('.piece');
            if (this.active && piece && this.pendingPromotion) {
                const promoteTo = piece.dataset.piece;
                this.completePromotion(promoteTo);
            }
        });
    }

    newGame() {
        this.cancelAI();
        this.stopReplay();
        this.board = this.initialBoard.map(row => [...row]);
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.validMoves = [];
        this.enPassantTarget = null;
        this.castlingRights = {
            whiteKingside: true,
            whiteQueenside: true,
            blackKingside: true,
            blackQueenside: true
        };
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.isGameOver = false;
        this.lastMove = null;
        this.pendingPromotion = null;
        this.halfmoveClock = 0;
        this.positionCounts = {};
        this.recordPosition();

        this.renderBoard();
        this.updateUI();
        this.updateStatus('Sẵn sàng bắt đầu!');

        // Start a fresh history record (only if the history manager is loaded)
        if (window.gameHistory) {
            window.gameHistory.startGame(this.getGameMode(), this.getOpponentLabel());
        }
    }

    getGameMode() {
        if (window.onlineManager && window.onlineManager.isConnected) return 'online';
        if (this.playingAgainstAI) return 'ai';
        return 'local';
    }

    getOpponentLabel() {
        if (window.onlineManager && window.onlineManager.isConnected) {
            return window.onlineManager.opponentName || 'Đối thủ';
        }
        return this.playingAgainstAI ? 'AI' : 'Người chơi';
    }

    // Ensure a history record exists before recording a move. This covers the
    // case where the game was created before the history manager finished
    // loading (see index.html bootstrap).
    ensureHistory() {
        if (!window.gameHistory) return false;
        if (!window.gameHistory.currentGame) {
            window.gameHistory.startGame(this.getGameMode(), this.getOpponentLabel());
        }
        return true;
    }

    // ========================================
    // Draw-rule tracking (50-move & threefold repetition)
    // ========================================
    getPositionKey() {
        return JSON.stringify(this.board) + this.currentTurn +
            JSON.stringify(this.castlingRights) + JSON.stringify(this.enPassantTarget);
    }

    recordPosition() {
        const key = this.getPositionKey();
        this.positionCounts[key] = (this.positionCounts[key] || 0) + 1;
        return this.positionCounts[key];
    }

    isThreefoldRepetition() {
        return Object.values(this.positionCounts).some(count => count >= 3);
    }

    isFiftyMoveRule() {
        return this.halfmoveClock >= 100;
    }

    renderBoard() {
        const squares = document.querySelectorAll('.square');

        // Compute check state a single time instead of once per square.
        const inCheck = isInCheck(this.board, this.currentTurn);
        const kingPos = inCheck ? findKing(this.board, this.currentTurn) : null;

        squares.forEach(square => {
            const row = parseInt(square.dataset.row);
            const col = parseInt(square.dataset.col);
            const piece = this.board[row][col];

            // Clear square
            square.innerHTML = '';
            square.classList.remove('selected', 'valid-move', 'valid-capture', 'last-move', 'check');

            // Add piece
            if (piece) {
                const pieceInfo = getPieceByCode(piece);
                const pieceEl = document.createElement('div');
                pieceEl.className = `piece ${pieceInfo.color}`;
                pieceEl.textContent = pieceInfo.symbol;
                square.appendChild(pieceEl);
            }

            // Highlight last move
            if (this.lastMove) {
                if ((row === this.lastMove.from.row && col === this.lastMove.from.col) ||
                    (row === this.lastMove.to.row && col === this.lastMove.to.col)) {
                    square.classList.add('last-move');
                }
            }

            // Highlight king in check
            if (kingPos && row === kingPos.row && col === kingPos.col) {
                square.classList.add('check');
            }
        });

        this.updateCapturedPieces();
    }

    handleSquareClick(e) {
        if (this.isReplaying) return;
        if (this.isGameOver || this.pendingPromotion) return;
        if (this.playingAgainstAI && this.currentTurn === this.aiColor) return;

        // Prevent interaction if playing online and it's not my turn
        if (window.onlineManager && window.onlineManager.isConnected && !window.onlineManager.isPlayerTurn()) return;

        const square = e.target.closest('.square');
        if (!square) return;

        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);

        if (this.selectedSquare) {
            // Try to make a move
            const move = this.validMoves.find(m => m.row === row && m.col === col);
            if (move) {
                this.makeMove(this.selectedSquare.row, this.selectedSquare.col, row, col, move);
            } else {
                // Select a different piece
                this.selectSquare(row, col);
            }
        } else {
            this.selectSquare(row, col);
        }
    }

    selectSquare(row, col) {
        const piece = this.board[row][col];

        // Clear previous selection
        this.clearSelection();

        if (!piece) return;

        const pieceInfo = getPieceByCode(piece);
        if (pieceInfo.color !== this.currentTurn) return;

        // Select the piece
        this.selectedSquare = { row, col };
        this.validMoves = getLegalMoves(this.board, row, col, this.enPassantTarget, this.castlingRights);

        // Update visual
        const squares = document.querySelectorAll('.square');
        squares[row * 8 + col].classList.add('selected');

        for (const move of this.validMoves) {
            const targetSquare = squares[move.row * 8 + move.col];
            if (this.board[move.row][move.col] || move.type === 'enpassant') {
                targetSquare.classList.add('valid-capture');
            } else {
                targetSquare.classList.add('valid-move');
            }
        }
    }

    clearSelection() {
        this.selectedSquare = null;
        this.validMoves = [];

        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'valid-move', 'valid-capture');
        });
    }

    makeMove(fromRow, fromCol, toRow, toCol, move) {
        const piece = this.board[fromRow][fromCol];
        const pieceInfo = getPieceByCode(piece);
        const capturedPiece = this.board[toRow][toCol];

        // Check for promotion
        if (move.type === 'promotion') {
            this.pendingPromotion = {
                fromRow, fromCol, toRow, toCol, move,
                color: pieceInfo.color
            };
            this.showPromotionModal(pieceInfo.color);
            return;
        }

        // Save state for undo
        this.moveHistory.push({
            board: this.board.map(r => [...r]),
            enPassantTarget: this.enPassantTarget,
            castlingRights: { ...this.castlingRights },
            capturedPieces: {
                white: [...this.capturedPieces.white],
                black: [...this.capturedPieces.black]
            },
            lastMove: this.lastMove
        });

        // Handle captures
        if (capturedPiece) {
            const capturedInfo = getPieceByCode(capturedPiece);
            this.capturedPieces[capturedInfo.color].push(capturedPiece);
        }

        // Handle en passant capture
        if (move.type === 'enpassant') {
            const capturedPawnRow = pieceInfo.color === 'white' ? toRow + 1 : toRow - 1;
            const capturedPawn = this.board[capturedPawnRow][toCol];
            this.capturedPieces[getOpponentColor(pieceInfo.color)].push(capturedPawn);
            this.board[capturedPawnRow][toCol] = null;
        }

        // Handle castling
        if (move.type === 'castling') {
            if (toCol === 6) { // Kingside
                this.board[toRow][5] = this.board[toRow][7];
                this.board[toRow][7] = null;
            } else if (toCol === 2) { // Queenside
                this.board[toRow][3] = this.board[toRow][0];
                this.board[toRow][0] = null;
            }
        }

        // Move piece
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;

        // Update en passant target
        if (move.type === 'double') {
            this.enPassantTarget = {
                row: (fromRow + toRow) / 2,
                col: toCol
            };
        } else {
            this.enPassantTarget = null;
        }

        // Update castling rights
        this.updateCastlingRights(piece, fromRow, fromCol, toRow, toCol);

        // Store last move
        this.lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };

        // Update 50-move clock: reset on pawn move or capture, otherwise increase
        if (piece.toUpperCase() === 'P' || capturedPiece || move.type === 'enpassant') {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock++;
        }

        // Clear selection and switch turns
        this.clearSelection();
        this.currentTurn = getOpponentColor(this.currentTurn);
        this.recordPosition();

        // Check game state
        this.checkGameState();

        // Render
        this.renderBoard();
        this.updateUI();

        // During replay we only update visuals, no network/history/AI side effects.
        if (this.isReplaying) return;

        // Record to history (regardless of mode: online or local)
        if (this.ensureHistory()) {
            window.gameHistory.recordMove({ row: fromRow, col: fromCol }, { row: toRow, col: toCol }, piece, capturedPiece, move.type);
        }

        // Online Sync: send only when this client is the one who made the move
        if (window.onlineManager && window.onlineManager.isConnected) {
            this.maybeSendOnlineMove(fromRow, fromCol, toRow, toCol);
        }

        // AI move
        if (this.playingAgainstAI && !this.isGameOver && this.currentTurn === this.aiColor) {
            this.updateStatus('AI đang suy nghĩ...');
            this.scheduleAI();
        }
    }

    // Send a move over the network only if it wasn't caused by applying an
    // opponent's move (guards against echoing moves back to the sender).
    maybeSendOnlineMove(fromRow, fromCol, toRow, toCol, promoteTo = null) {
        if (!window.onlineManager || !window.onlineManager.isConnected) return;
        if (window.onlineManager.applyingRemoteMove) return;
        window.onlineManager.sendMove(fromRow, fromCol, toRow, toCol, promoteTo);
    }

    completePromotion(promoteTo) {
        if (!this.pendingPromotion) return;

        const { fromRow, fromCol, toRow, toCol, move, color } = this.pendingPromotion;
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];

        // Save state for undo
        this.moveHistory.push({
            board: this.board.map(r => [...r]),
            enPassantTarget: this.enPassantTarget,
            castlingRights: { ...this.castlingRights },
            capturedPieces: {
                white: [...this.capturedPieces.white],
                black: [...this.capturedPieces.black]
            },
            lastMove: this.lastMove
        });

        // Handle capture
        if (capturedPiece) {
            const capturedInfo = getPieceByCode(capturedPiece);
            this.capturedPieces[capturedInfo.color].push(capturedPiece);
        }

        // Promote pawn
        const promotedPiece = color === 'white' ? promoteTo.toUpperCase() : promoteTo.toLowerCase();
        this.board[toRow][toCol] = promotedPiece;
        this.board[fromRow][fromCol] = null;

        // Clear en passant
        this.enPassantTarget = null;

        // Store last move
        this.lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };

        // Hide modal and clear pending
        this.hideModal('promotion-modal');
        this.pendingPromotion = null;

        // Pawn move resets the 50-move clock
        this.halfmoveClock = 0;

        // Clear selection and switch turns
        this.clearSelection();
        this.currentTurn = getOpponentColor(this.currentTurn);
        this.recordPosition();

        // Check game state
        this.checkGameState();

        // Render
        this.renderBoard();
        this.updateUI();

        // During replay we only update visuals, no network/history/AI side effects.
        if (this.isReplaying) return;

        // Record to history
        if (this.ensureHistory()) {
            window.gameHistory.recordMove(
                { row: fromRow, col: fromCol },
                { row: toRow, col: toCol },
                piece,
                capturedPiece,
                'promotion'
            );
        }

        // Online Sync
        this.maybeSendOnlineMove(fromRow, fromCol, toRow, toCol, promoteTo);

        // AI move
        if (this.playingAgainstAI && !this.isGameOver && this.currentTurn === this.aiColor) {
            this.updateStatus('AI đang suy nghĩ...');
            this.scheduleAI();
        }
    }

    showPromotionModal(color) {
        const container = document.getElementById('promotion-pieces');
        const pieces = color === 'white' ? ['Q', 'R', 'B', 'N'] : ['q', 'r', 'b', 'n'];

        container.innerHTML = pieces.map(p => {
            const info = getPieceByCode(p);
            return `<div class="piece" data-piece="${p.toUpperCase()}">${info.symbol}</div>`;
        }).join('');

        this.showModal('promotion-modal');
    }

    updateCastlingRights(piece, fromRow, fromCol, toRow, toCol) {
        const pieceType = piece.toUpperCase();

        // King moved
        if (pieceType === 'K') {
            if (piece === 'K') {
                this.castlingRights.whiteKingside = false;
                this.castlingRights.whiteQueenside = false;
            } else {
                this.castlingRights.blackKingside = false;
                this.castlingRights.blackQueenside = false;
            }
        }

        // Rook moved or captured
        if (pieceType === 'R') {
            if (fromRow === 7 && fromCol === 0) this.castlingRights.whiteQueenside = false;
            if (fromRow === 7 && fromCol === 7) this.castlingRights.whiteKingside = false;
            if (fromRow === 0 && fromCol === 0) this.castlingRights.blackQueenside = false;
            if (fromRow === 0 && fromCol === 7) this.castlingRights.blackKingside = false;
        }

        // Rook captured
        if (toRow === 7 && toCol === 0) this.castlingRights.whiteQueenside = false;
        if (toRow === 7 && toCol === 7) this.castlingRights.whiteKingside = false;
        if (toRow === 0 && toCol === 0) this.castlingRights.blackQueenside = false;
        if (toRow === 0 && toCol === 7) this.castlingRights.blackKingside = false;
    }

    checkGameState() {
        const color = this.currentTurn;

        if (isCheckmate(this.board, color, this.enPassantTarget, this.castlingRights)) {
            const winner = getOpponentColor(color);
            this.endGame('checkmate', winner, `${winner === 'white' ? 'Trắng' : 'Đen'} thắng!`, 'Chiếu hết!');
            return;
        }

        if (isStalemate(this.board, color, this.enPassantTarget, this.castlingRights)) {
            this.endGame('stalemate', null, 'Hòa!', 'Hết nước đi (Stalemate)');
            return;
        }

        if (isInsufficientMaterial(this.board)) {
            this.endGame('draw', null, 'Hòa!', 'Không đủ quân để chiếu hết');
            return;
        }

        if (this.isThreefoldRepetition()) {
            this.endGame('draw', null, 'Hòa!', 'Lặp lại thế cờ 3 lần');
            return;
        }

        if (this.isFiftyMoveRule()) {
            this.endGame('draw', null, 'Hòa!', 'Luật 50 nước đi');
            return;
        }

        if (isInCheck(this.board, color)) {
            this.updateStatus(`${color === 'white' ? 'Trắng' : 'Đen'} bị chiếu!`, 'check');
        } else {
            this.updateStatus(`Lượt: ${color === 'white' ? 'Trắng' : 'Đen'}`);
        }
    }

    // Central place to finish a game: marks state, shows modal, saves history.
    endGame(result, winner, title, message) {
        this.isGameOver = true;
        this.showGameOver(title, message);
        this.updateStatus(result === 'checkmate' ? 'Chiếu hết!' : title, result === 'checkmate' ? 'checkmate' : '');
        if (window.gameHistory && !this.isReplaying) {
            window.gameHistory.endGame(result, winner);
        }
    }

    undoMove() {
        this.cancelAI();
        if (this.isReplaying) return;
        if (this.moveHistory.length === 0) return;
        if (this.isGameOver) {
            this.isGameOver = false;
            this.hideModal('game-over-modal');
        }

        // Undo one move (or two if playing against AI)
        const undoCount = this.playingAgainstAI ? 2 : 1;
        for (let i = 0; i < undoCount && this.moveHistory.length > 0; i++) {
            const state = this.moveHistory.pop();
            this.board = state.board;
            this.enPassantTarget = state.enPassantTarget;
            this.castlingRights = state.castlingRights;
            this.capturedPieces = state.capturedPieces;
            this.lastMove = state.lastMove;
            this.currentTurn = getOpponentColor(this.currentTurn);
        }

        // Rebuild draw-rule tracking for the restored position to avoid
        // stale repetition counts / halfmove clock after undoing.
        this.halfmoveClock = 0;
        this.positionCounts = {};
        this.recordPosition();

        this.clearSelection();
        this.renderBoard();
        this.updateUI();
        this.updateStatus(`Lượt: ${this.currentTurn === 'white' ? 'Trắng' : 'Đen'}`);
    }

    setAI(enabled, difficulty) {
        this.cancelAI();
        this.playingAgainstAI = enabled && Number(difficulty) > 0;
        this.aiDepth = Number(difficulty) || 4;
        if (this.playingAgainstAI && this.currentTurn === this.aiColor) this.scheduleAI();
    }

    scheduleAI() {
        clearTimeout(this.aiTimer);
        const generation = this.aiGeneration;
        this.aiTimer = setTimeout(() => {
            if (generation === this.aiGeneration) this.makeAIMove();
        }, 100);
    }

    cancelAI() {
        this.aiGeneration = (this.aiGeneration || 0) + 1;
        clearTimeout(this.aiTimer);
        if (this.aiWorker) this.aiWorker.terminate();
        this.aiWorker = null;
        this.aiThinking = false;
    }

    destroy() {
        this.cancelAI();
        this.stopReplay();
        this.active = false;
        this.pendingPromotion = null;
    }

    makeAIMove() {
        if (!this.active || !this.playingAgainstAI || this.currentTurn !== this.aiColor || this.isReplaying || this.isGameOver || this.aiThinking) return;

        // Prefer a Web Worker so the (potentially slow) search does not block
        // the UI. Falls back to a synchronous search if workers are unavailable
        // (e.g. some file:// contexts).
        let worker = null;
        try {
            worker = this.getAIWorker();
        } catch (e) {
            worker = null;
        }

        if (worker) {
            this.aiThinking = true;
            const payload = {
                board: this.board,
                color: this.aiColor,
                depth: this.aiDepth,
                enPassantTarget: this.enPassantTarget,
                castlingRights: this.castlingRights
            };
            const generation = this.aiGeneration;
            const onMessage = (e) => {
                if (generation !== this.aiGeneration || !this.active) return;
                worker.removeEventListener('message', onMessage);
                this.aiThinking = false;
                this.applyAIMove(e.data ? e.data.bestMove : null);
            };
            worker.addEventListener('message', onMessage);
            worker.postMessage(payload);
            return;
        }

        const bestMove = findBestMove(
            this.board,
            this.aiColor,
            this.aiDepth,
            this.enPassantTarget,
            this.castlingRights
        );
        this.applyAIMove(bestMove);
    }

    getAIWorker() {
        if (this.aiWorker) return this.aiWorker;
        if (this.aiWorkerDisabled || typeof Worker === 'undefined') return null;

        try {
            this.aiWorker = new Worker('js/ai-worker.js');
        } catch (e) {
            this.aiWorkerDisabled = true;
            return null;
        }

        this.aiWorker.onerror = () => {
            // Permanently disable the worker and fall back to a synchronous
            // search (e.g. workers blocked in some file:// contexts).
            try { this.aiWorker.terminate(); } catch (e) { /* ignore */ }
            this.aiWorker = null;
            this.aiWorkerDisabled = true;
            if (this.aiThinking) {
                this.aiThinking = false;
                if (this.playingAgainstAI && !this.isGameOver && this.currentTurn === this.aiColor) {
                    this.scheduleAI();
                }
            }
        };
        return this.aiWorker;
    }

    applyAIMove(bestMove) {
        if (!bestMove) return;
        // Ignore stale results (e.g. game was reset while the worker searched).
        if (!this.playingAgainstAI || this.isGameOver || this.currentTurn !== this.aiColor || this.isReplaying) return;

        const moves = getLegalMoves(
            this.board,
            bestMove.from.row,
            bestMove.from.col,
            this.enPassantTarget,
            this.castlingRights
        );
        const move = moves.find(m =>
            m.row === bestMove.to.row &&
            m.col === bestMove.to.col &&
            (m.type === bestMove.type || (!m.promoteTo && !bestMove.promoteTo))
        );
        if (!move) return;

        // Handle promotion
        if (move.type === 'promotion') {
            move.promoteTo = bestMove.promoteTo || 'Q';
            this.executeAIPromotion(bestMove.from.row, bestMove.from.col, bestMove.to.row, bestMove.to.col, move);
        } else {
            this.makeMove(bestMove.from.row, bestMove.from.col, bestMove.to.row, bestMove.to.col, move);
        }
    }

    executeAIPromotion(fromRow, fromCol, toRow, toCol, move) {
        const piece = this.board[fromRow][fromCol];
        const pieceInfo = getPieceByCode(piece);
        const capturedPiece = this.board[toRow][toCol];

        // Save state for undo
        this.moveHistory.push({
            board: this.board.map(r => [...r]),
            enPassantTarget: this.enPassantTarget,
            castlingRights: { ...this.castlingRights },
            capturedPieces: {
                white: [...this.capturedPieces.white],
                black: [...this.capturedPieces.black]
            },
            lastMove: this.lastMove
        });

        // Handle capture
        if (capturedPiece) {
            const capturedInfo = getPieceByCode(capturedPiece);
            this.capturedPieces[capturedInfo.color].push(capturedPiece);
        }

        // Promote to Queen by default for AI
        const promoteTo = move.promoteTo || 'Q';
        const promotedPiece = pieceInfo.color === 'white' ? promoteTo.toUpperCase() : promoteTo.toLowerCase();
        this.board[toRow][toCol] = promotedPiece;
        this.board[fromRow][fromCol] = null;

        this.enPassantTarget = null;
        this.lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };
        this.halfmoveClock = 0;

        this.currentTurn = getOpponentColor(this.currentTurn);
        this.recordPosition();
        this.checkGameState();
        this.renderBoard();
        this.updateUI();

        if (!this.isReplaying && this.ensureHistory()) {
            window.gameHistory.recordMove(
                { row: fromRow, col: fromCol },
                { row: toRow, col: toCol },
                piece,
                capturedPiece,
                'promotion'
            );
        }
    }

    updateUI() {
        // Update turn indicator
        const indicator = document.getElementById('turn-indicator');
        const turnDot = indicator.querySelector('.turn-dot');
        const turnText = indicator.querySelector('span:last-child');

        turnDot.className = `turn-dot ${this.currentTurn === 'white' ? 'white-turn' : 'black-turn'}`;
        turnText.textContent = `Lượt: ${this.currentTurn === 'white' ? 'Trắng' : 'Đen'}`;
    }

    updateCapturedPieces() {
        const whiteContainer = document.getElementById('captured-white');
        const blackContainer = document.getElementById('captured-black');

        whiteContainer.innerHTML = this.capturedPieces.white.map(p => {
            const info = getPieceByCode(p);
            return `<span class="piece">${info.symbol}</span>`;
        }).join('');

        blackContainer.innerHTML = this.capturedPieces.black.map(p => {
            const info = getPieceByCode(p);
            return `<span class="piece">${info.symbol}</span>`;
        }).join('');
    }

    updateStatus(message, type = '') {
        const status = document.getElementById('game-status');
        status.textContent = message;
        status.className = type;
    }

    showModal(id) {
        document.getElementById(id).classList.add('show');
    }

    hideModal(id) {
        document.getElementById(id).classList.remove('show');
    }

    showGameOver(title, message) {
        document.getElementById('game-over-title').textContent = title;
        document.getElementById('game-over-message').textContent = message;
        this.showModal('game-over-modal');
    }

    getValidMoves(row, col) {
        return getLegalMoves(this.board, row, col, this.enPassantTarget, this.castlingRights);
    }

    flipBoard(flipped = true) {
        this.isFlipped = flipped;
        const boardWrapper = document.querySelector('.board-wrapper');
        const boardLabels = document.querySelectorAll('.board-labels');

        if (flipped) {
            boardWrapper.classList.add('flipped');
            boardLabels.forEach(label => label.classList.add('flipped'));
        } else {
            boardWrapper.classList.remove('flipped');
            boardLabels.forEach(label => label.classList.remove('flipped'));
        }

        // Re-render to update pieces orientation (keeping them upright)
        this.renderBoard();
    }

    // ========================================
    // Replay a saved game
    // ========================================
    buildReplaySnapshots(game) {
        const snapshots = [];
        let board = this.initialBoard.map(row => [...row]);
        let enPassant = null;
        let rights = {
            whiteKingside: true, whiteQueenside: true,
            blackKingside: true, blackQueenside: true
        };

        for (const m of game.moves) {
            const legal = getLegalMoves(board, m.from.row, m.from.col, enPassant, rights);
            const mv = legal.find(x => x.row === m.to.row && x.col === m.to.col);
            if (!mv) break;

            board = makeMoveCopy(board, m.from.row, m.from.col, m.to.row, m.to.col, mv.type, mv.promoteTo);
            enPassant = computeEnPassantTarget(m.from, m.to, mv.type);
            rights = computeCastlingRights(rights, m.from.row, m.from.col, m.to.row, m.to.col);
            snapshots.push(board.map(row => [...row]));
        }

        return snapshots;
    }

    startReplay(game) {
        if (!this.active) return;
        this.cancelAI();
        this.stopReplay();
        if (!game || !game.moves || game.moves.length === 0) return;

        const snapshots = this.buildReplaySnapshots(game);
        if (snapshots.length === 0) return;

        document.getElementById('history-modal')?.classList.remove('show');

        this.isReplaying = true;
        this.replaySnapshots = snapshots;
        this.replayIndex = -1;

        // Reset visuals to the starting position without touching history.
        this.board = this.initialBoard.map(row => [...row]);
        this.currentTurn = 'white';
        this.capturedPieces = { white: [], black: [] };
        this.lastMove = null;
        this.isGameOver = false;
        this.clearSelection();
        this.renderBoard();
        this.updateUI();
        this.updateStatus('▶ Đang phát lại ván đấu...');

        this.replayTimer = setInterval(() => {
            this.replayIndex++;
            if (this.replayIndex >= this.replaySnapshots.length) {
                this.stopReplay();
                return;
            }
            this.board = this.replaySnapshots[this.replayIndex].map(row => [...row]);
            // Moves alternate starting with white.
            this.currentTurn = this.replayIndex % 2 === 0 ? 'black' : 'white';
            this.renderBoard();
            this.updateUI();
        }, 700);
    }

    stopReplay() {
        if (this.replayTimer) {
            clearInterval(this.replayTimer);
            this.replayTimer = null;
        }
        if (this.isReplaying) {
            this.isReplaying = false;
            this.updateStatus('Đã dừng phát lại.');
        }
        this.replayIndex = 0;
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chessGame = new ChessGame();
});
