// ChargeIT Main JavaScript — Enhanced
document.addEventListener('DOMContentLoaded', function () {

    // ─── 1. DARK MODE ────────────────────────────────────────────────────────
    const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
    const currentTheme = localStorage.getItem('theme');

    if (toggleSwitch) {
        if (currentTheme) {
            document.documentElement.setAttribute('data-theme', currentTheme);
            toggleSwitch.checked = (currentTheme === 'dark');
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.setAttribute('data-theme', 'dark');
            toggleSwitch.checked = true;
        }
        toggleSwitch.addEventListener('change', function(e) {
            const theme = e.target.checked ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        });
    }

    // ─── 2. NAVBAR SCROLL EFFECT ─────────────────────────────────────────────
    const navbar = document.getElementById('mainNavbar');
    if (navbar) {
        let lastScroll = 0;
        window.addEventListener('scroll', function() {
            const curr = window.scrollY;
            if (curr > 60) {
                navbar.classList.add('navbar-scrolled');
            } else {
                navbar.classList.remove('navbar-scrolled');
            }
            lastScroll = curr;
        }, { passive: true });
    }

    // ─── 3. AOS INIT ─────────────────────────────────────────────────────────
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 700,
            easing: 'ease-out-cubic',
            once: true,
            offset: 60,
            delay: 0
        });
    }

    // ─── 4. GSAP ANIMATIONS ──────────────────────────────────────────────────
    if (typeof gsap !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // Stat card counters
        document.querySelectorAll('.stat-number[data-target]').forEach(el => {
            const target = parseInt(el.dataset.target, 10);
            if (isNaN(target)) return;
            gsap.from({ val: 0 }, {
                val: target,
                duration: 2,
                ease: 'power2.out',
                scrollTrigger: { trigger: el, start: 'top 85%', once: true },
                onUpdate: function() { el.textContent = Math.round(this.targets()[0].val) + '+'; }
            });
        });

        // Fade-in-up for section headers
        gsap.utils.toArray('.section-header').forEach(el => {
            gsap.from(el, {
                y: 30, opacity: 0, duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: { trigger: el, start: 'top 85%', once: true }
            });
        });
    }

    // ─── 5. TOOLTIPS ─────────────────────────────────────────────────────────
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => {
        new bootstrap.Tooltip(el);
    });

    // ─── 6. AUTO-DISMISS ALERTS ──────────────────────────────────────────────
    document.querySelectorAll('.alert').forEach(alert => {
        setTimeout(() => {
            try { bootstrap.Alert.getInstance(alert)?.close() || new bootstrap.Alert(alert).close(); }
            catch(e) { alert.remove(); }
        }, 5000);
    });

    // ─── 7. FAVORITE TOGGLE ──────────────────────────────────────────────────
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            toggleFavorite(this.dataset.stationId, this);
        });
    });

    // ─── 8. PRICE SUGGESTION FORM ────────────────────────────────────────────
    const priceForm = document.getElementById('priceForm');
    if (priceForm) {
        priceForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(this).entries());
            try {
                const res = await fetch('/stations/suggest-price', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();
                const modalEl = document.getElementById('priceModal');
                bootstrap.Modal.getInstance(modalEl)?.hide();
                showToast(result.success ? 'success' : 'error', result.message);
            } catch(err) {
                showToast('error', 'Failed to send suggestion.');
            }
        });
    }

    // ─── 9. CARD ENTRANCE ANIMATIONS ─────────────────────────────────────────
    if (typeof gsap !== 'undefined') {
        const cards = document.querySelectorAll('.station-card, .feature-card, .stat-card');
        cards.forEach((card, i) => {
            gsap.from(card, {
                y: 40,
                opacity: 0,
                duration: 0.6,
                delay: (i % 3) * 0.1,
                ease: 'power2.out',
                scrollTrigger: { trigger: card, start: 'top 90%', once: true }
            });
        });
    }

    // ─── 10. TOAST HELPER ────────────────────────────────────────────────────
    function showToast(type, message) {
        const existing = document.getElementById('chargeToast');
        if (existing) existing.remove();

        const colors = { success: '#00C36A', error: '#EF4444', info: '#3B82F6' };
        const icons = { success: 'check-circle', error: 'times-circle', info: 'info-circle' };

        const toast = document.createElement('div');
        toast.id = 'chargeToast';
        toast.style.cssText = `
            position:fixed;bottom:1.5rem;right:1.5rem;z-index:9999;
            background:var(--card-bg);border:1px solid var(--card-border);
            border-left:4px solid ${colors[type] || colors.info};
            border-radius:12px;padding:1rem 1.25rem;
            box-shadow:0 8px 24px rgba(0,0,0,0.25);
            display:flex;align-items:center;gap:0.75rem;
            font-size:0.875rem;max-width:340px;
            animation:toastIn 0.3s ease;
        `;
        toast.innerHTML = `
            <i class="fas fa-${icons[type] || icons.info}" style="color:${colors[type] || colors.info};font-size:1.1rem;flex-shrink:0;"></i>
            <span style="color:var(--body-text);flex:1;">${message}</span>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text-muted-color);cursor:pointer;font-size:1rem;line-height:1;padding:0;">&times;</button>
        `;

        if (!document.getElementById('toastStyle')) {
            const style = document.createElement('style');
            style.id = 'toastStyle';
            style.textContent = '@keyframes toastIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}';
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);
        setTimeout(() => { toast.style.animation = 'toastIn 0.3s ease reverse'; setTimeout(() => toast.remove(), 300); }, 4000);
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    async function toggleFavorite(stationId, button) {
        if (!button.dataset.authenticated) { window.location.href = '/auth/login'; return; }
        try {
            const res = await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stationId })
            });
            const result = await res.json();
            if (result.success) {
                const icon = button.querySelector('i');
                icon.className = result.isFavorite ? 'fas fa-heart' : 'far fa-heart';
                icon.style.color = result.isFavorite ? '#EF4444' : 'rgba(255,255,255,0.7)';
                const label = button.querySelector('span');
                if (label) label.textContent = result.isFavorite ? 'Saved' : 'Save';
                showToast('success', result.isFavorite ? 'Added to favorites!' : 'Removed from favorites.');
            } else if (result.message === 'Unauthorized') {
                window.location.href = '/auth/login';
            }
        } catch(e) { console.error('Favorite toggle failed:', e); }
    }

    window.ChargeIT = { showToast, toggleFavorite };
});
