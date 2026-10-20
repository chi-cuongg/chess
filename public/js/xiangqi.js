class XiangqiGame {
    constructor() {
        this.pieces = {
            // Red pieces
            'R_K': { symbol: '帅', color: 'red', name: 'General' },
            'R_A': { symbol: '仕', color: 'red', name: 'Advisor' },
            'R_E': { symbol: '相', color: 'red', name: 'Elephant' },
            'R_H': { symbol: '傌', color: 'red', name: 'Horse' },
            'R_R': { symbol: '俥', color: 'red', name: 'Chariot' },
            'R_C': { symbol: '炮', color: 'red', name: 'Cannon' },
            'R_P': { symbol: '兵', color: 'red', name: 'Soldier' },

            // Black pieces
            'B_K': { symbol: '将', color: 'black', name: 'General' },
            'B_A': { symbol: '士', color: 'black', name: 'Advisor' },
            'B_E': { symbol: '象', color: 'black', name: 'Elephant' },
            'B_H': { symbol: '馬', color: 'black', name: 'Horse' },
            'B_R': { symbol: '車', color: 'black', name: 'Chariot' },
            'B_C': { symbol: '砲', color: 'black', name: 'Cannon' },
            'B_P': { symbol: '卒', color: 'black', name: 'Soldier' }
        };

        this.playingAgainstAI = false;
        this.humanColor = 'red';
        this.onClick = e => {
            const square = e.target.closest('.square');
            if (square && this.boardEl.contains(square)) this.handleSquareClick(Number(square.dataset.row), Number(square.dataset.col));
        };
        this.onSideChange = e => {
            this.humanColor = e.target.value;
            this.newGame();
        };
    }

    init() {
        this.active = true;
        this.boardEl = document.getElementById('chessboard');
        this.boardEl.addEventListener('click', this.onClick);
        document.getElementById('xiangqi-side-control').hidden = false;
        document.getElementById('xiangqi-side').addEventListener('change', this.onSideChange);
        this.createBoard();
        this.newGame();
    }

    createBoard() {
        this.boardEl.innerHTML = '';
        this.boardEl.className = 'xiangqi-board';
        for (const position of ['top', 'bottom']) {
            const palace = document.createElement('div');
            palace.className = 'palace-' + position;
            this.boardEl.appendChild(palace);
        }
        this.squares = [];
        for (let r = 0; r < 10; r++) for (let c = 0; c < 9; c++) {
            const square = document.createElement('div');
            square.className = 'square';
            square.dataset.row = r;
            square.dataset.col = c;
            this.squares.push(square);
            this.boardEl.appendChild(square);
        }
    }

    newGame() {
        this.cancelAI();
        this.board = XiangqiRules.createInitialBoard();
        this.turn = 'red';
        this.history = [];
        this.captured = [];
        this.lastMove = null;
        this.selectedSquare = null;
        this.isGameOver = false;
        this.inCheck = false;
        this.advanceState();
        document.getElementById('game-over-modal').classList.remove('show');
        this.flipBoard(this.playingAgainstAI && this.humanColor === 'black');
        this.refresh();
        this.scheduleAI();
    }

    flipBoard(flipped) {
        this.isFlipped = !!flipped;
        this.boardEl.classList.toggle('xiangqi-flipped', flipped);
        this.emitState();
    }

    handleSquareClick(r, c) {
        return this.selectSquare(r, c);
    }

    selectSquare(r, c) {
        if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= 10 || c < 0 || c >= 9) return;
        if (!this.active || this.isGameOver || this.aiThinking || this.playingAgainstAI && this.turn !== this.humanColor) return;
        this.lastCaptured = null;
        if (this.selectedSquare?.r === r && this.selectedSquare?.c === c) this.selectedSquare = null;
        else if (XiangqiRules.colorOf(this.board[r][c]) === this.turn) this.selectedSquare = { r, c };
        else if (this.selectedSquare) {
            const move = this.legalMoves.find(m => m.from.r === this.selectedSquare.r && m.from.c === this.selectedSquare.c && m.to.r === r && m.to.c === c);
            if (move) { this.makeMove(move); return; }
            this.selectedSquare = null;
        }
        this.renderBoard();
        this.emitState();
    }

    getState() {
        const point = p => p ? { row: p.r, col: p.c } : null;
        const hints = this.selectedSquare ? (this.legalMoves || []).filter(m =>
            m.from.r === this.selectedSquare.r && m.from.c === this.selectedSquare.c).map(m => ({
            ...point(m.to), capture: !!this.board[m.to.r][m.to.c]
        })) : [];
        return JSON.parse(JSON.stringify({
            game: 'xiangqi', rows: 10, cols: 9, board: this.board, turn: this.turn,
            selected: point(this.selectedSquare), hints,
            lastMove: this.lastMove ? { from: point(this.lastMove.from), to: point(this.lastMove.to) } : null,
            captured: this.lastCaptured || null,
            check: this.inCheck ? point(XiangqiRules.findGeneral(this.board, this.turn)) : null,
            winLine: null, gameOver: !!this.isGameOver, flipped: !!this.isFlipped,
            aiThinking: !!this.aiThinking, moveId: this.moveId || 0
        }));
    }

    emitState() {
        if (!this.board || !window.dispatchEvent || typeof CustomEvent === 'undefined') return;
        const detail = this.getState(), key = JSON.stringify(detail);
        if (key === this.stateKey) return;
        this.stateKey = key;
        window.dispatchEvent(new CustomEvent('game:state', { detail }));
    }

    advanceState(captured = null) {
        this.moveId = (this.moveId || 0) + 1;
        this.lastCaptured = captured;
    }

    makeMove(move) {
        this.history.push({ board: this.board, turn: this.turn, lastMove: this.lastMove, captured: [...this.captured] });
        const target = this.board[move.to.r][move.to.c];
        if (target) this.captured.push(target);
        this.advanceState(target ? { row: move.to.r, col: move.to.c, piece: target } : null);
        this.board = XiangqiRules.applyMove(this.board, move);
        this.lastMove = move;
        this.turn = XiangqiRules.opponent(this.turn);
        this.selectedSquare = null;
        this.refresh();
        this.scheduleAI();
    }

    refresh() {
        this.legalMoves = XiangqiRules.generateLegalMoves(this.board, this.turn);
        this.inCheck = XiangqiRules.isInCheck(this.board, this.turn);
        this.isGameOver = this.legalMoves.length === 0;
        const name = this.turn === 'red' ? 'Đỏ' : 'Đen';
        if (this.isGameOver) {
            const result = `${this.inCheck ? 'Chiếu bí' : 'Hết nước đi'}! ${this.turn === 'red' ? 'Đen' : 'Đỏ'} thắng!`;
            this.updateStatus(result);
            document.getElementById('game-over-title').textContent = 'Kết thúc!';
            document.getElementById('game-over-message').textContent = result;
            document.getElementById('game-over-modal').classList.add('show');
        } else this.updateStatus(`Lượt: ${name}${this.inCheck ? ' — Chiếu tướng!' : ''}`);
        document.querySelector('#turn-indicator span:last-child').textContent = `Lượt: ${name}`;
        document.querySelector('#turn-indicator .turn-dot').className = `turn-dot ${this.turn === 'red' ? 'red-turn' : 'black-turn'}`;
        this.renderBoard();
        this.emitState();
    }

    renderBoard() {
        const king = this.inCheck ? XiangqiRules.findGeneral(this.board, this.turn) : null;
        const hints = this.selectedSquare ? this.legalMoves.filter(m => m.from.r === this.selectedSquare.r && m.from.c === this.selectedSquare.c) : [];
        this.squares.forEach(square => {
            const r = Number(square.dataset.row), c = Number(square.dataset.col);
            const code = this.board[r][c];
            if (square.dataset.piece !== (code || '')) {
                square.innerHTML = '';
                if (code) {
                    const piece = document.createElement('div');
                    piece.className = 'xiangqi-piece ' + this.pieces[code].color;
                    piece.textContent = this.pieces[code].symbol;
                    square.appendChild(piece);
                }
                square.dataset.piece = code || '';
            }
            square.classList.toggle('selected', this.selectedSquare?.r === r && this.selectedSquare?.c === c);
            square.classList.toggle('last-move', !!this.lastMove && [this.lastMove.from, this.lastMove.to].some(p => p.r === r && p.c === c));
            square.classList.toggle('check', king?.r === r && king?.c === c);
            const hint = hints.some(m => m.to.r === r && m.to.c === c);
            square.classList.toggle('valid-move', hint && !code);
            square.classList.toggle('valid-capture', hint && !!code);
        });
        for (const [color, id] of [['red', 'captured-white'], ['black', 'captured-black']]) {
            document.getElementById(id).textContent = this.captured.filter(code => XiangqiRules.colorOf(code) === color).map(code => this.pieces[code].symbol).join(' ');
        }
    }

    undoMove() {
        this.cancelAI();
        // Pending AI reply: undo only the human move. Completed reply: undo the pair.
        const count = this.playingAgainstAI && this.turn === this.humanColor ? 2 : 1;
        for (let i = 0; i < count && this.history.length; i++) Object.assign(this, this.history.pop());
        this.selectedSquare = null;
        this.advanceState();
        document.getElementById('game-over-modal').classList.remove('show');
        this.refresh();
        this.scheduleAI();
    }

    setAI(enabled, difficulty) {
        this.cancelAI();
        this.playingAgainstAI = enabled && Number(difficulty) > 0;
        this.difficulty = Number(difficulty) || 4;
        this.flipBoard(this.playingAgainstAI && this.humanColor === 'black');
        this.scheduleAI();
        this.emitState();
    }

    scheduleAI() {
        if (!this.active || !this.playingAgainstAI || this.isGameOver || this.turn === this.humanColor || this.aiThinking) return;
        this.aiThinking = true;
        this.emitState();
        this.updateStatus('AI đang suy nghĩ...');
        const requestId = this.requestId;
        const accept = move => {
            if (requestId !== this.requestId || !this.active || !this.aiThinking) return;
            this.aiThinking = false;
            this.worker?.terminate();
            this.worker = null;
            const legal = this.legalMoves.find(m => move && m.from.r === move.from.r && m.from.c === move.from.c && m.to.r === move.to.r && m.to.c === move.to.c);
            if (legal) this.makeMove(legal);
            else this.refresh();
        };
        const fallback = () => {
            if (requestId !== this.requestId || !this.active) return;
            this.worker?.terminate();
            this.worker = null;
            const search = XiangqiAI.createSearch(this.board, this.turn, { difficulty: this.difficulty });
            const step = () => {
                if (requestId !== this.requestId || !this.active) return;
                const state = search.step(8);
                if (state.done) accept(state.bestMove);
                else this.aiTimer = setTimeout(step, 0);
            };
            this.aiTimer = setTimeout(step, 0);
        };
        try {
            this.worker = new Worker('js/ai-worker.js');
            this.worker.onmessage = e => {
                if (e.data.requestId === requestId) accept(e.data.bestMove);
            };
            this.worker.onerror = fallback;
            this.worker.postMessage({ game: 'xiangqi', requestId, board: this.board, color: this.turn, difficulty: this.difficulty });
        } catch (error) { fallback(); }
    }

    cancelAI() {
        this.requestId = (this.requestId || 0) + 1;
        clearTimeout(this.aiTimer);
        this.worker?.terminate();
        this.worker = null;
        this.aiThinking = false;
    }

    updateStatus(message) {
        document.getElementById('game-status').textContent = message;
    }

    destroy() {
        this.cancelAI();
        this.active = false;
        this.boardEl.removeEventListener('click', this.onClick);
        document.getElementById('xiangqi-side').removeEventListener('change', this.onSideChange);
        document.getElementById('xiangqi-side-control').hidden = true;
    }
}
