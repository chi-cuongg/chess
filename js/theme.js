// ========================================
// Theme Switcher
// ========================================

class ThemeSwitcher {
    constructor() {
        this.currentTheme = 'harry-potter';
        this.themeSelector = document.getElementById('theme-selector');
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
        document.body.classList.remove('theme-harry-potter', 'theme-greek', 'theme-cyber');

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
        }
    }
}

// Initialize theme switcher when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.themeSwitcher = new ThemeSwitcher();
});
