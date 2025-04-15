document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const body = document.body;

    // Check for saved dark mode preference
    if (localStorage.getItem('darkMode') === 'enabled') {
        body.classList.add('dark-mode');
        if (darkModeToggle) {
            darkModeToggle.checked = true;
        }
    }

    // Add event listener for the toggle
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
            } else {
                body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }

    // Add similar logic for toggles on other pages if they exist
    const gameToggle = document.getElementById('dark-mode-toggle-game');
    if (gameToggle) {
        if (localStorage.getItem('darkMode') === 'enabled') gameToggle.checked = true;
        gameToggle.addEventListener('change', () => {
            if (gameToggle.checked) {
                body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
            } else {
                body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }

    const adminToggle = document.getElementById('dark-mode-toggle-admin');
    if (adminToggle) {
        if (localStorage.getItem('darkMode') === 'enabled') adminToggle.checked = true;
        adminToggle.addEventListener('change', () => {
            if (adminToggle.checked) {
                body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
            } else {
                body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }

    const fffToggle = document.getElementById('dark-mode-toggle-fff');
    if (fffToggle) {
        if (localStorage.getItem('darkMode') === 'enabled') fffToggle.checked = true;
        fffToggle.addEventListener('change', () => {
            if (fffToggle.checked) {
                body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
            } else {
                body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }

    const pollToggle = document.getElementById('dark-mode-toggle-poll');
    if (pollToggle) {
        if (localStorage.getItem('darkMode') === 'enabled') pollToggle.checked = true;
        pollToggle.addEventListener('change', () => {
            if (pollToggle.checked) {
                body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
            } else {
                body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }

    const mobileToggle = document.getElementById('dark-mode-toggle-mobile');
    if (mobileToggle) {
        if (localStorage.getItem('darkMode') === 'enabled') mobileToggle.checked = true;
        mobileToggle.addEventListener('change', () => {
            if (mobileToggle.checked) {
                body.classList.add('dark-mode');
                localStorage.setItem('darkMode', 'enabled');
            } else {
                body.classList.remove('dark-mode');
                localStorage.setItem('darkMode', 'disabled');
            }
        });
    }

    // Placeholder for KBC logo - replace with actual path or handle missing image
    const logo = document.getElementById('kbc-logo');
    if (logo && !logo.src.includes('img/kbc-logo.png')) {
        // If the src is not set or incorrect, maybe set a default or hide it
        // For now, we assume the path is correct but the file might be missing
        logo.onerror = () => {
            console.warn('KBC logo image not found at img/kbc-logo.png');
            // Optionally hide the image or show a placeholder
            // logo.style.display = 'none'; 
        };
    }
});
