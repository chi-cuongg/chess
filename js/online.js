// ========================================
// Online Manager - P2P Connection with PeerJS
// ========================================

class OnlineManager {
    constructor(game) {
        this.game = game;
        this.peer = null;
        this.connection = null;
        this.isHost = false;
        this.roomId = null;
        this.playerName = '';
        this.opponentName = '';
        this.playerColor = 'white';
        this.isConnected = false;
        this.chatManager = null;

        this.init();
    }

    init() {
        // Check if we're joining a room from URL
        const urlParams = new URLSearchParams(window.location.search);
        const joinRoom = urlParams.get('room');

        if (joinRoom) {
            this.showJoinDialog(joinRoom);
        }
    }

    // ========================================
    // Create Room (Host)
    // ========================================
    createRoom(playerName) {
        this.playerName = playerName || 'Player 1';
        this.isHost = true;
        this.playerColor = 'white';

        // Generate random room ID
        this.roomId = this.generateRoomId();

        // Initialize PeerJS with STUN servers
        this.peer = new Peer(this.roomId, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id) => {
            console.log('Room created with ID:', id);
            this.roomId = id; // Sync with actual ID from server
            this.updateStatus('waiting', `Đang chờ đối thủ...`);

            // Add room to URL for easier sharing/refresh
            const newUrl = `${window.location.pathname}?room=${id}`;
            window.history.replaceState({ path: newUrl }, '', newUrl);

            this.showShareLink();
        });

