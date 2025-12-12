// ChargeIT Main JavaScript
document.addEventListener('DOMContentLoaded', function () {

    // 1. DARK MODE TOGGLE LOGIC
    const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
    const currentTheme = localStorage.getItem('theme');

    if (toggleSwitch) {
        // A. Set initial state based on storage or system preference
        if (currentTheme) {
            document.documentElement.setAttribute('data-theme', currentTheme);
            if (currentTheme === 'dark') {
                toggleSwitch.checked = true;
            }
        } else {
            // Fallback: Check system preference if no theme saved
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.setAttribute('data-theme', 'dark');
                toggleSwitch.checked = true;
            }
        }

        // B. Handle Switch Change Event
        toggleSwitch.addEventListener('change', function (e) {
            if (e.target.checked) {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
            }
        });
    }

    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Auto-dismiss alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        }, 5000);
    });

    // Favorite station functionality
    const favoriteButtons = document.querySelectorAll('.favorite-btn');
    favoriteButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const stationId = this.dataset.stationId;
            toggleFavorite(stationId, this);
        });
    });

    // Search form enhancements
    const searchForm = document.querySelector('form[action="/stations/search"]');
    if (searchForm) {
        searchForm.addEventListener('submit', function (e) {
            const inputs = this.querySelectorAll('input, select');
            let hasValue = false;

            inputs.forEach(input => {
                if (input.value.trim() !== '') {
                    hasValue = true;
                }
            });

            if (!hasValue) {
                e.preventDefault();
                alert('Please enter at least one search criteria.');
            }
        });
    }

    const priceForm = document.getElementById('priceForm');
    if (priceForm) {
        priceForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            try {
                const res = await fetch('/stations/suggest-price', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                const result = await res.json();

                // Hide Modal using Bootstrap API
                const modalEl = document.getElementById('priceModal');
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();

                if (result.success) {
                    alert(result.message);
                } else {
                    alert('Error: ' + result.message);
                }
            } catch (err) {
                console.error(err);
                alert('Failed to send suggestion.');
            }
        });
    }

    // 4. HELPER FUNCTIONS

    // Rating display helper
    function displayRating(rating, element) {
        element.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('i');
            star.className = i <= rating ? 'fas fa-star text-warning' : 'far fa-star text-warning';
            element.appendChild(star);
        }
    }

    // Toggle favorite station
    async function toggleFavorite(stationId, button) {
        if (!button.dataset.authenticated) {
            window.location.href = '/auth/login';
            return;
        }

        try {
            const response = await fetch('/api/favorites', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ stationId })
            });

            const result = await response.json();

            if (result.success) {
                const icon = button.querySelector('i');
                if (result.isFavorite) {
                    icon.className = 'fas fa-heart text-danger me-1';
                } else {
                    icon.className = 'far fa-heart me-1';
                }
            } else {
                if (result.message === 'Unauthorized') {
                    window.location.href = '/auth/login';
                } else {
                    console.error('Failed to toggle favorite:', result.message);
                }
            }
        } catch (error) {
            console.error('Error toggling favorite:', error);
        }
    }

    // Distance calculator
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Export functions to global scope
    window.ChargeIT = {
        calculateDistance,
        displayRating,
        toggleFavorite
    };
});