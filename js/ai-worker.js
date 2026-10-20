// ========================================
// Chess AI Web Worker
// ========================================
// Runs the minimax search off the main thread so the UI stays responsive.
// Only pure logic files are loaded here (no DOM access).

importScripts('pieces.js', 'moves.js', 'ai.js');

self.onmessage = (e) => {
    const { board, color, depth, enPassantTarget, castlingRights } = e.data || {};

    let bestMove = null;
    try {
        bestMove = findBestMove(board, color, depth, enPassantTarget, castlingRights);
    } catch (err) {
        bestMove = null;
    }

    self.postMessage({ bestMove });
};