        this.peer.on('connection', (conn) => {
            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            this.updateStatus('error', 'Lỗi kết nối: ' + err.type);
        });
    }

    // ========================================
    // Join Room (Guest)
    // ========================================
    joinRoom(roomId, playerName) {
        this.playerName = playerName || 'Player 2';
        this.isHost = false;
        this.roomId = roomId;
        this.playerColor = 'black';

        // Initialize PeerJS with STUN servers
        this.peer = new Peer({
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', () => {
            console.log('Connecting to room:', roomId);
            this.updateStatus('connecting', 'Đang kết nối...');

            const conn = this.peer.connect(roomId, {
                reliable: true,
                serialization: 'json'
            });

            this.handleConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('Peer error:', err);
            if (err.type === 'peer-unavailable') {
                this.updateStatus('error', 'Phòng không tồn tại hoặc đã đóng');
            } else {
                this.updateStatus('error', 'Lỗi kết nối: ' + err.type);
            }
        });
    }

    // ========================================
    // Handle Connection
    // ========================================
    handleConnection(conn) {
        this.connection = conn;

        conn.on('open', () => {
            this.isConnected = true;
            console.log('Connected!');

            // Close share modal if open
            const shareModal = document.getElementById('share-modal');
            if (shareModal) {
                shareModal.classList.remove('show');
            }

            // Send player info
            this.send({
                type: 'player_info',
                name: this.playerName,
                isHost: this.isHost
            });

            // If host, start new game and send initial state
            if (this.isHost) {
                this.game.newGame();
                // Send state with a slight delay to ensure connection is ready
                setTimeout(() => {
                    this.send({
                        type: 'game_state',
                        board: this.game.board,
                        turn: this.game.currentTurn
                    });
                }, 500);
            } else {
                // If guest, flip board
                this.game.flipBoard();
            }

            this.updateStatus('connected', 'Đã kết nối!');
            this.showOnlineControls();

            // Do not remove room param from URL to allow refresh
            // window.history.replaceState({}, document.title, window.location.pathname);
        });

        conn.on('data', (data) => {
            this.handleMessage(data);
        });

        conn.on('close', () => {
            this.isConnected = false;
            this.updateStatus('disconnected', 'Đối thủ đã ngắt kết nối');
            // Revert board flip if disconnected
            if (!this.isHost) {
                this.game.flipBoard(false);
            }
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    // ========================================
    // Message Handler
    // ========================================
    handleMessage(data) {
        switch (data.type) {
            case 'player_info':
                this.opponentName = data.name;
                this.updatePlayerInfo();
                break;

            case 'game_state':
                // Sync game state (for guest joining)
                this.game.board = data.board;
                this.game.currentTurn = data.turn;
                this.game.renderBoard();
                this.game.updateTurnIndicator();
                break;

            case 'move':
                // Apply opponent's move
                this.applyOpponentMove(data);
                break;

            case 'chat':
                if (this.chatManager) {
                    this.chatManager.receiveMessage(data.message, this.opponentName);
                }
                break;

            case 'new_game':
                this.game.newGame();
                break;

            case 'resign':
                this.handleOpponentResign();
                break;
        }
    }

    // ========================================
    // Send Data
    // ========================================
    send(data) {
        if (this.connection && this.isConnected) {
            this.connection.send(data);
        }
    }

    // ========================================
    // Send Move
    // ========================================
    sendMove(fromRow, fromCol, toRow, toCol, promotionPiece = null) {
        this.send({
            type: 'move',
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            promotion: promotionPiece
        });
    }

    // ========================================
    // Apply Opponent's Move
    // ========================================
    applyOpponentMove(data) {
        const { from, to, promotion } = data;

        // Get valid moves for the piece
        const validMoves = this.game.getValidMoves(from.row, from.col);
        const move = validMoves.find(m => m.row === to.row && m.col === to.col);

        if (move) {
            // Handle promotion
            if (promotion) {
                this.game.pendingPromotion = { from, to };
                this.game.promotePawn(promotion);
            } else {
                this.game.makeMove(from.row, from.col, to.row, to.col, move);
            }
        }
    }

    // ========================================
    // Check if it's player's turn
    // ========================================
    isPlayerTurn() {
        if (!this.isConnected) return true; // Local play
        return this.game.currentTurn === this.playerColor;
    }

    // ========================================
    // Handle Opponent Resign
    // ========================================
    handleOpponentResign() {
        const winner = this.playerColor === 'white' ? 'Trắng' : 'Đen';
        this.game.showGameOver(`${this.opponentName} đã đầu hàng!`, `${winner} thắng!`);
    }

    // ========================================
    // Resign
    // ========================================
    resign() {
        this.send({ type: 'resign' });
        const winner = this.playerColor === 'white' ? 'Đen' : 'Trắng';
        this.game.showGameOver('Bạn đã đầu hàng!', `${winner} thắng!`);
    }

    // ========================================
    // Request New Game
    // ========================================
    requestNewGame() {
        this.send({ type: 'new_game' });
        this.game.newGame();
    }

    // ========================================
    // UI Updates
    // ========================================
    updateStatus(status, message) {
        const statusEl = document.getElementById('online-status');
        if (statusEl) {
            statusEl.className = `online-status ${status}`;
            statusEl.textContent = message;
        }
    }

    updatePlayerInfo() {
        const opponentEl = document.getElementById('opponent-name');
        if (opponentEl) {
            opponentEl.textContent = this.opponentName;
        }

        const playerEl = document.getElementById('player-name');
        if (playerEl) {
            playerEl.textContent = this.playerName;
        }

        const colorEl = document.getElementById('player-color');
        if (colorEl) {
            colorEl.textContent = this.playerColor === 'white' ? '♔ Trắng' : '♚ Đen';
        }
    }

    showShareLink() {
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${this.roomId}`;

        const modal = document.getElementById('share-modal');
        const linkInput = document.getElementById('share-link');
        const codeText = document.getElementById('room-code-text');

        if (modal && linkInput) {
            linkInput.value = shareUrl;
            if (codeText) {
                codeText.textContent = this.roomId;
            }
            modal.classList.add('show');
        }
    }

    showOnlineControls() {
        const onlinePanel = document.getElementById('online-panel');
        if (onlinePanel) {
            onlinePanel.classList.add('connected');
        }

        // Show player info
        const playerInfoPanel = document.getElementById('player-info-panel');
        if (playerInfoPanel) {
            playerInfoPanel.style.display = 'block';
        }

        // Show chat
        const chatPanel = document.getElementById('chat-panel');
        if (chatPanel) {
            chatPanel.classList.add('show');
        }
    }

    showJoinDialog(roomId) {
        const name = prompt('Nhập tên của bạn:', 'Player 2');
        if (name !== null) {
            this.joinRoom(roomId, name);
        }
    }

    // ========================================
    // Utilities
    // ========================================
    generateRoomId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    disconnect() {
        if (this.connection) {
            this.connection.close();
        }
        if (this.peer) {
            this.peer.destroy();
        }
        this.isConnected = false;
        this.connection = null;
        this.peer = null;
    }
}

// Export for global access
window.OnlineManager = OnlineManager;
