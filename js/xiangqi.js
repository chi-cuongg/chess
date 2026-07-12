/* exported XiangqiGame */
class XiangqiGame {
    constructor() {
        // Red is at the bottom (rows 7-9), Black at top (rows 0-2)
        // 9 cols (0-8), 10 rows (0-9)
        this.board = Array(10).fill().map(() => Array(9).fill(null));
        this.turn = 'red';
        this.selectedSquare = null;
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

        // Initial setup string for convenience or manual placement
        this.initBoardSetup();
    }

    init() {
        this.createBoard();
        this.history = []; // Track history
        this.initBoardSetup();
        this.turn = 'red';
        this.selectedSquare = null;
        this.isGameOver = false;
        this.renderBoard();
        this.updateStatus('Lượt: Đỏ');
    }

    initBoardSetup() {
        const setup = [
            ['B_R', 'B_H', 'B_E', 'B_A', 'B_K', 'B_A', 'B_E', 'B_H', 'B_R'],
            [null, null, null, null, null, null, null, null, null],
            [null, 'B_C', null, null, null, null, null, 'B_C', null],
            ['B_P', null, 'B_P', null, 'B_P', null, 'B_P', null, 'B_P'],
            [null, null, null, null, null, null, null, null, null], // River (Black side)
            [null, null, null, null, null, null, null, null, null], // River (Red side)
            ['R_P', null, 'R_P', null, 'R_P', null, 'R_P', null, 'R_P'],
            [null, 'R_C', null, null, null, null, null, 'R_C', null],
            [null, null, null, null, null, null, null, null, null],
            ['R_R', 'R_H', 'R_E', 'R_A', 'R_K', 'R_A', 'R_E', 'R_H', 'R_R']
        ];

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                this.board[r][c] = setup[r][c];
            }
        }
    }

    createBoard() {
        const chessboard = document.getElementById('chessboard');
        chessboard.innerHTML = '';
        chessboard.className = 'xiangqi-board'; // Ensure class is set

        // Add Palace markers
        const palaceTop = document.createElement('div');
        palaceTop.className = 'palace-top';
        chessboard.appendChild(palaceTop);

        const palaceBottom = document.createElement('div');
        palaceBottom.className = 'palace-bottom';
        chessboard.appendChild(palaceBottom);

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const square = document.createElement('div');
                square.className = 'square';
                square.dataset.row = r;
                square.dataset.col = c;
                square.addEventListener('click', (e) => this.handleSquareClick(r, c));
                chessboard.appendChild(square);
            }
        }
    }

    renderBoard() {
        const squares = document.querySelectorAll('.xiangqi-board .square');
        // Clear pieces primarily, but squares structure is static
        squares.forEach(sq => {
            // Remove existing pieces if any
            const existingPiece = sq.querySelector('.xiangqi-piece');
            if (existingPiece) existingPiece.remove();
        });

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const code = this.board[r][c];
                if (code) {
                    const pieceData = this.pieces[code];
                    const pieceEl = document.createElement('div');
                    pieceEl.className = `xiangqi-piece ${pieceData.color}`;
                    pieceEl.textContent = pieceData.symbol;

                    // Find the correct square
                    // Index = r * 9 + c
                    const square = squares[r * 9 + c];
                    square.appendChild(pieceEl);
                }
            }
        }
    }

    handleSquareClick(row, col) {
        if (this.isGameOver) return;

        const pieceCode = this.board[row][col];

        if (this.selectedSquare) {
            // Move logic
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                this.selectedSquare = null; // Deselect
                this.clearHighlights();
            } else {
                // Validate move
                const fromR = this.selectedSquare.row;
                const fromC = this.selectedSquare.col;

                if (this.isValidMove(fromR, fromC, row, col)) {
                    // 1. Simulate move to check for Self-Check
                    const fromPiece = this.board[fromR][fromC];
                    const targetPiece = this.board[row][col];

                    // Temp move
                    this.board[row][col] = fromPiece;
                    this.board[fromR][fromC] = null;

                    const isSelfCheck = this.isCheck(this.turn);
                    const isFlyingGen = this.isFlyingGeneral();

                    // Undo temp move
                    this.board[fromR][fromC] = fromPiece;
                    this.board[row][col] = targetPiece;

                    if (isSelfCheck) {
                        this.flashStatus('Nước đi không hợp lệ: Tướng đang bị chiếu!');
                        return;
                    }

                    if (isFlyingGen) {
                        this.flashStatus('Nước đi không hợp lệ: Hai tướng không được đối mặt!');
                        return;
                    }

                    // 2. Execute Real Move
                    // Track history
                    this.history.push({
                        from: { r: fromR, c: fromC },
                        to: { r: row, c: col },
                        captured: targetPiece,
                        turn: this.turn
                    });

                    this.board[row][col] = fromPiece;
                    this.board[fromR][fromC] = null;

                    this.selectedSquare = null;
                    const mover = this.turn;
                    this.turn = this.turn === 'red' ? 'black' : 'red';

                    this.renderBoard();
                    this.clearHighlights();

                    // 3. Check game end: opponent has no legal move left
                    const inCheck = this.isCheck(this.turn);
                    if (!this.hasAnyLegalMove(this.turn)) {
                        this.isGameOver = true;
                        const winnerText = mover === 'red' ? 'Đỏ' : 'Đen';
                        if (inCheck) {
                            this.updateStatus(`Chiếu bí! ${winnerText} thắng!`);
                            this.showGameOver(`Chiếu bí! ${winnerText} thắng!`);
                        } else {
                            // In xiangqi, the stalemated side loses
                            this.updateStatus(`Hết nước đi! ${winnerText} thắng!`);
                            this.showGameOver(`Hết nước đi! ${winnerText} thắng!`);
                        }
                        return;
                    }

                    if (inCheck) {
                        this.showCheckAnimation();
                    }

                    this.updateStatus(`Lượt: ${this.turn === 'red' ? 'Đỏ' : 'Đen'}`);
                } else {
                    this.selectedSquare = null;
                    this.clearHighlights();
                }
            }
        } else {
            if (pieceCode) {
                // Check turn
                const pieceData = this.pieces[pieceCode];
                if (pieceData.color !== this.turn) return;

                // Start selection
                this.selectedSquare = { row, col };
                this.highlightSquare(row, col);
            }
        }
    }

    highlightSquare(row, col) {
        this.clearHighlights();
        const squares = document.querySelectorAll('.xiangqi-board .square');
        squares[row * 9 + col].style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
    }

    clearHighlights() {
        document.querySelectorAll('.xiangqi-board .square').forEach(sq => {
            sq.style.backgroundColor = 'transparent';
        });
    }

    updateStatus(msg) {
        const status = document.getElementById('game-status');
        if (status) status.textContent = msg;
    }

    // Briefly show a warning in the status bar, then restore the turn text
    flashStatus(msg) {
        const status = document.getElementById('game-status');
        if (!status) return;
        status.textContent = msg;
        status.style.color = 'red';
        setTimeout(() => {
            status.style.color = '';
            if (!this.isGameOver) {
                status.textContent = `Lượt: ${this.turn === 'red' ? 'Đỏ' : 'Đen'}`;
            }
        }, 1500);
    }

    showGameOver(msg) {
        const modal = document.getElementById('game-over-modal');
        const message = document.getElementById('game-over-message');
        const title = document.getElementById('game-over-title');

        if (modal && message && title) {
            title.textContent = 'Kết thúc!';
            message.textContent = msg;
            modal.classList.add('show');
        }
    }

    // A move is fully legal if valid, doesn't leave own general in check
    // and doesn't expose the flying-general position
    isLegalMoveFull(fromR, fromC, toR, toC) {
        if (!this.isValidMove(fromR, fromC, toR, toC)) return false;

        const fromPiece = this.board[fromR][fromC];
        const targetPiece = this.board[toR][toC];
        const color = this.pieces[fromPiece].color;

        this.board[toR][toC] = fromPiece;
        this.board[fromR][fromC] = null;
        const illegal = this.isCheck(color) || this.isFlyingGeneral();
        this.board[fromR][fromC] = fromPiece;
        this.board[toR][toC] = targetPiece;

        return !illegal;
    }

    hasAnyLegalMove(color) {
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const code = this.board[r][c];
                if (!code || this.pieces[code].color !== color) continue;
                for (let tr = 0; tr < 10; tr++) {
                    for (let tc = 0; tc < 9; tc++) {
                        if (tr === r && tc === c) continue;
                        if (this.isLegalMoveFull(r, c, tr, tc)) return true;
                    }
                }
            }
        }
        return false;
    }

    newGame() {
        this.init();
        document.getElementById('game-over-modal')?.classList.remove('show');
    }

    undoMove() {
        if (this.history.length === 0) return;
        const lastMove = this.history.pop();
        const { from, to, captured, turn } = lastMove;

        // Move piece back
        const piece = this.board[to.r][to.c];
        this.board[from.r][from.c] = piece;
        this.board[to.r][to.c] = captured;

        // Restore turn
        this.turn = turn;
        this.selectedSquare = null;
        this.isGameOver = false;
        document.getElementById('game-over-modal')?.classList.remove('show');

        // Render
        this.renderBoard();
        this.updateStatus(`Lượt: ${this.turn === 'red' ? 'Đỏ' : 'Đen'}`);
        this.clearHighlights();
    }

    isValidMove(fromR, fromC, toR, toC) {
        const pieceCode = this.board[fromR][fromC];
        if (!pieceCode) return false;

        const piece = this.pieces[pieceCode];
        const targetCode = this.board[toR][toC];

        // Cannot capture own piece
        if (targetCode) {
            const targetPiece = this.pieces[targetCode];
            if (targetPiece.color === piece.color) return false;
        }

        // Piece specific logic
        switch (piece.name) {
            case 'General': // Tướng/Soái
                return this.isValidGeneralMove(fromR, fromC, toR, toC, piece.color);
            case 'Advisor': // Sĩ
                return this.isValidAdvisorMove(fromR, fromC, toR, toC, piece.color);
            case 'Elephant': // Tượng
                return this.isValidElephantMove(fromR, fromC, toR, toC, piece.color);
            case 'Horse': // Mã
                return this.isValidHorseMove(fromR, fromC, toR, toC);
            case 'Chariot': // Xe
                return this.isValidChariotMove(fromR, fromC, toR, toC);
            case 'Cannon': // Pháo
                return this.isValidCannonMove(fromR, fromC, toR, toC);
            case 'Soldier': // Tốt/Binh
                return this.isValidSoldierMove(fromR, fromC, toR, toC, piece.color);
            default:
                return false;
        }
    }

    isValidGeneralMove(r1, c1, r2, c2, color) {
        // Move 1 step orthogonal
        const d = Math.abs(r1 - r2) + Math.abs(c1 - c2);
        if (d !== 1) return false;

        // Must be in Palace
        // Red Palace: r 7-9, c 3-5
        // Black Palace: r 0-2, c 3-5
        if (c2 < 3 || c2 > 5) return false;
        if (color === 'red') {
            if (r2 < 7 || r2 > 9) return false;
        } else {
            if (r2 < 0 || r2 > 2) return false;
        }
        return true;
    }

    isValidAdvisorMove(r1, c1, r2, c2, color) {
        // Move 1 step diagonal
        if (Math.abs(r1 - r2) !== 1 || Math.abs(c1 - c2) !== 1) return false;

        // Must be in Palace
        if (c2 < 3 || c2 > 5) return false;
        if (color === 'red') {
            if (r2 < 7 || r2 > 9) return false;
        } else {
            if (r2 < 0 || r2 > 2) return false;
        }
        return true;
    }

    isValidElephantMove(r1, c1, r2, c2, color) {
        // Move exactly 2 steps diagonal
        if (Math.abs(r1 - r2) !== 2 || Math.abs(c1 - c2) !== 2) return false;

        // Cannot cross river
        // River is between r4 and r5
        if (color === 'red') {
            if (r2 < 5) return false; // Red elephant stays bottom
        } else {
            if (r2 > 4) return false; // Black elephant stays top
        }

        // Block eye (blocking point is the midpoint)
        const midR = (r1 + r2) / 2;
        const midC = (c1 + c2) / 2;
        if (this.board[midR][midC]) return false;

        return true;
    }

    isValidHorseMove(r1, c1, r2, c2) {
        // L shape: 2 orth + 1 perp
        const dr = r2 - r1;
        const dc = c2 - c1;
        const absDr = Math.abs(dr);
        const absDc = Math.abs(dc);

        if (!((absDr === 2 && absDc === 1) || (absDr === 1 && absDc === 2))) return false;

        // Blocking legs
        if (absDr === 2) {
            const midR = r1 + (dr > 0 ? 1 : -1);
            if (this.board[midR][c1]) return false;
        } else {
            const midC = c1 + (dc > 0 ? 1 : -1);
            if (this.board[r1][midC]) return false;
        }

        return true;
    }

    isValidChariotMove(r1, c1, r2, c2) {
        // Orthogonal only
        if (r1 !== r2 && c1 !== c2) return false;

        // Check path clear
        return this.countPiecesBetween(r1, c1, r2, c2) === 0;
    }

    isValidCannonMove(r1, c1, r2, c2) {
        // Orthogonal only
        if (r1 !== r2 && c1 !== c2) return false;

        const piecesBetween = this.countPiecesBetween(r1, c1, r2, c2);
        const target = this.board[r2][c2];

        if (!target) {
            // Move: path must be clear
            return piecesBetween === 0;
        } else {
            // Capture: must have exactly 1 piece between (screen)
            return piecesBetween === 1;
        }
    }

    isValidSoldierMove(r1, c1, r2, c2, color) {
        const dr = r2 - r1;
        const dc = c2 - c1;

        // Cannot move backwards
        // Red moves UP (-1), Black moves DOWN (+1)

        // Check if moving backwards
        if (color === 'red' && dr > 0) return false;
        if (color === 'black' && dr < 0) return false;

        // Must move 1 step total
        if (Math.abs(dr) + Math.abs(dc) !== 1) return false;

        // Check river crossing
        const crossedRiver = color === 'red' ? r1 <= 4 : r1 >= 5;

        if (!crossedRiver) {
            // Must move forward only
            if (Math.abs(dc) !== 0) return false;
        }

        return true;
    }

    countPiecesBetween(r1, c1, r2, c2) {
        let count = 0;
        if (r1 === r2) {
            const minC = Math.min(c1, c2);
            const maxC = Math.max(c1, c2);
            for (let c = minC + 1; c < maxC; c++) {
                if (this.board[r1][c]) count++;
            }
        } else {
            const minR = Math.min(r1, r2);
            const maxR = Math.max(r1, r2);
            for (let r = minR + 1; r < maxR; r++) {
                if (this.board[r][c1]) count++;
            }
        }
        return count;
    }

    isFlyingGeneral() {
        // Find Generals
        let redGen = null;
        let blackGen = null;

        for (let r = 0; r < 10; r++) {
            for (let c = 3; c <= 5; c++) { // Generals only in 3-5
                const p = this.board[r][c];
                if (p === 'R_K') redGen = { r, c };
                if (p === 'B_K') blackGen = { r, c };
            }
        }

        if (redGen && blackGen && redGen.c === blackGen.c) {
            // Same column, check pieces between
            if (this.countPiecesBetween(redGen.r, redGen.c, blackGen.r, blackGen.c) === 0) {
                return true; // Flying General!
            }
        }
        return false;
    }

    isCheck(color) {
        // 1. Find the King
        let kingPos = null;
        const kingName = color === 'red' ? 'R_K' : 'B_K';

        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (this.board[r][c] === kingName) {
                    kingPos = { r, c };
                    break;
                }
            }
            if (kingPos) break;
        }

        if (!kingPos) return false; // Should not happen

        // 2. Check if any enemy piece can move to King's position
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                const pieceCode = this.board[r][c];
                if (pieceCode) {
                    const piece = this.pieces[pieceCode];
                    if (piece.color !== color) {
                        // Check if this enemy piece can attack the King
                        if (this.isValidMove(r, c, kingPos.r, kingPos.c)) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    showCheckAnimation() {
        const status = document.getElementById('game-status');
        const originalText = status.textContent;
        status.textContent = "CHIẾU TƯỚNG!";
        status.style.color = "red";
        status.style.fontWeight = "bold";
        status.style.transform = "scale(1.5)";
        status.style.transition = "all 0.3s ease";

        setTimeout(() => {
            status.textContent = originalText;
            status.style.color = "";
            status.style.fontWeight = "";
            status.style.transform = "scale(1)";
        }, 2000);

        // Optional: Visual effect on board overlay
        const board = document.getElementById('chessboard');
        const overlay = document.createElement('div');
        overlay.className = 'check-overlay';
        overlay.textContent = "CHIẾU TƯỚNG";
        board.appendChild(overlay);

        setTimeout(() => {
            overlay.remove();
        }, 1500);
    }
}
