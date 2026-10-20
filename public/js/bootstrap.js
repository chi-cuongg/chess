// ========================================
// Application Bootstrap
// ========================================
// Wires the online, chat and history managers together once the base game
// (window.chessGame) has been created. Loaded after all other scripts and
// after the game's own DOMContentLoaded handler, so window.chessGame exists.

document.addEventListener('DOMContentLoaded', () => {
    if (!window.chessGame) return;

    // Initialize Online Manager
    window.onlineManager = new OnlineManager(window.chessGame);

    // Initialize Chat Manager
    window.chatManager = new ChatManager(window.onlineManager);
    window.onlineManager.chatManager = window.chatManager;

    // Initialize Game History
    window.gameHistory = new GameHistory();

    const byId = (id) => document.getElementById(id);

    // Create Room Button
    byId('create-room-btn')?.addEventListener('click', () => {
        const name = prompt('Nhập tên của bạn:', 'Player 1');
        if (name) {
            window.onlineManager.createRoom(name);
        }
    });

    // Join Room Button
    byId('join-room-btn')?.addEventListener('click', () => {
        const roomCode = (byId('room-code-input')?.value || '').trim().toUpperCase();
        if (roomCode.length === 6) {
            const name = prompt('Nhập tên của bạn:', 'Player 2');
            if (name) {
                window.onlineManager.joinRoom(roomCode, name);
            }
        } else {
            alert('Mã phòng phải có 6 ký tự!');
        }
    });

    // Copy Link Button
    byId('copy-link-btn')?.addEventListener('click', () => {
        const linkInput = byId('share-link');
        navigator.clipboard.writeText(linkInput.value).then(() => {
            alert('Đã copy link!');
        });
    });

    // Copy Code Button
    byId('copy-code-btn')?.addEventListener('click', () => {
        const code = byId('room-code-text')?.textContent || '';
        navigator.clipboard.writeText(code).then(() => {
            alert('Đã copy mã phòng: ' + code);
        });
    });

    // Close Share Modal
    byId('close-share-btn')?.addEventListener('click', () => {
        byId('share-modal')?.classList.remove('show');
    });

    // Online: resign
    byId('resign-btn')?.addEventListener('click', () => {
        if (!window.onlineManager?.isConnected) return;
        if (confirm('Bạn chắc chắn muốn đầu hàng?')) {
            window.onlineManager.resign();
        }
    });

    // Online: request a new game
    byId('online-new-game-btn')?.addEventListener('click', () => {
        if (!window.onlineManager?.isConnected) return;
        if (confirm('Bắt đầu ván mới? Ván hiện tại sẽ kết thúc.')) {
            window.onlineManager.requestNewGame();
        }
    });

    // Close History Modal
    byId('close-history-btn')?.addEventListener('click', () => {
        byId('history-modal')?.classList.remove('show');
    });

    // Clear History Button
    byId('clear-history-btn')?.addEventListener('click', () => {
        if (confirm('Xóa tất cả lịch sử ván đấu?')) {
            window.gameHistory.clearHistory();
            window.gameHistory.renderHistoryModal();
        }
    });
});
