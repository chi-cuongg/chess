// ========================================
// Chess AI - Minimax with Alpha-Beta Pruning
// ========================================

// Piece-Square Tables for position evaluation
const PAWN_TABLE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0]
];

const KNIGHT_TABLE = [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50]
];

const BISHOP_TABLE = [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20]
];

const ROOK_TABLE = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0]
];

const QUEEN_TABLE = [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20]
];

const KING_MIDDLE_TABLE = [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20]
];

const KING_END_TABLE = [
    [-50, -40, -30, -20, -20, -30, -40, -50],
    [-30, -20, -10, 0, 0, -10, -20, -30],
    [-30, -10, 20, 30, 30, 20, -10, -30],
    [-30, -10, 30, 40, 40, 30, -10, -30],
    [-30, -10, 30, 40, 40, 30, -10, -30],
    [-30, -10, 20, 30, 30, 20, -10, -30],
    [-30, -30, 0, 0, 0, 0, -30, -30],
    [-50, -30, -30, -30, -30, -30, -30, -50]
];

// Get piece-square table value
function getPieceSquareValue(piece, row, col, isEndgame = false) {
    const pieceInfo = getPieceByCode(piece);
    const pieceType = piece.toUpperCase();
    const isWhite = pieceInfo.color === 'white';

    // Flip row for black pieces (tables are from white's perspective)
    const tableRow = isWhite ? row : 7 - row;

    let table;
    switch (pieceType) {
        case 'P': table = PAWN_TABLE; break;
        case 'N': table = KNIGHT_TABLE; break;
        case 'B': table = BISHOP_TABLE; break;
        case 'R': table = ROOK_TABLE; break;
        case 'Q': table = QUEEN_TABLE; break;
        case 'K': table = isEndgame ? KING_END_TABLE : KING_MIDDLE_TABLE; break;
        default: return 0;
    }

    return table[tableRow][col];
}

// Count material to determine if in endgame
function isEndgame(board) {
    let queenCount = 0;
    let minorPieceCount = 0;

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece) {
                const type = piece.toUpperCase();
                if (type === 'Q') queenCount++;
                if (type === 'R' || type === 'B' || type === 'N') minorPieceCount++;
            }
        }
    }

    return queenCount === 0 || (queenCount <= 2 && minorPieceCount <= 2);
}

// Evaluate board position
function evaluateBoard(board) {
    let score = 0;
    const endgame = isEndgame(board);

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece) {
                const pieceInfo = getPieceByCode(piece);
                const pieceValue = pieceInfo.value;
                const positionValue = getPieceSquareValue(piece, r, c, endgame);

                if (pieceInfo.color === 'white') {
                    score += pieceValue + positionValue;
                } else {
                    score -= pieceValue + positionValue;
                }
            }
        }
    }

    return score;
}

// Minimax with Alpha-Beta Pruning
function minimax(board, depth, alpha, beta, isMaximizing, enPassantTarget, castlingRights) {
    const color = isMaximizing ? 'white' : 'black';

    // Check terminal conditions
    if (isCheckmate(board, color, enPassantTarget, castlingRights)) {
        return isMaximizing ? -100000 + (10 - depth) : 100000 - (10 - depth);
    }
    if (isStalemate(board, color, enPassantTarget, castlingRights)) {
        return 0;
    }
    if (depth === 0) {
        return evaluateBoard(board);
    }

    const moves = getAllLegalMoves(board, color, enPassantTarget, castlingRights);

    // Order moves for better pruning (captures first)
    moves.sort((a, b) => {
        const aCapture = board[a.to.row][a.to.col] ? 1 : 0;
        const bCapture = board[b.to.row][b.to.col] ? 1 : 0;
        return bCapture - aCapture;
    });

    if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
            const newBoard = makeMoveCopy(
                board,
                move.from.row, move.from.col,
                move.to.row, move.to.col,
                move.type,
                move.promoteTo
            );

            // Update en passant target
            let newEnPassant = null;
            if (move.type === 'double') {
                newEnPassant = {
                    row: (move.from.row + move.to.row) / 2,
                    col: move.to.col
                };
            }

            const evaluation = minimax(newBoard, depth - 1, alpha, beta, false, newEnPassant, castlingRights);
            maxEval = Math.max(maxEval, evaluation);
            alpha = Math.max(alpha, evaluation);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            const newBoard = makeMoveCopy(
                board,
                move.from.row, move.from.col,
                move.to.row, move.to.col,
                move.type,
                move.promoteTo
            );

            // Update en passant target
            let newEnPassant = null;
            if (move.type === 'double') {
                newEnPassant = {
                    row: (move.from.row + move.to.row) / 2,
                    col: move.to.col
                };
            }

            const evaluation = minimax(newBoard, depth - 1, alpha, beta, true, newEnPassant, castlingRights);
            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

// Find best move for AI
function findBestMove(board, color, depth, enPassantTarget, castlingRights) {
    const moves = getAllLegalMoves(board, color, enPassantTarget, castlingRights);
    if (moves.length === 0) return null;

    let bestMove = null;
    let bestEval = color === 'white' ? -Infinity : Infinity;
    const isMaximizing = color === 'white';

    // Order moves for better pruning
    moves.sort((a, b) => {
        const aCapture = board[a.to.row][a.to.col] ? 1 : 0;
        const bCapture = board[b.to.row][b.to.col] ? 1 : 0;
        return bCapture - aCapture;
    });

    for (const move of moves) {
        const newBoard = makeMoveCopy(
            board,
            move.from.row, move.from.col,
            move.to.row, move.to.col,
            move.type,
            move.promoteTo
        );

        // Update en passant target
        let newEnPassant = null;
        if (move.type === 'double') {
            newEnPassant = {
                row: (move.from.row + move.to.row) / 2,
                col: move.to.col
            };
        }

        const evaluation = minimax(
            newBoard,
            depth - 1,
            -Infinity,
            Infinity,
            !isMaximizing,
            newEnPassant,
            castlingRights
        );

        if (isMaximizing) {
            if (evaluation > bestEval) {
                bestEval = evaluation;
                bestMove = move;
            }
        } else {
            if (evaluation < bestEval) {
                bestEval = evaluation;
                bestMove = move;
            }
        }
    }

    // Add some randomness among equally good moves in easy mode
    if (depth <= 2) {
        const goodMoves = moves.filter(move => {
            const newBoard = makeMoveCopy(
                board,
                move.from.row, move.from.col,
                move.to.row, move.to.col,
                move.type,
                move.promoteTo
            );
            const evaluation = minimax(newBoard, depth - 1, -Infinity, Infinity, !isMaximizing, null, castlingRights);
            return Math.abs(evaluation - bestEval) < 50;
        });
        if (goodMoves.length > 1) {
            bestMove = goodMoves[Math.floor(Math.random() * goodMoves.length)];
        }
    }

    return bestMove;
}
