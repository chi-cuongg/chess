// ========================================
// Theme Switcher with Special Effects
// ========================================

class ThemeSwitcher {
    constructor() {
        this.currentTheme = 'harry-potter';
        this.themeSelector = document.getElementById('theme-selector');
        this.batsContainer = document.getElementById('bats-container');
        this.bloodContainer = document.getElementById('blood-container');
        this.batsInterval = null;
        this.activeBats = [];
        this.batTimeouts = [];

        // Effect toggle & particle management
        this.effectsEnabled = true;
        this.effectsToggleBtn = null;
        this.activeParticles = [];
        this.maxParticles = 20;
        this.effectTimers = [];

        this.init();
    }

    init() {
        // Load saved theme
        let savedTheme = null;
        try {
            savedTheme = localStorage.getItem('chess-theme');
        } catch (e) { /* storage error */ }
        if (savedTheme) {
            this.currentTheme = savedTheme;
            if (this.themeSelector) this.themeSelector.value = savedTheme;
        }

        this.initEffectsToggle();
        this.applyTheme(this.currentTheme);

        // Listen for theme changes
        if (this.themeSelector) {
            this.themeSelector.addEventListener('change', (e) => {
                this.changeTheme(e.target.value);
            });
        }

        // Visibility listener to halt timers and background work when tab is hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.stopBats();
                this.clearActiveParticles();
            } else if (this.effectsEnabled && this.currentTheme === 'vampire') {
                this.startBats();
            }
        });

        // Reduced motion preference listener
        if (typeof window !== 'undefined' && window.matchMedia) {
            const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
            if (mql.addEventListener) {
                mql.addEventListener('change', (e) => {
                    if (e.matches) {
                        this.stopBats();
                        this.clearActiveParticles();
                    } else if (this.effectsEnabled && this.currentTheme === 'vampire' && !document.hidden) {
                        this.startBats();
                    }
                });
            }
        }
    }

    initEffectsToggle() {
        this.effectsToggleBtn = document.getElementById('toggle-effects-btn');
        let saved = null;
        try {
            saved = localStorage.getItem('chess-effects');
        } catch (e) { /* storage error */ }
        this.effectsEnabled = saved !== 'false';

        this.applyEffectsState();

        if (this.effectsToggleBtn) {
            this.effectsToggleBtn.addEventListener('click', () => {
                this.setEffectsEnabled(!this.effectsEnabled);
            });
        }
    }

    setEffectsEnabled(enabled) {
        this.effectsEnabled = !!enabled;
        try {
            localStorage.setItem('chess-effects', String(this.effectsEnabled));
        } catch (e) { /* storage error */ }
        this.applyEffectsState();
    }

    applyEffectsState() {
        document.body.classList.toggle('effects-disabled', !this.effectsEnabled);
        if (this.effectsToggleBtn) {
            this.effectsToggleBtn.textContent = this.effectsEnabled ? '✨ Hiệu ứng: Bật' : '✨ Hiệu ứng: Tắt';
            this.effectsToggleBtn.setAttribute('aria-pressed', String(this.effectsEnabled));
            this.effectsToggleBtn.title = this.effectsEnabled ? 'Nhấn để tắt hiệu ứng động' : 'Nhấn để bật hiệu ứng động';
        }
        if (!this.effectsEnabled) {
            this.stopBats();
            this.clearActiveParticles();
        } else if (this.currentTheme === 'vampire' && !document.hidden) {
            this.startBats();
        }
    }

    changeTheme(theme) {
        this.currentTheme = theme;
        try {
            localStorage.setItem('chess-theme', theme);
        } catch (e) { /* storage error */ }
        this.applyTheme(theme);
    }

    resetEffects() {
        this.stopBats();
        this.clearActiveParticles();
    }

    applyTheme(theme) {
        // Clear previous theme's particles & timers
        this.resetEffects();

        // Remove all theme classes
        document.body.classList.remove('theme-harry-potter', 'theme-greek', 'theme-cyber', 'theme-vampire');

        // Add new theme class
        document.body.classList.add(`theme-${theme}`);

        // The banner describes the theme and applies to all three board games.
        const title = document.querySelector('.title');
        const banners = {
            'harry-potter': '⚡ Bàn cờ phép thuật ⚡',
            greek: '🏛️ Đấu trường Olympus 🏛️',
            cyber: '🤖 CYBER_BOARD.exe 🤖',
            vampire: '🧛 Bàn cờ bóng đêm 🦇'
        };
        if (title) title.textContent = banners[theme] || 'Bàn cờ Việt';

        // Handle vampire theme bats
        if (theme === 'vampire' && this.effectsEnabled && !document.hidden) {
            this.startBats();
        } else {
            this.stopBats();
        }
    }

    // ========================================
    // Particle Management (Pool/Cap at max 20)
    // ========================================
    spawnParticle(element, parent, durationMs) {
        if (!this.effectsEnabled || document.hidden) return null;
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return null;
        }

        // Enforce maximum concurrent active particles
        while (this.activeParticles.length >= this.maxParticles) {
            const oldest = this.activeParticles.shift();
            if (oldest) {
                if (oldest._cleanupTimer) clearTimeout(oldest._cleanupTimer);
                if (oldest.parentNode) oldest.remove();
            }
        }

        parent.appendChild(element);
        this.activeParticles.push(element);

        element._cleanupTimer = setTimeout(() => {
            this.removeParticle(element);
        }, durationMs);

        return element;
    }

    removeParticle(element) {
        if (!element) return;
        if (element._cleanupTimer) {
            clearTimeout(element._cleanupTimer);
            element._cleanupTimer = null;
        }
        const idx = this.activeParticles.indexOf(element);
        if (idx !== -1) {
            this.activeParticles.splice(idx, 1);
        }
        if (element.parentNode) {
            element.remove();
        }
    }

    clearActiveParticles() {
        for (const tid of this.effectTimers) clearTimeout(tid);
        this.effectTimers = [];

        while (this.activeParticles.length > 0) {
            const el = this.activeParticles.pop();
            if (el) {
                if (el._cleanupTimer) clearTimeout(el._cleanupTimer);
                if (el.parentNode) el.remove();
            }
        }
    }

    // ========================================
    // Show the current theme's effect centred on a board square
    // ========================================
    showEffectAtSquare(row, col) {
        if (!this.effectsEnabled || document.hidden || row === undefined || col === undefined) return;
        const square = document.querySelector(`.chessboard .square[data-row="${row}"][data-col="${col}"]`);
        if (!square) return;
        const rect = square.getBoundingClientRect();
        this.showCaptureEffect(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    // ========================================
    // Main Capture Effect Handler
    // ========================================
    showCaptureEffect(x, y) {
        if (!this.effectsEnabled || document.hidden) return;
        switch (this.currentTheme) {
            case 'harry-potter':
                this.showMagicSpell(x, y);
                break;
            case 'greek':
                this.showLightningBolt(x, y);
                break;
            case 'cyber':
                this.showGlitchEffect(x, y);
                break;
            case 'vampire':
                this.showVampireBite(x, y);
                break;
        }
    }

    // ========================================
    // Harry Potter - Magic Spell Effect ⚡
    // ========================================
    showMagicSpell(x, y) {
        if (!this.effectsEnabled || document.hidden) return;

        // Create spell flash
        const flash = document.createElement('div');
        flash.className = 'magic-flash';
        flash.style.left = x + 'px';
        flash.style.top = y + 'px';
        this.spawnParticle(flash, document.body, 600);

        // Create sparkles (capped to 6 particles)
        for (let i = 0; i < 6; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'magic-sparkle';
            sparkle.innerHTML = '✨';
            sparkle.style.left = x + 'px';
            sparkle.style.top = y + 'px';
            sparkle.style.setProperty('--angle', (i * 60) + 'deg');
            sparkle.style.setProperty('--distance', (30 + Math.random() * 30) + 'px');
            this.spawnParticle(sparkle, document.body, 800);
        }

        // Create wand trail text
        const spellText = document.createElement('div');
        spellText.className = 'spell-text';
        spellText.innerHTML = ['Expelliarmus!', 'Stupefy!', 'Petrificus!'][Math.floor(Math.random() * 3)];
        spellText.style.left = x + 'px';
        spellText.style.top = (y - 40) + 'px';
        this.spawnParticle(spellText, document.body, 900);
    }

    // ========================================
    // Greek - Lightning Bolt Effect ⚡
    // ========================================
    showLightningBolt(x, y) {
        if (!this.effectsEnabled || document.hidden) return;

        // Zeus lightning
        const lightning = document.createElement('div');
        lightning.className = 'zeus-lightning';
        lightning.innerHTML = '⚡';
        lightning.style.left = x + 'px';
        lightning.style.top = y + 'px';
        this.spawnParticle(lightning, document.body, 500);

        // Thunder flash
        const thunderFlash = document.createElement('div');
        thunderFlash.className = 'thunder-flash';
        this.spawnParticle(thunderFlash, document.body, 300);

        // Create marble debris (capped to 5 particles)
        for (let i = 0; i < 5; i++) {
            const debris = document.createElement('div');
            debris.className = 'marble-debris';
            debris.style.left = x + 'px';
            debris.style.top = y + 'px';
            debris.style.setProperty('--angle', (Math.random() * 360) + 'deg');
            debris.style.setProperty('--distance', (25 + Math.random() * 35) + 'px');
            this.spawnParticle(debris, document.body, 700);
        }

        // Greek text
        const greekText = document.createElement('div');
        greekText.className = 'greek-text';
        greekText.innerHTML = ['ΝΙΚΗ!', 'ΘΑΝΑΤΟΣ!', 'ΚΡΑΤΑΙΟΣ!'][Math.floor(Math.random() * 3)];
        greekText.style.left = x + 'px';
        greekText.style.top = (y - 50) + 'px';
        this.spawnParticle(greekText, document.body, 800);
    }

    // ========================================
    // Cyber Tech - Glitch Effect 🤖
    // ========================================
    showGlitchEffect(x, y) {
        if (!this.effectsEnabled || document.hidden) return;

        // Glitch box
        const glitch = document.createElement('div');
        glitch.className = 'cyber-glitch';
        glitch.style.left = x + 'px';
        glitch.style.top = y + 'px';
        this.spawnParticle(glitch, document.body, 500);

        // Digital particles (capped to 5 particles)
        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.className = 'digital-particle';
            particle.innerHTML = ['0', '1', '█', '▓', '▒'][Math.floor(Math.random() * 5)];
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.setProperty('--angle', (Math.random() * 360) + 'deg');
            particle.style.setProperty('--distance', (30 + Math.random() * 40) + 'px');
            this.spawnParticle(particle, document.body, 500);
        }

        // Error text
        const errorText = document.createElement('div');
        errorText.className = 'cyber-text';
        errorText.innerHTML = ['DELETED', 'TERMINATED', 'ELIMINATED'][Math.floor(Math.random() * 3)];
        errorText.style.left = x + 'px';
        errorText.style.top = (y - 40) + 'px';
        this.spawnParticle(errorText, document.body, 500);

        // Screen glitch overlay
        const screenGlitch = document.createElement('div');
        screenGlitch.className = 'screen-glitch';
        this.spawnParticle(screenGlitch, document.body, 300);
    }

    // ========================================
    // Vampire Theme - Flying Bats
    // ========================================
    startBats() {
        if (!this.effectsEnabled || document.hidden || !this.batsContainer) return;
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }
        if (this.batsInterval) return;

        this.stopBats();

        for (let i = 0; i < 2; i++) {
            const tid = setTimeout(() => {
                if (this.batsInterval) this.createBat();
            }, i * 1200);
            this.batTimeouts.push(tid);
        }

        this.batsInterval = setInterval(() => {
            if (document.hidden || !this.effectsEnabled) {
                this.stopBats();
                return;
            }
            if (this.activeBats.length < 4) {
                this.createBat();
            }
        }, 3000);
    }

    stopBats() {
        if (this.batsInterval) {
            clearInterval(this.batsInterval);
            this.batsInterval = null;
        }
        if (this.batTimeouts) {
            for (const tid of this.batTimeouts) clearTimeout(tid);
            this.batTimeouts = [];
        }
        if (this.activeBats) {
            for (const bat of this.activeBats) {
                if (bat._cleanupTimer) clearTimeout(bat._cleanupTimer);
                if (bat.parentNode) bat.remove();
            }
            this.activeBats = [];
        }
    }

    createBat() {
        if (!this.effectsEnabled || document.hidden || !this.batsContainer) return;
        if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        const bat = document.createElement('div');
        bat.className = 'flying-bat';
        bat.innerHTML = '🦇';

        const startX = Math.random() * window.innerWidth;
        bat.style.left = startX + 'px';
        bat.style.top = '-50px';

        const duration = 7 + Math.random() * 4;
        const endX = Math.random() * window.innerWidth;
        const amplitude = 60 + Math.random() * 80;

        bat.style.setProperty('--end-x', endX + 'px');
        bat.style.setProperty('--amplitude', amplitude + 'px');
        bat.style.setProperty('--duration', duration + 's');

        this.batsContainer.appendChild(bat);
        this.activeBats.push(bat);

        bat._cleanupTimer = setTimeout(() => {
            if (bat.parentNode) bat.remove();
            this.activeBats = this.activeBats.filter(b => b !== bat);
        }, duration * 1000);
    }

    // ========================================
    // Vampire Theme - Blood & Bite Effect
    // ========================================
    showVampireBite(x, y) {
        if (!this.effectsEnabled || document.hidden) return;

        const bite = document.createElement('div');
        bite.className = 'vampire-bite';
        bite.innerHTML = '🧛';
        bite.style.left = x + 'px';
        bite.style.top = y + 'px';
        this.spawnParticle(bite, document.body, 800);

        const tid = setTimeout(() => this.createBloodSplatter(x, y), 300);
        this.effectTimers.push(tid);
    }

    createBloodSplatter(x, y) {
        if (!this.effectsEnabled || document.hidden || !this.bloodContainer) return;

        const bloodPool = document.createElement('div');
        bloodPool.className = 'blood-pool';
        bloodPool.style.left = x + 'px';
        bloodPool.style.top = y + 'px';
        this.spawnParticle(bloodPool, this.bloodContainer, 1500);

        for (let i = 0; i < 4; i++) {
            const drop = document.createElement('div');
            drop.className = 'blood-drop';
            drop.style.left = x + 'px';
            drop.style.top = y + 'px';
            drop.style.setProperty('--angle', (Math.random() * 360) + 'deg');
            drop.style.setProperty('--distance', (20 + Math.random() * 30) + 'px');
            this.spawnParticle(drop, this.bloodContainer, 800);
        }
    }
}

