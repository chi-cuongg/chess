// ========================================
// AI Web Worker - runs minimax off the main thread
// ========================================

importScripts('pieces.js', 'moves.js', 'ai.js');

self.onmessage = (e) => {
    const { board, color, depth, enPassantTarget, castlingRights } = e.data;
    const bestMove = findBestMove(board, color, depth, enPassantTarget, castlingRights);
    self.postMessage(bestMove);
};
