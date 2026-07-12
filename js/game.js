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
        this.aiThinking = false;
        this.aiWorker = null;
        this.aiWorkerFailed = false;
        this.lastMove = null;
        this.pendingPromotion = null;
        this.halfmoveClock = 0;
        this.positionCounts = {};
        this.isReplaying = false;
        this.replay = null;
        this.uiListenersBound = false;

        this.init();
    }

    init() {
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
        // The board element is recreated when switching game types,
        // so its listener must be re-attached on every init()
        const chessboard = document.getElementById('chessboard');
        chessboard.addEventListener('click', (e) => this.handleSquareClick(e));

        // Buttons and modals persist across game switches - bind them only once
        if (this.uiListenersBound) return;
        this.uiListenersBound = true;

        document.getElementById('play-ai-btn').addEventListener('click', () => this.toggleAI());

        // Promotion piece selection
        document.getElementById('promotion-pieces').addEventListener('click', (e) => {
            const piece = e.target.closest('.piece');
            if (piece && this.pendingPromotion) {
                const promoteTo = piece.dataset.piece;
                this.completePromotion(promoteTo);
            }
        });
    }

    newGame() {
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
        this.positionCounts[this.getPositionKey()] = 1;

        // Start recording this game
        this.startHistoryRecording();

        this.renderBoard();
        this.updateUI();
        this.updateStatus('Sẵn sàng bắt đầu!');
    }

    renderBoard() {
        const squares = document.querySelectorAll('.square');
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
            if (isInCheck(this.board, this.currentTurn)) {
                const kingPos = findKing(this.board, this.currentTurn);
                if (kingPos && row === kingPos.row && col === kingPos.col) {
                    square.classList.add('check');
                }
            }
        });

        this.updateCapturedPieces();
    }

    handleSquareClick(e) {
        if (this.isGameOver || this.pendingPromotion || this.isReplaying) return;
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

    // Entry point for moves made by clicking the board.
    // Promotions are intercepted here to let the player pick a piece.
    makeMove(fromRow, fromCol, toRow, toCol, move) {
        if (move.type === 'promotion') {
            const pieceInfo = getPieceByCode(this.board[fromRow][fromCol]);
            this.pendingPromotion = { fromRow, fromCol, toRow, toCol, move, color: pieceInfo.color };
            this.showPromotionModal(pieceInfo.color);
            return;
        }
        this.applyMove(fromRow, fromCol, toRow, toCol, move);
    }

    completePromotion(promoteTo) {
        if (!this.pendingPromotion) return;

        const { fromRow, fromCol, toRow, toCol, move } = this.pendingPromotion;
        this.pendingPromotion = null;
        this.hideModal('promotion-modal');
        this.applyMove(fromRow, fromCol, toRow, toCol, move, { promoteTo });
    }

    // Applies any move (normal, capture, castling, en passant, promotion)
    // and runs all post-move logic. Used by human, AI and online moves.
    // options: { promoteTo: 'Q'|'R'|'B'|'N', fromRemote: boolean }
    applyMove(fromRow, fromCol, toRow, toCol, move, options = {}) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return;

        const pieceInfo = getPieceByCode(piece);
        const capturedPiece = this.board[toRow][toCol];
        const promoteTo = options.promoteTo || move.promoteTo || 'Q';

        this.pushUndoSnapshot();

        // Handle captures
        if (capturedPiece) {
            const capturedInfo = getPieceByCode(capturedPiece);
            this.capturedPieces[capturedInfo.color].push(capturedPiece);
        }

        // Handle en passant capture
        let enPassantCaptured = null;
        if (move.type === 'enpassant') {
            const capturedPawnRow = pieceInfo.color === 'white' ? toRow + 1 : toRow - 1;
            enPassantCaptured = this.board[capturedPawnRow][toCol];
            this.capturedPieces[getOpponentColor(pieceInfo.color)].push(enPassantCaptured);
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

        // Move piece (with promotion if applicable)
        if (move.type === 'promotion') {
            this.board[toRow][toCol] = pieceInfo.color === 'white'
                ? promoteTo.toUpperCase()
                : promoteTo.toLowerCase();
        } else {
            this.board[toRow][toCol] = piece;
        }
        this.board[fromRow][fromCol] = null;

        // Update en passant target
        if (move.type === 'double') {
            this.enPassantTarget = { row: (fromRow + toRow) / 2, col: toCol };
        } else {
            this.enPassantTarget = null;
        }

        // Update castling rights
        this.updateCastlingRights(piece, fromRow, fromCol, toRow, toCol);

        // Fifty-move rule counter: reset on pawn move or any capture
        if (piece.toUpperCase() === 'P' || capturedPiece || enPassantCaptured) {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock++;
        }

        // Store last move
        this.lastMove = { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } };

        // Clear selection and switch turns
        this.clearSelection();
        this.currentTurn = getOpponentColor(this.currentTurn);

        // Threefold repetition tracking
        const positionKey = this.getPositionKey();
        this.positionCounts[positionKey] = (this.positionCounts[positionKey] || 0) + 1;

        // Record move to game history
        if (window.gameHistory) {
            // GameHistory is created after the first newGame() on page load,
            // so make sure a recording exists before the first move
            if (!window.gameHistory.currentGame && this.moveHistory.length === 1) {
                this.startHistoryRecording();
            }
            window.gameHistory.recordMove(
                { row: fromRow, col: fromCol },
                { row: toRow, col: toCol },
                piece,
                capturedPiece || enPassantCaptured,
                move.type === 'normal' || move.type === 'capture' || move.type === 'double' ? null : move.type,
                move.type === 'promotion' ? promoteTo : null
            );
        }

        // Check game state
        this.checkGameState();

        // Render
        this.renderBoard();
        this.updateUI();

        // Online sync: only send moves we made ourselves
        if (!options.fromRemote && window.onlineManager && window.onlineManager.isConnected) {
            window.onlineManager.sendMove(
                fromRow, fromCol, toRow, toCol,
                move.type === 'promotion' ? promoteTo : null
            );
        }

        // AI move
        if (this.playingAgainstAI && !this.isGameOver && this.currentTurn === this.aiColor) {
            this.updateStatus('AI đang suy nghĩ...');
            setTimeout(() => this.makeAIMove(), 300);
        }
    }

    startHistoryRecording() {
        if (!window.gameHistory) return;
        const online = window.onlineManager && window.onlineManager.isConnected;
        const mode = online ? 'online' : (this.playingAgainstAI ? 'ai' : 'local');
        const opponent = online
            ? (window.onlineManager.opponentName || 'Online')
            : (this.playingAgainstAI ? 'AI' : 'Người chơi 2');
        const playerColor = online ? window.onlineManager.playerColor : 'white';
        window.gameHistory.startGame(mode, opponent, playerColor);
    }

    pushUndoSnapshot() {
        this.moveHistory.push({
            board: this.board.map(r => [...r]),
            enPassantTarget: this.enPassantTarget,
            castlingRights: { ...this.castlingRights },
            capturedPieces: {
                white: [...this.capturedPieces.white],
                black: [...this.capturedPieces.black]
            },
            lastMove: this.lastMove,
            halfmoveClock: this.halfmoveClock,
            positionCounts: { ...this.positionCounts }
        });
    }

    // Unique key of the current position (for threefold repetition)
    getPositionKey() {
        const rights = this.castlingRights || {};
        const ep = this.enPassantTarget ? `${this.enPassantTarget.row},${this.enPassantTarget.col}` : '-';
        return this.board.map(row => row.map(p => p || '.').join('')).join('/') +
            ` ${this.currentTurn}` +
            ` ${rights.whiteKingside ? 'K' : ''}${rights.whiteQueenside ? 'Q' : ''}${rights.blackKingside ? 'k' : ''}${rights.blackQueenside ? 'q' : ''}` +
            ` ${ep}`;
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

        // Rook moved
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
            this.endCurrentGame('checkmate', winner);
            this.showGameOver(`${winner === 'white' ? 'Trắng' : 'Đen'} thắng!`, 'Chiếu hết!');
            this.updateStatus('Chiếu hết!', 'checkmate');
            return;
        }

        if (isStalemate(this.board, color, this.enPassantTarget, this.castlingRights)) {
            this.endCurrentGame('stalemate');
            this.showGameOver('Hòa!', 'Hết nước đi (Stalemate)');
            this.updateStatus('Hòa - Stalemate!');
            return;
        }

        if (isInsufficientMaterial(this.board)) {
            this.endCurrentGame('draw');
            this.showGameOver('Hòa!', 'Không đủ quân để chiếu hết');
            this.updateStatus('Hòa - Không đủ quân!');
            return;
        }

        if (this.halfmoveClock >= 100) {
            this.endCurrentGame('draw');
            this.showGameOver('Hòa!', 'Luật 50 nước đi');
            this.updateStatus('Hòa - Luật 50 nước!');
            return;
        }

        if (this.positionCounts[this.getPositionKey()] >= 3) {
            this.endCurrentGame('draw');
            this.showGameOver('Hòa!', 'Lặp lại vị trí 3 lần');
            this.updateStatus('Hòa - Lặp vị trí 3 lần!');
            return;
        }

        if (isInCheck(this.board, color)) {
            this.updateStatus(`${color === 'white' ? 'Trắng' : 'Đen'} bị chiếu!`, 'check');
        } else {
            this.updateStatus(`Lượt: ${color === 'white' ? 'Trắng' : 'Đen'}`);
        }
    }

    endCurrentGame(result, winner = null) {
        this.isGameOver = true;
        if (window.gameHistory) {
            window.gameHistory.endGame(result, winner);
        }
    }

    undoMove() {
        if (this.moveHistory.length === 0) return;
        if (this.isReplaying || this.aiThinking) return;

        // Undo is local-only, so it would desync the boards in online play
        if (window.onlineManager && window.onlineManager.isConnected) {
            this.updateStatus('Không thể hoàn tác khi đang chơi online!');
            return;
        }

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
            this.halfmoveClock = state.halfmoveClock;
            this.positionCounts = state.positionCounts;
            this.currentTurn = getOpponentColor(this.currentTurn);
        }

        this.clearSelection();
        this.renderBoard();
        this.updateUI();
        this.updateStatus(`Lượt: ${this.currentTurn === 'white' ? 'Trắng' : 'Đen'}`);
    }

    toggleAI() {
        const button = document.getElementById('play-ai-btn');
        const difficultySelect = document.getElementById('ai-difficulty');

        if (this.playingAgainstAI) {
            this.playingAgainstAI = false;
            button.innerHTML = '<span class="btn-icon">🤖</span> Chơi với AI';
            button.classList.remove('btn-secondary');
            button.classList.add('btn-accent');
        } else {
            const difficulty = parseInt(difficultySelect.value);
            if (difficulty === 0) {
                this.playingAgainstAI = false;
                this.updateStatus('Chế độ 2 người chơi');
                return;
            }

            this.playingAgainstAI = true;
            this.aiDepth = difficulty;
            button.innerHTML = '<span class="btn-icon">👥</span> Chơi 2 người';
            button.classList.remove('btn-accent');
            button.classList.add('btn-secondary');
            this.updateStatus('Chế độ chơi với AI');

            // If it's AI's turn, make a move
            if (this.currentTurn === this.aiColor && !this.isGameOver) {
                this.updateStatus('AI đang suy nghĩ...');
                setTimeout(() => this.makeAIMove(), 300);
            }
        }
    }

    // Runs the search in a Web Worker so the UI doesn't freeze;
    // falls back to synchronous search when workers are unavailable.
    makeAIMove() {
        if (this.isGameOver || this.aiThinking || this.isReplaying) return;
        if (!this.playingAgainstAI || this.currentTurn !== this.aiColor) return;

        this.aiThinking = true;

        const request = {
            board: this.board.map(r => [...r]),
            color: this.aiColor,
            depth: this.aiDepth,
            enPassantTarget: this.enPassantTarget,
            castlingRights: { ...this.castlingRights }
        };

        const worker = this.getAIWorker();
        if (worker) {
            worker.onmessage = (e) => this.executeAIMove(e.data);
            worker.onerror = () => {
                // Worker failed to load (e.g. file:// restrictions) - fall back to sync
                this.aiWorkerFailed = true;
                this.aiWorker = null;
                this.executeAIMove(findBestMove(
                    request.board, request.color, request.depth,
                    request.enPassantTarget, request.castlingRights
                ));
            };
            worker.postMessage(request);
        } else {
            setTimeout(() => {
                this.executeAIMove(findBestMove(
                    request.board, request.color, request.depth,
                    request.enPassantTarget, request.castlingRights
                ));
            }, 50);
        }
    }

    getAIWorker() {
        if (this.aiWorkerFailed) return null;
        if (!this.aiWorker) {
            try {
                this.aiWorker = new Worker('js/ai-worker.js');
            } catch (e) {
                this.aiWorkerFailed = true;
                return null;
            }
        }
        return this.aiWorker;
    }

    executeAIMove(bestMove) {
        this.aiThinking = false;

        // Discard stale results (new game started, AI turned off, ...)
        if (!bestMove || this.isGameOver || this.isReplaying) return;
        if (!this.playingAgainstAI || this.currentTurn !== this.aiColor) return;

        const moves = getLegalMoves(
            this.board,
            bestMove.from.row,
            bestMove.from.col,
            this.enPassantTarget,
            this.castlingRights
        );
        const promoteTo = bestMove.promoteTo || 'Q';
        const move = moves.find(m =>
            m.row === bestMove.to.row &&
            m.col === bestMove.to.col &&
            (m.type !== 'promotion' || m.promoteTo === promoteTo)
        );

        if (move) {
            this.applyMove(bestMove.from.row, bestMove.from.col, bestMove.to.row, bestMove.to.col, move, {
                promoteTo: move.type === 'promotion' ? promoteTo : null
            });
        }
    }

    // ========================================
    // Replay a saved game (from GameHistory)
    // ========================================
    startReplay(savedGame) {
        if (window.onlineManager && window.onlineManager.isConnected) {
            this.updateStatus('Không thể xem lại khi đang chơi online!');
            return;
        }

        this.stopReplay();
        this.isReplaying = true;
        this.replay = { moves: savedGame.moves || [], index: 0, timer: null };

        this.board = this.initialBoard.map(row => [...row]);
        this.currentTurn = 'white';
        this.selectedSquare = null;
        this.validMoves = [];
        this.capturedPieces = { white: [], black: [] };
        this.lastMove = null;
        this.isGameOver = false;

        this.renderBoard();
        this.updateUI();
        this.updateStatus(`Xem lại: 0/${this.replay.moves.length} — bấm "Ván mới" để thoát`);

        this.replay.timer = setInterval(() => this.replayNextMove(), 1000);
    }

    replayNextMove() {
        const rp = this.replay;
        if (!rp) return;

        if (rp.index >= rp.moves.length) {
            clearInterval(rp.timer);
            rp.timer = null;
            this.updateStatus('Xem lại kết thúc — bấm "Ván mới" để chơi tiếp');
            return;
        }

        const mv = rp.moves[rp.index++];
        const piece = this.board[mv.from.row] && this.board[mv.from.row][mv.from.col];
        if (!piece) {
            // Corrupted/old record - stop gracefully
            this.stopReplay();
            this.updateStatus('Không thể xem lại ván này (dữ liệu cũ)');
            return;
        }

        const pieceInfo = getPieceByCode(piece);
        const captured = this.board[mv.to.row][mv.to.col];
        if (captured) {
            this.capturedPieces[getPieceByCode(captured).color].push(captured);
        }

        if (mv.special === 'enpassant') {
            const capturedPawnRow = pieceInfo.color === 'white' ? mv.to.row + 1 : mv.to.row - 1;
            const pawn = this.board[capturedPawnRow][mv.to.col];
            if (pawn) this.capturedPieces[getPieceByCode(pawn).color].push(pawn);
            this.board[capturedPawnRow][mv.to.col] = null;
        }

        if (mv.special === 'castling') {
            if (mv.to.col === 6) {
                this.board[mv.to.row][5] = this.board[mv.to.row][7];
                this.board[mv.to.row][7] = null;
            } else if (mv.to.col === 2) {
                this.board[mv.to.row][3] = this.board[mv.to.row][0];
                this.board[mv.to.row][0] = null;
            }
        }

        let placedPiece = piece;
        if (mv.special === 'promotion') {
            const promoteTo = mv.promoteTo || 'Q';
            placedPiece = pieceInfo.color === 'white' ? promoteTo.toUpperCase() : promoteTo.toLowerCase();
        }

        this.board[mv.to.row][mv.to.col] = placedPiece;
        this.board[mv.from.row][mv.from.col] = null;
        this.lastMove = { from: { ...mv.from }, to: { ...mv.to } };
        this.currentTurn = getOpponentColor(pieceInfo.color);

        this.renderBoard();
        this.updateStatus(`Xem lại: ${rp.index}/${rp.moves.length} — bấm "Ván mới" để thoát`);
    }

    stopReplay() {
        if (this.replay && this.replay.timer) {
            clearInterval(this.replay.timer);
        }
        this.replay = null;
        this.isReplaying = false;
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
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.chessGame = new ChessGame();
});