// ========================================
// Hook into the game to detect real captures
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    window.themeSwitcher = new ThemeSwitcher();

    const game = window.chessGame;
    if (!game) return;

    // Show the capture effect only when a capture actually happens, by hooking
    // the move methods instead of diffing boards (which produced false
    // positives on new game / undo).
    const originalMakeMove = game.makeMove.bind(game);
    game.makeMove = function (fromRow, fromCol, toRow, toCol, move) {
        const target = this.board[toRow][toCol];
        const result = originalMakeMove(fromRow, fromCol, toRow, toCol, move);
        const isEnPassant = move && move.type === 'enpassant';
        const isPromotion = move && move.type === 'promotion';
        if (!this.isReplaying && !isPromotion && (target || isEnPassant)) {
            window.themeSwitcher.showEffectAtSquare(toRow, toCol);
        }
        return result;
    };

    const originalCompletePromotion = game.completePromotion.bind(game);
    game.completePromotion = function (promoteTo) {
        const pending = this.pendingPromotion;
        const captured = pending ? this.board[pending.toRow][pending.toCol] : null;
        const row = pending ? pending.toRow : 0;
        const col = pending ? pending.toCol : 0;
        const result = originalCompletePromotion(promoteTo);
        if (!this.isReplaying && captured) {
            window.themeSwitcher.showEffectAtSquare(row, col);
        }
        return result;
    };
});
