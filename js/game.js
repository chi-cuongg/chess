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
        const chessboard = document.getElementById('chessboard');
        chessboard.addEventListener('click', (e) => this.handleSquareClick(e));

        document.getElementById('new-game-btn').addEventListener('click', () => this.newGame());
        document.getElementById('undo-btn').addEventListener('click', () => this.undoMove());
        document.getElementById('play-ai-btn').addEventListener('click', () => this.toggleAI());
        document.getElementById('play-again-btn').addEventListener('click', () => {
            this.hideModal('game-over-modal');
            this.newGame();
        });

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

        // Clear selection and switch turns
        this.clearSelection();
        this.currentTurn = getOpponentColor(this.currentTurn);

        // Check game state
        this.checkGameState();

        // Render
        this.renderBoard();
        this.updateUI();

        // Online Sync
        if (window.onlineManager && window.onlineManager.isConnected && this.currentTurn !== window.onlineManager.playerColor) {
            // We just moved, so it's opponent's turn. We need to send the move we just made.
            // Note: currentTurn has already been switched to opponent's color
            window.onlineManager.sendMove(fromRow, fromCol, toRow, toCol);

            // Record to history
            if (window.gameHistory) {
                window.gameHistory.recordMove({ row: fromRow, col: fromCol }, { row: toRow, col: toCol }, piece, capturedPiece, move.type);
            }
        }

        // Local History
        if (window.gameHistory && !window.onlineManager?.isConnected) {
            window.gameHistory.recordMove({ row: fromRow, col: fromCol }, { row: toRow, col: toCol }, piece, capturedPiece, move.type);
        }

        // AI move
        if (this.playingAgainstAI && !this.isGameOver && this.currentTurn === this.aiColor) {
            this.updateStatus('AI đang suy nghĩ...');
            setTimeout(() => this.makeAIMove(), 500);
        }
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

        // Clear selection and switch turns
        this.clearSelection();
        this.currentTurn = getOpponentColor(this.currentTurn);

        // Check game state
        this.checkGameState();

        // Render
        this.renderBoard();
        this.updateUI();

        // Online Sync
        if (window.onlineManager && window.onlineManager.isConnected && this.currentTurn !== window.onlineManager.playerColor) {
            window.onlineManager.sendMove(fromRow, fromCol, toRow, toCol, promoteTo);
            // Record to history
            if (window.gameHistory) {
                window.gameHistory.recordMove(
                    { row: fromRow, col: fromCol },
                    { row: toRow, col: toCol },
                    piece,
                    capturedPiece,
                    'promotion'
                );
            }
        }

        // Local History
        if (window.gameHistory && !window.onlineManager?.isConnected) {
            window.gameHistory.recordMove(
                { row: fromRow, col: fromCol },
                { row: toRow, col: toCol },
                piece,
                capturedPiece,
                'promotion'
            );
        }

        // AI move
        if (this.playingAgainstAI && !this.isGameOver && this.currentTurn === this.aiColor) {
            this.updateStatus('AI đang suy nghĩ...');
            setTimeout(() => this.makeAIMove(), 500);
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
            this.isGameOver = true;
            const winner = getOpponentColor(color);
            this.showGameOver(`${winner === 'white' ? 'Trắng' : 'Đen'} thắng!`, 'Chiếu hết!');
            this.updateStatus('Chiếu hết!', 'checkmate');
            return;
        }

        if (isStalemate(this.board, color, this.enPassantTarget, this.castlingRights)) {
            this.isGameOver = true;
            this.showGameOver('Hòa!', 'Hết nước đi (Stalemate)');
            this.updateStatus('Hòa - Stalemate!');
            return;
        }

        if (isInsufficientMaterial(this.board)) {
            this.isGameOver = true;
            this.showGameOver('Hòa!', 'Không đủ quân để chiếu hết');
            this.updateStatus('Hòa - Không đủ quân!');
            return;
        }

        if (isInCheck(this.board, color)) {
            this.updateStatus(`${color === 'white' ? 'Trắng' : 'Đen'} bị chiếu!`, 'check');
        } else {
            this.updateStatus(`Lượt: ${color === 'white' ? 'Trắng' : 'Đen'}`);
        }
    }

    undoMove() {
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
                setTimeout(() => this.makeAIMove(), 500);
            }
        }
    }

    makeAIMove() {
        if (this.isGameOver) return;

        const bestMove = findBestMove(
            this.board,
            this.aiColor,
            this.aiDepth,
            this.enPassantTarget,
            this.castlingRights
        );

        if (bestMove) {
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

            if (move) {
                // Handle promotion
                if (move.type === 'promotion') {
                    move.promoteTo = bestMove.promoteTo || 'Q';
                    this.executeAIPromotion(bestMove.from.row, bestMove.from.col, bestMove.to.row, bestMove.to.col, move);
                } else {
                    this.makeMove(bestMove.from.row, bestMove.from.col, bestMove.to.row, bestMove.to.col, move);
                }
            }
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

        this.currentTurn = getOpponentColor(this.currentTurn);
        this.checkGameState();
        this.renderBoard();
        this.updateUI();
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
