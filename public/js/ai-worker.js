// ========================================
// Chess AI Web Worker
// ========================================
// Runs the minimax search off the main thread so the UI stays responsive.
// Only pure logic files are loaded here (no DOM access).

importScripts('pieces.js', 'moves.js', 'ai.js', 'xiangqi-rules.js', 'xiangqi-ai.js', 'xo-rules.js', 'xo-ai.js');

self.onmessage = (e) => {
    const { game, requestId, difficulty, board, color, depth, enPassantTarget, castlingRights } = e.data || {};

    let bestMove = null;
    try {
        bestMove = game === 'xiangqi' ? XiangqiAI.findBestMove(board, color, { difficulty })
            : game === 'xo' ? XOAI.findBestMove(board, color, { difficulty })
            : findBestMove(board, color, depth, enPassantTarget, castlingRights);
    } catch (err) {
        bestMove = null;
    }

    self.postMessage({ game, requestId, bestMove });
};
