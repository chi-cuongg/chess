// ========================================
// Special Moves - Castling, En Passant, Promotion
// ========================================

// Check if a square is attacked by opponent
function isSquareAttacked(board, row, col, byColor) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) continue;

            const pieceInfo = getPieceByCode(piece);
            if (pieceInfo.color !== byColor) continue;

            // Pawns only attack diagonally - their forward moves are not attacks
            if (piece.toUpperCase() === 'P') {
                const direction = byColor === 'white' ? -1 : 1;
                if (r + direction === row && (c - 1 === col || c + 1 === col)) {
                    return true;
                }
                continue;
            }

            const moves = getPseudoLegalMoves(board, r, c);
            for (const move of moves) {
                if (move.row === row && move.col === col) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Find king position
function findKing(board, color) {
    const kingCode = color === 'white' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === kingCode) {
                return { row: r, col: c };
            }
        }
    }
    return null;
}

// Check if king is in check
function isInCheck(board, color) {
    const kingPos = findKing(board, color);
    if (!kingPos) return false;
    return isSquareAttacked(board, kingPos.row, kingPos.col, getOpponentColor(color));
}

// Make a move on a copy of the board and return it
function makeMoveCopy(board, fromRow, fromCol, toRow, toCol, moveType = 'normal', promoteTo = null) {
    const newBoard = board.map(row => [...row]);
    const piece = newBoard[fromRow][fromCol];
    const pieceInfo = getPieceByCode(piece);
    const color = pieceInfo.color;

    // Handle en passant capture
    if (moveType === 'enpassant') {
        const capturedPawnRow = color === 'white' ? toRow + 1 : toRow - 1;
        newBoard[capturedPawnRow][toCol] = null;
    }

    // Handle castling
    if (moveType === 'castling') {
        // Move the rook
        if (toCol === 6) { // Kingside
            newBoard[toRow][5] = newBoard[toRow][7];
            newBoard[toRow][7] = null;
        } else if (toCol === 2) { // Queenside
            newBoard[toRow][3] = newBoard[toRow][0];
            newBoard[toRow][0] = null;
        }
    }

    // Handle promotion
    if (moveType === 'promotion' && promoteTo) {
        const promotionPiece = color === 'white' ? promoteTo.toUpperCase() : promoteTo.toLowerCase();
        newBoard[toRow][toCol] = promotionPiece;
    } else {
        newBoard[toRow][toCol] = piece;
    }

    newBoard[fromRow][fromCol] = null;
    return newBoard;
}

// Get castling moves
function getCastlingMoves(board, color, castlingRights) {
    const moves = [];
    if (!castlingRights) return moves;

    const row = color === 'white' ? 7 : 0;
    const kingCol = 4;

    // Can't castle if in check
    if (isInCheck(board, color)) return moves;

    const rookCode = color === 'white' ? 'R' : 'r';

    // Kingside castling
    const kingsideRight = color === 'white' ? castlingRights.whiteKingside : castlingRights.blackKingside;
    if (kingsideRight && board[row][7] === rookCode) {
        // Check if squares between king and rook are empty
        if (!board[row][5] && !board[row][6]) {
            // Check if king doesn't pass through or end up in check
            if (!isSquareAttacked(board, row, 5, getOpponentColor(color)) &&
                !isSquareAttacked(board, row, 6, getOpponentColor(color))) {
                moves.push({ row, col: 6, type: 'castling' });
            }
        }
    }

    // Queenside castling
    const queensideRight = color === 'white' ? castlingRights.whiteQueenside : castlingRights.blackQueenside;
    if (queensideRight && board[row][0] === rookCode) {
        // Check if squares between king and rook are empty
        if (!board[row][1] && !board[row][2] && !board[row][3]) {
            // Check if king doesn't pass through or end up in check
            if (!isSquareAttacked(board, row, 2, getOpponentColor(color)) &&
                !isSquareAttacked(board, row, 3, getOpponentColor(color))) {
                moves.push({ row, col: 2, type: 'castling' });
            }
        }
    }

    return moves;
}

