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
        this.init();
    }

    init() {
        // Load saved theme
        const savedTheme = localStorage.getItem('chess-theme');
        if (savedTheme) {
            this.currentTheme = savedTheme;
            this.themeSelector.value = savedTheme;
        }

        this.applyTheme(this.currentTheme);

        // Listen for theme changes
        this.themeSelector.addEventListener('change', (e) => {
            this.changeTheme(e.target.value);
        });
    }

    changeTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('chess-theme', theme);
        this.applyTheme(theme);
    }

    applyTheme(theme) {
        // Remove all theme classes
        document.body.classList.remove('theme-harry-potter', 'theme-greek', 'theme-cyber', 'theme-vampire');

        // Add new theme class
        document.body.classList.add(`theme-${theme}`);

        // Update title based on theme
        const title = document.querySelector('.title');
        if (theme === 'harry-potter') {
            title.innerHTML = '⚡ Chess Master ⚡';
        } else if (theme === 'greek') {
            title.innerHTML = '🏛️ Σκάκι Olympus 🏛️';
        } else if (theme === 'cyber') {
            title.innerHTML = '🤖 CYBER_CHESS.exe 🤖';
        } else if (theme === 'vampire') {
            title.innerHTML = '🧛 Dracula Chess 🦇';
        }

        // Handle vampire theme bats
        if (theme === 'vampire') {
            this.startBats();
        } else {
            this.stopBats();
        }
    }

    // ========================================
    // Main Capture Effect Handler
    // ========================================
    showCaptureEffect(x, y) {
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
        // Create spell flash
        const flash = document.createElement('div');
        flash.className = 'magic-flash';
        flash.style.left = x + 'px';
        flash.style.top = y + 'px';
        document.body.appendChild(flash);

        // Create sparkles
        for (let i = 0; i < 12; i++) {
            const sparkle = document.createElement('div');
            sparkle.className = 'magic-sparkle';
            sparkle.innerHTML = '✨';
            sparkle.style.left = x + 'px';
            sparkle.style.top = y + 'px';
            sparkle.style.setProperty('--angle', (i * 30) + 'deg');
            sparkle.style.setProperty('--distance', (40 + Math.random() * 40) + 'px');
            document.body.appendChild(sparkle);
            setTimeout(() => sparkle.remove(), 800);
        }

        // Create wand trail text
        const spellText = document.createElement('div');
        spellText.className = 'spell-text';
        spellText.innerHTML = ['Expelliarmus!', 'Stupefy!', 'Petrificus!'][Math.floor(Math.random() * 3)];
        spellText.style.left = x + 'px';
        spellText.style.top = (y - 40) + 'px';
        document.body.appendChild(spellText);

        setTimeout(() => {
            flash.remove();
            spellText.remove();
        }, 1000);
    }

    // ========================================
    // Greek - Lightning Bolt Effect ⚡
    // ========================================
    showLightningBolt(x, y) {
        // Zeus lightning
        const lightning = document.createElement('div');
        lightning.className = 'zeus-lightning';
        lightning.innerHTML = '⚡';
        lightning.style.left = x + 'px';
        lightning.style.top = y + 'px';
        document.body.appendChild(lightning);

        // Thunder flash
        const thunderFlash = document.createElement('div');
        thunderFlash.className = 'thunder-flash';
        document.body.appendChild(thunderFlash);

        // Create marble debris
        for (let i = 0; i < 8; i++) {
            const debris = document.createElement('div');
            debris.className = 'marble-debris';
            debris.style.left = x + 'px';
            debris.style.top = y + 'px';
            debris.style.setProperty('--angle', (Math.random() * 360) + 'deg');
            debris.style.setProperty('--distance', (30 + Math.random() * 50) + 'px');
            document.body.appendChild(debris);
            setTimeout(() => debris.remove(), 800);
        }

        // Greek text
        const greekText = document.createElement('div');
        greekText.className = 'greek-text';
        greekText.innerHTML = ['ΝΙΚΗ!', 'ΘΑΝΑΤΟΣ!', 'ΚΡΑΤΑΙΟΣ!'][Math.floor(Math.random() * 3)];
        greekText.style.left = x + 'px';
        greekText.style.top = (y - 50) + 'px';
        document.body.appendChild(greekText);

        setTimeout(() => {
            lightning.remove();
            thunderFlash.remove();
            greekText.remove();
        }, 800);
    }

    // ========================================
    // Cyber Tech - Glitch Effect 🤖
    // ========================================
    showGlitchEffect(x, y) {
        // Glitch box
        const glitch = document.createElement('div');
        glitch.className = 'cyber-glitch';
        glitch.style.left = x + 'px';
        glitch.style.top = y + 'px';
        document.body.appendChild(glitch);

        // Digital particles
        for (let i = 0; i < 10; i++) {
            const particle = document.createElement('div');
            particle.className = 'digital-particle';
            particle.innerHTML = ['0', '1', '█', '▓', '▒'][Math.floor(Math.random() * 5)];
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.setProperty('--angle', (Math.random() * 360) + 'deg');
            particle.style.setProperty('--distance', (40 + Math.random() * 60) + 'px');
            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), 600);
        }

        // Error text
        const errorText = document.createElement('div');
        errorText.className = 'cyber-text';
        errorText.innerHTML = ['DELETED', 'TERMINATED', 'ELIMINATED'][Math.floor(Math.random() * 3)];
        errorText.style.left = x + 'px';
        errorText.style.top = (y - 40) + 'px';
        document.body.appendChild(errorText);

        // Screen glitch overlay
        const screenGlitch = document.createElement('div');
        screenGlitch.className = 'screen-glitch';
        document.body.appendChild(screenGlitch);

        setTimeout(() => {
            glitch.remove();
            errorText.remove();
            screenGlitch.remove();
        }, 500);
    }

    // ========================================
    // Vampire Theme - Flying Bats
    // ========================================
    startBats() {
        if (this.batsInterval) return;

        for (let i = 0; i < 5; i++) {
            setTimeout(() => this.createBat(), i * 800);
        }

        this.batsInterval = setInterval(() => {
            if (this.activeBats.length < 8) {
                this.createBat();
            }
        }, 2000);
    }

    stopBats() {
        if (this.batsInterval) {
            clearInterval(this.batsInterval);
            this.batsInterval = null;
        }
        this.activeBats.forEach(bat => bat.remove());
        this.activeBats = [];
    }

    createBat() {
        const bat = document.createElement('div');
        bat.className = 'flying-bat';
        bat.innerHTML = '🦇';

        const startX = Math.random() * window.innerWidth;
        bat.style.left = startX + 'px';
        bat.style.top = '-50px';

        const duration = 8 + Math.random() * 6;
        const endX = Math.random() * window.innerWidth;
        const amplitude = 100 + Math.random() * 150;

        bat.style.setProperty('--end-x', endX + 'px');
        bat.style.setProperty('--amplitude', amplitude + 'px');
        bat.style.setProperty('--duration', duration + 's');

        this.batsContainer.appendChild(bat);
        this.activeBats.push(bat);

        setTimeout(() => {
            bat.remove();
            this.activeBats = this.activeBats.filter(b => b !== bat);
        }, duration * 1000);
    }

    // ========================================
    // Vampire Theme - Blood & Bite Effect
    // ========================================
    showVampireBite(x, y) {
        const bite = document.createElement('div');
        bite.className = 'vampire-bite';
        bite.innerHTML = '🧛';
        bite.style.left = x + 'px';
        bite.style.top = y + 'px';
        document.body.appendChild(bite);

        setTimeout(() => this.createBloodSplatter(x, y), 300);
        setTimeout(() => bite.remove(), 800);
    }

    createBloodSplatter(x, y) {
        const bloodPool = document.createElement('div');
        bloodPool.className = 'blood-pool';
        bloodPool.style.left = x + 'px';
        bloodPool.style.top = y + 'px';
        this.bloodContainer.appendChild(bloodPool);

        for (let i = 0; i < 6; i++) {
            const drop = document.createElement('div');
            drop.className = 'blood-drop';
            drop.style.left = x + 'px';
            drop.style.top = y + 'px';
            drop.style.setProperty('--angle', (Math.random() * 360) + 'deg');
            drop.style.setProperty('--distance', (30 + Math.random() * 50) + 'px');
            this.bloodContainer.appendChild(drop);
            setTimeout(() => drop.remove(), 1000);
        }

        setTimeout(() => {
            bloodPool.classList.add('fading');
            setTimeout(() => bloodPool.remove(), 2000);
        }, 1500);
    }
}

// ========================================
// Hook into game to detect captures
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    window.themeSwitcher = new ThemeSwitcher();

    // Wait for game to initialize
    setTimeout(() => {
        if (window.chessGame) {
            const game = window.chessGame;
            const originalRenderBoard = game.renderBoard.bind(game);

            let lastBoardState = null;

            game.renderBoard = function () {
                const currentBoard = this.board;

                // Check for captures
                if (lastBoardState) {
                    for (let row = 0; row < 8; row++) {
                        for (let col = 0; col < 8; col++) {
                            const wasPiece = lastBoardState[row][col];
                            const isPiece = currentBoard[row][col];

                            // A capture occurred
                            if (wasPiece && isPiece && wasPiece !== isPiece) {
                                const squares = document.querySelectorAll('.square');
                                const squareIndex = row * 8 + col;
                                const square = squares[squareIndex];
                                if (square) {
                                    const rect = square.getBoundingClientRect();
                                    window.themeSwitcher.showCaptureEffect(
                                        rect.left + rect.width / 2,
                                        rect.top + rect.height / 2
                                    );
                                }
                            }
                        }
                    }
                }

                lastBoardState = currentBoard.map(row => [...row]);
                originalRenderBoard();
            };
        }
    }, 500);
});
