// ========================================
// Chess Pieces - Definitions and Move Logic
// ========================================

const PIECES = {
    // White pieces
    WHITE_KING: { symbol: '♔', code: 'K', color: 'white', value: 10000 },
    WHITE_QUEEN: { symbol: '♕', code: 'Q', color: 'white', value: 900 },
    WHITE_ROOK: { symbol: '♖', code: 'R', color: 'white', value: 500 },
    WHITE_BISHOP: { symbol: '♗', code: 'B', color: 'white', value: 330 },
    WHITE_KNIGHT: { symbol: '♘', code: 'N', color: 'white', value: 320 },
    WHITE_PAWN: { symbol: '♙', code: 'P', color: 'white', value: 100 },
    // Black pieces
    BLACK_KING: { symbol: '♚', code: 'k', color: 'black', value: 10000 },
    BLACK_QUEEN: { symbol: '♛', code: 'q', color: 'black', value: 900 },
    BLACK_ROOK: { symbol: '♜', code: 'r', color: 'black', value: 500 },
    BLACK_BISHOP: { symbol: '♝', code: 'b', color: 'black', value: 330 },
    BLACK_KNIGHT: { symbol: '♞', code: 'n', color: 'black', value: 320 },
    BLACK_PAWN: { symbol: '♟', code: 'p', color: 'black', value: 100 }
};

// Get piece by code
function getPieceByCode(code) {
    for (const key in PIECES) {
        if (PIECES[key].code === code) {
            return PIECES[key];
        }
    }
    return null;
}

// Check if position is valid
function isValidPosition(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
}

// Get opponent color
function getOpponentColor(color) {
    return color === 'white' ? 'black' : 'white';
}

// ========================================
// Move Generation for Each Piece Type
// ========================================

// Generate pawn moves
function getPawnMoves(board, row, col, color, enPassantTarget = null) {
    const moves = [];
    const direction = color === 'white' ? -1 : 1;
    const startRow = color === 'white' ? 6 : 1;
    const promotionRow = color === 'white' ? 0 : 7;

    // Forward move
    const newRow = row + direction;
    if (isValidPosition(newRow, col) && !board[newRow][col]) {
        if (newRow === promotionRow) {
            // Promotion moves
            moves.push({ row: newRow, col, type: 'promotion', promoteTo: 'Q' });
            moves.push({ row: newRow, col, type: 'promotion', promoteTo: 'R' });
            moves.push({ row: newRow, col, type: 'promotion', promoteTo: 'B' });
            moves.push({ row: newRow, col, type: 'promotion', promoteTo: 'N' });
        } else {
            moves.push({ row: newRow, col, type: 'normal' });
        }

        // Double move from starting position
        if (row === startRow) {
            const doubleRow = row + direction * 2;
            if (!board[doubleRow][col]) {
                moves.push({ row: doubleRow, col, type: 'double' });
            }
        }
    }

    // Captures (including en passant)
    const captureCols = [col - 1, col + 1];
    for (const captureCol of captureCols) {
        if (isValidPosition(newRow, captureCol)) {
            const targetPiece = board[newRow][captureCol];
            if (targetPiece && getPieceByCode(targetPiece).color !== color) {
                if (newRow === promotionRow) {
                    moves.push({ row: newRow, col: captureCol, type: 'promotion', promoteTo: 'Q', capture: true });
                    moves.push({ row: newRow, col: captureCol, type: 'promotion', promoteTo: 'R', capture: true });
                    moves.push({ row: newRow, col: captureCol, type: 'promotion', promoteTo: 'B', capture: true });
                    moves.push({ row: newRow, col: captureCol, type: 'promotion', promoteTo: 'N', capture: true });
                } else {
                    moves.push({ row: newRow, col: captureCol, type: 'capture' });
                }
            }
            // En passant
            if (enPassantTarget && enPassantTarget.row === newRow && enPassantTarget.col === captureCol) {
                moves.push({ row: newRow, col: captureCol, type: 'enpassant' });
            }
        }
    }

    return moves;
}

// Generate knight moves
function getKnightMoves(board, row, col, color) {
    const moves = [];
    const offsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
    ];

    for (const [dr, dc] of offsets) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (isValidPosition(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece) {
                moves.push({ row: newRow, col: newCol, type: 'normal' });
            } else if (getPieceByCode(targetPiece).color !== color) {
                moves.push({ row: newRow, col: newCol, type: 'capture' });
            }
        }
    }

    return moves;
}

// Generate sliding moves (for rook, bishop, queen)
function getSlidingMoves(board, row, col, color, directions) {
    const moves = [];

    for (const [dr, dc] of directions) {
        let newRow = row + dr;
        let newCol = col + dc;

        while (isValidPosition(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece) {
                moves.push({ row: newRow, col: newCol, type: 'normal' });
            } else {
                if (getPieceByCode(targetPiece).color !== color) {
                    moves.push({ row: newRow, col: newCol, type: 'capture' });
                }
                break;
            }
            newRow += dr;
            newCol += dc;
        }
    }

    return moves;
}

// Generate rook moves
function getRookMoves(board, row, col, color) {
    const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    return getSlidingMoves(board, row, col, color, directions);
}

// Generate bishop moves
function getBishopMoves(board, row, col, color) {
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    return getSlidingMoves(board, row, col, color, directions);
}

// Generate queen moves
function getQueenMoves(board, row, col, color) {
    const directions = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];
    return getSlidingMoves(board, row, col, color, directions);
}

// Generate king moves (without castling - that's handled separately)
function getKingMoves(board, row, col, color) {
    const moves = [];
    const offsets = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];

    for (const [dr, dc] of offsets) {
        const newRow = row + dr;
        const newCol = col + dc;
        if (isValidPosition(newRow, newCol)) {
            const targetPiece = board[newRow][newCol];
            if (!targetPiece) {
                moves.push({ row: newRow, col: newCol, type: 'normal' });
            } else if (getPieceByCode(targetPiece).color !== color) {
                moves.push({ row: newRow, col: newCol, type: 'capture' });
            }
        }
    }

    return moves;
}

// Get all pseudo-legal moves for a piece (doesn't check for putting own king in check)
function getPseudoLegalMoves(board, row, col, enPassantTarget = null, castlingRights = null) {
    const piece = board[row][col];
    if (!piece) return [];

    const pieceInfo = getPieceByCode(piece);
    const color = pieceInfo.color;
    const code = piece.toUpperCase();

    switch (code) {
        case 'P':
            return getPawnMoves(board, row, col, color, enPassantTarget);
        case 'N':
            return getKnightMoves(board, row, col, color);
        case 'B':
            return getBishopMoves(board, row, col, color);
        case 'R':
            return getRookMoves(board, row, col, color);
        case 'Q':
            return getQueenMoves(board, row, col, color);
        case 'K':
            return getKingMoves(board, row, col, color);
        default:
            return [];
    }
}
