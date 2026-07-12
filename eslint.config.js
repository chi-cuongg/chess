// ESLint flat config.
// The game files are plain browser scripts sharing globals, so every
// cross-file function/class is declared here - no-undef then catches
// calls to functions that don't exist (the most common bug class here).

const globals = require('globals');

// Functions and classes shared between the plain <script> files
const gameGlobals = {
    // js/pieces.js
    PIECES: 'readonly',
    getPieceByCode: 'readonly',
    isValidPosition: 'readonly',
    getOpponentColor: 'readonly',
    getPawnMoves: 'readonly',
    getKnightMoves: 'readonly',
    getSlidingMoves: 'readonly',
    getRookMoves: 'readonly',
    getBishopMoves: 'readonly',
    getQueenMoves: 'readonly',
    getKingMoves: 'readonly',
    getPseudoLegalMoves: 'readonly',
    // js/moves.js
    isSquareAttacked: 'readonly',
    findKing: 'readonly',
    isInCheck: 'readonly',
    makeMoveCopy: 'readonly',
    getCastlingMoves: 'readonly',
    getLegalMoves: 'readonly',
    isCheckmate: 'readonly',
    isStalemate: 'readonly',
    isInsufficientMaterial: 'readonly',
    getAllLegalMoves: 'readonly',
    // js/ai.js
    findBestMove: 'readonly',
    evaluateBoard: 'readonly',
    minimax: 'readonly',
    // Classes
    ChessGame: 'readonly',
    OnlineManager: 'readonly',
    ChatManager: 'readonly',
    GameHistory: 'readonly',
    ThemeSwitcher: 'readonly',
    XiangqiGame: 'readonly',
    XOGame: 'readonly',
    GameManager: 'readonly',
    // js/vendor/peerjs.min.js
    Peer: 'readonly'
};

module.exports = [
    {
        ignores: ['node_modules/**', 'js/vendor/**']
    },
    {
        files: ['js/**/*.js'],
        ignores: ['js/ai-worker.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...globals.browser, ...globals.commonjs, ...gameGlobals }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }]
        }
    },
    {
        files: ['js/ai-worker.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: { ...globals.worker, ...gameGlobals }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { args: 'none' }]
        }
    },
    {
        files: ['main.js', 'tests/**/*.js', 'eslint.config.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: { ...globals.node, ...gameGlobals }
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': ['warn', { args: 'none' }]
        }
    }
];