// Get all legal moves for a piece
function getLegalMoves(board, row, col, enPassantTarget = null, castlingRights = null) {
    const piece = board[row][col];
    if (!piece) return [];

    const pieceInfo = getPieceByCode(piece);
    const color = pieceInfo.color;

    // Get pseudo-legal moves
    let moves = getPseudoLegalMoves(board, row, col, enPassantTarget, castlingRights);

    // Add castling moves for king
    if (piece.toUpperCase() === 'K') {
        const castlingMoves = getCastlingMoves(board, color, castlingRights);
        moves = moves.concat(castlingMoves);
    }

    // Filter out moves that leave king in check
    const legalMoves = moves.filter(move => {
        const newBoard = makeMoveCopy(board, row, col, move.row, move.col, move.type, move.promoteTo);
        return !isInCheck(newBoard, color);
    });

    return legalMoves;
}

// Check if game is checkmate
function isCheckmate(board, color, enPassantTarget = null, castlingRights = null) {
    if (!isInCheck(board, color)) return false;

    // Check if any piece has legal moves
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && getPieceByCode(piece).color === color) {
                const moves = getLegalMoves(board, r, c, enPassantTarget, castlingRights);
                if (moves.length > 0) return false;
            }
        }
    }

    return true;
}

// Check if game is stalemate
function isStalemate(board, color, enPassantTarget = null, castlingRights = null) {
    if (isInCheck(board, color)) return false;

    // Check if any piece has legal moves
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && getPieceByCode(piece).color === color) {
                const moves = getLegalMoves(board, r, c, enPassantTarget, castlingRights);
                if (moves.length > 0) return false;
            }
        }
    }

    return true;
}

// Check for insufficient material
function isInsufficientMaterial(board) {
    const pieces = { white: [], black: [] };

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece) {
                const pieceInfo = getPieceByCode(piece);
                pieces[pieceInfo.color].push({
                    type: piece.toUpperCase(),
                    row: r,
                    col: c
                });
            }
        }
    }

    // King vs King
    if (pieces.white.length === 1 && pieces.black.length === 1) {
        return true;
    }

    // King + Bishop vs King or King + Knight vs King
    if ((pieces.white.length === 1 && pieces.black.length === 2) ||
        (pieces.white.length === 2 && pieces.black.length === 1)) {
        const morePieces = pieces.white.length > pieces.black.length ? pieces.white : pieces.black;
        const minorPiece = morePieces.find(p => p.type !== 'K');
        if (minorPiece && (minorPiece.type === 'B' || minorPiece.type === 'N')) {
            return true;
        }
    }

    // King + Bishop vs King + Bishop (same color bishops)
    if (pieces.white.length === 2 && pieces.black.length === 2) {
        const whiteBishop = pieces.white.find(p => p.type === 'B');
        const blackBishop = pieces.black.find(p => p.type === 'B');
        if (whiteBishop && blackBishop) {
            const whiteSquareColor = (whiteBishop.row + whiteBishop.col) % 2;
            const blackSquareColor = (blackBishop.row + blackBishop.col) % 2;
            if (whiteSquareColor === blackSquareColor) {
                return true;
            }
        }
    }

    return false;
}

// Get all legal moves for a color
function getAllLegalMoves(board, color, enPassantTarget = null, castlingRights = null) {
    const allMoves = [];

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && getPieceByCode(piece).color === color) {
                const moves = getLegalMoves(board, r, c, enPassantTarget, castlingRights);
                for (const move of moves) {
                    allMoves.push({
                        from: { row: r, col: c },
                        to: { row: move.row, col: move.col },
                        type: move.type,
                        promoteTo: move.promoteTo
                    });
                }
            }
        }
    }

    return allMoves;
}

// Node.js export (for unit tests) - no effect in the browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isSquareAttacked,
        findKing,
        isInCheck,
        makeMoveCopy,
        getCastlingMoves,
        getLegalMoves,
        isCheckmate,
        isStalemate,
        isInsufficientMaterial,
        getAllLegalMoves
    };
}
