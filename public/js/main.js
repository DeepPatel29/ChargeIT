// ChargeIT Main JavaScript
document.addEventListener('DOMContentLoaded', function () {
    // Initialize tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    const tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
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
                    icon.className = 'fas fa-heart text-danger';
                    button.setAttribute('data-bs-title', 'Remove from favorites');
                } else {
                    icon.className = 'far fa-heart';
                    button.setAttribute('data-bs-title', 'Add to favorites');
                }

                // Update tooltip
                const tooltip = bootstrap.Tooltip.getInstance(button);
                if (tooltip) {
                    tooltip.hide();
                    tooltip.dispose();
                    new bootstrap.Tooltip(button);
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

    // Export functions to global scope for use in templates
    window.ChargeIT = {
        calculateDistance,
        displayRating,
        toggleFavorite
    };
});