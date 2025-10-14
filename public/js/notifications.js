// ==================== CUSTOM NOTIFICATION SYSTEM ====================

// Create notification container if it doesn't exist
function initNotificationContainer() {
    if (!document.getElementById('notification-container')) {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
}

// Show notification
function showNotification(message, type = 'info', duration = 5000) {
    initNotificationContainer();

    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type} slide-in`;

    // Icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        loading: '⏳'
    };

    const icon = icons[type] || icons.info;

    notification.innerHTML = `
        <div class="notification-icon">${icon}</div>
        <div class="notification-content">
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="closeNotification(this)">&times;</button>
    `;

    container.appendChild(notification);

    // Auto remove after duration (unless it's loading)
    if (type !== 'loading' && duration > 0) {
        setTimeout(() => {
            removeNotification(notification);
        }, duration);
    }

    return notification;
}

// Close notification
function closeNotification(button) {
    const notification = button.closest('.custom-notification');
    removeNotification(notification);
}

// Remove notification with animation
function removeNotification(notification) {
    if (!notification) return;

    notification.classList.add('slide-out');
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 300);
}

// Show modal dialog (for confirmations)
function showModal(title, message, buttons = []) {
    return new Promise((resolve) => {
        // Remove existing modal if any
        const existingModal = document.getElementById('custom-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'custom-modal';
        modal.className = 'custom-modal-overlay';

        // Build buttons HTML
        const buttonsHTML = buttons.map((btn, index) => {
            const className = btn.type || (index === 0 ? 'primary' : 'secondary');
            return `<button class="modal-btn modal-btn-${className}" data-action="${btn.action || index}">${btn.text}</button>`;
        }).join('');

        modal.innerHTML = `
            <div class="custom-modal-content">
                <div class="custom-modal-header">
                    <h3>${title}</h3>
                    <button class="custom-modal-close" data-action="close">&times;</button>
                </div>
                <div class="custom-modal-body">
                    <p>${message}</p>
                </div>
                <div class="custom-modal-footer">
                    ${buttonsHTML}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add click handlers
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('custom-modal-overlay')) {
                modal.remove();
                resolve(false);
            }

            const action = e.target.getAttribute('data-action');
            if (action !== null) {
                modal.remove();
                resolve(action === 'close' ? false : action);
            }
        });

        // Show modal with animation
        setTimeout(() => modal.classList.add('show'), 10);
    });
}

// Confirm dialog
function confirmDialog(message, title = 'Confirm Action') {
    return showModal(title, message, [
        { text: 'Cancel', action: 'cancel', type: 'secondary' },
        { text: 'Confirm', action: 'confirm', type: 'primary' }
    ]);
}

// Show success notification
function showSuccess(message, duration = 4000) {
    return showNotification(message, 'success', duration);
}

// Show error notification
function showError(message, duration = 6000) {
    return showNotification(message, 'error', duration);
}

// Show warning notification
function showWarning(message, duration = 5000) {
    return showNotification(message, 'warning', duration);
}

// Show info notification
function showInfo(message, duration = 4000) {
    return showNotification(message, 'info', duration);
}

// Show loading notification (doesn't auto-close)
function showLoading(message) {
    return showNotification(message, 'loading', 0);
}

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNotificationContainer);
} else {
    initNotificationContainer();
}