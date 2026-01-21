// ========================================
// Chat Manager - In-Game Chat via P2P
// ========================================

class ChatManager {
    constructor(onlineManager) {
        this.onlineManager = onlineManager;
        this.messages = [];
        this.maxMessages = 50;

        this.chatContainer = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('chat-send-btn');

        this.init();
    }

    init() {
        if (this.sendBtn) {
            this.sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (this.chatInput) {
            this.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }
    }

    // ========================================
    // Send Message
    // ========================================
    sendMessage() {
        const text = this.chatInput.value.trim();
        if (!text) return;

        const playerName = this.onlineManager.playerName || 'Bạn';

        // Add to local chat
        this.addMessage(text, playerName, true);

        // Send to opponent
        this.onlineManager.send({
            type: 'chat',
            message: text
        });

        // Clear input
        this.chatInput.value = '';
    }

    // ========================================
    // Receive Message
    // ========================================
    receiveMessage(text, senderName) {
        this.addMessage(text, senderName, false);
    }

    // ========================================
    // Add Message to Chat
    // ========================================
    addMessage(text, sender, isOwn) {
        const message = {
            text,
            sender,
            isOwn,
            time: new Date()
        };

        this.messages.push(message);

        // Limit messages
        if (this.messages.length > this.maxMessages) {
            this.messages.shift();
        }

        this.renderMessage(message);
    }

    // ========================================
    // Render Message
    // ========================================
    renderMessage(message) {
        if (!this.chatContainer) return;

        const msgEl = document.createElement('div');
        msgEl.className = `chat-message ${message.isOwn ? 'own' : 'opponent'}`;

        const time = message.time.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        msgEl.innerHTML = `
            <div class="chat-sender">${message.sender}</div>
            <div class="chat-text">${this.escapeHtml(message.text)}</div>
            <div class="chat-time">${time}</div>
        `;

        this.chatContainer.appendChild(msgEl);

        // Scroll to bottom
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    // ========================================
    // Add System Message
    // ========================================
    addSystemMessage(text) {
        if (!this.chatContainer) return;

        const msgEl = document.createElement('div');
        msgEl.className = 'chat-message system';
        msgEl.innerHTML = `<div class="chat-text">${text}</div>`;

        this.chatContainer.appendChild(msgEl);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    // ========================================
    // Escape HTML
    // ========================================
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================
    // Clear Chat
    // ========================================
    clear() {
        this.messages = [];
        if (this.chatContainer) {
            this.chatContainer.innerHTML = '';
        }
    }
}

// Export for global access
window.ChatManager = ChatManager;
