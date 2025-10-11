let authToken = null;
let refreshInterval = null;

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    authToken = localStorage.getItem('adminToken');

    if (authToken) {
        showDashboard();
    } else {
        showLogin();
    }
});

// Show/Hide sections
function showLogin() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('dashboard-section').classList.add('hidden');
}

function showDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');

    loadSettings();
    loadStatistics();
    loadPayments();

    // Auto-refresh payments and statistics every 10 seconds
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
        loadStatistics();
        loadPayments();
    }, 10000);
}

// Show error message
function showError(message, elementId = 'login-error') {
    const errorDiv = document.getElementById(elementId);
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');

    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const successDiv = document.getElementById('dashboard-success');
    successDiv.textContent = message;
    successDiv.classList.remove('hidden');

    setTimeout(() => {
        successDiv.classList.add('hidden');
    }, 3000);
}

// Handle login
document.getElementById('login-form').addEventListener('submit', async(e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Login failed');
        }

        authToken = data.token;
        localStorage.setItem('adminToken', authToken);

        showDashboard();
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Login failed. Please try again.');
    }
});

// Load settings
async function loadSettings() {
    try {
        const response = await fetch('/api/settings', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to load settings');
        }

        // Remove .00 if it's a whole number
        const price = parseFloat(data.settings.price);
        document.getElementById('price').value = price % 1 === 0 ? parseInt(price) : price;
        document.getElementById('isActive').value = data.settings.isActive.toString();

        // Load price options
        window.priceOptionsData = [];
        if (data.settings.priceOptions) {
            try {
                window.priceOptionsData = JSON.parse(data.settings.priceOptions);
                renderPriceOptions();
            } catch (e) {
                console.error('Error parsing price options:', e);
            }
        }

    } catch (error) {
        console.error('Load settings error:', error);
        showError(error.message || 'Failed to load settings', 'dashboard-error');
    }
}

// Add price option
function addPriceOption() {
    window.priceOptionsData = window.priceOptionsData || [];
    window.priceOptionsData.push({ label: '', amount: 0 });
    renderPriceOptions();
}

// Remove price option
function removePriceOption(index) {
    window.priceOptionsData.splice(index, 1);
    renderPriceOptions();
}

// Render price options
function renderPriceOptions() {
    const container = document.getElementById('price-options-container');
    if (!window.priceOptionsData || window.priceOptionsData.length === 0) {
        container.innerHTML = '<p style="color: #666; font-size: 14px; margin: 0;">No price options added. Add options for users to choose from.</p>';
        return;
    }

    container.innerHTML = window.priceOptionsData.map((option, index) => `
        <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
            <input type="text" placeholder="Label (e.g., Regular, VIP)" value="${escapeHtml(option.label || '')}" 
                onchange="window.priceOptionsData[${index}].label = this.value" 
                style="flex: 1; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
            <input type="number" placeholder="Amount" value="${option.amount || 0}" step="0.01" min="0"
                onchange="window.priceOptionsData[${index}].amount = parseFloat(this.value)" 
                style="width: 120px; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
            <button type="button" class="btn btn-danger btn-small" onclick="removePriceOption(${index})" title="Remove">✕</button>
        </div>
    `).join('');
}

// Handle settings form submission
document.getElementById('settings-form').addEventListener('submit', async(e) => {
    e.preventDefault();

    const price = document.getElementById('price').value;
    const isActive = document.getElementById('isActive').value;
    const priceOptions = JSON.stringify(window.priceOptionsData || []);

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ price, isActive, priceOptions })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to update settings');
        }

        showSuccess('Settings updated successfully!');
    } catch (error) {
        console.error('Update settings error:', error);
        showError(error.message || 'Failed to update settings', 'dashboard-error');
    }
});

// Load statistics
async function loadStatistics() {
    try {
        const response = await fetch(`/api/payments/statistics?t=${Date.now()}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to load statistics');
        }

        const stats = data.statistics;
        document.getElementById('stat-total-money').textContent = `${stats.totalMoney} EGP`;
        document.getElementById('stat-approved').textContent = stats.approvedCount;
        document.getElementById('stat-total').textContent = stats.totalPayments;
        document.getElementById('stat-checkedin').textContent = stats.checkedInCount;
        document.getElementById('stat-pending').textContent = stats.pendingApproval;

    } catch (error) {
        console.error('Load statistics error:', error);
    }
}

// Load payments
async function loadPayments() {
    try {
        // Optional: Add a subtle loading indicator
        const tbody = document.getElementById('payments-tbody');
        const isFirstLoad = !window.paymentsData;

        if (isFirstLoad) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="text-center">Loading payments...</td>
                </tr>
            `;
        }

        // Add cache-busting parameter to ensure fresh data
        const response = await fetch(`/api/payments?t=${Date.now()}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to load payments');
        }

        renderPayments(data.payments);

    } catch (error) {
        console.error('Load payments error:', error);
        document.getElementById('payments-tbody').innerHTML = `
            <tr>
                <td colspan="11" class="text-center error">Failed to load payments</td>
            </tr>
        `;
    }
}

// Render payments table
function renderPayments(payments) {
    const tbody = document.getElementById('payments-tbody');

    if (!payments || payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" class="text-center">No payments found</td>
            </tr>
        `;
        return;
    }

    // Store payments for sorting
    window.paymentsData = payments;

    // Render rows
    tbody.innerHTML = payments.map((payment, index) => {
        const rowNumber = index + 1; // Row 1 = newest

        const statusClass = payment.paymentStatus === 'completed' ? 'status-completed' :
            payment.paymentStatus === 'pending' ? 'status-pending' :
            'status-failed';

        const checkedInIcon = payment.checkedIn ? '✅' : '⏳';
        const approvedIcon = payment.approved ? '✅' : '⏳';

        const date = new Date(payment.createdAt).toLocaleString();

        // Show approve button only if not approved
        const approveButton = payment.approved ?
            `<span class="status status-completed">✅ Approved</span>` :
            `<button class="btn btn-small btn-success" onclick="approvePayment(${payment.id})">✅ Approve</button>`;

        return `
            <tr>
                <td>${rowNumber}</td>
                <td>${escapeHtml(payment.userName)}</td>
                <td>${escapeHtml(payment.userEmail)}</td>
                <td>${escapeHtml(payment.userPhone)}</td>
                <td>${payment.amount} EGP</td>
                <td>${formatPaymentMethod(payment.paymentMethod)}</td>
                <td><span class="status ${statusClass}">${payment.paymentStatus}</span></td>
                <td><code>${payment.uniqueId}</code></td>
                <td>${approvedIcon}</td>
                <td>${checkedInIcon}</td>
                <td>${date}</td>
                <td>
                    <div class="action-buttons">
                        ${approveButton}
                        <button class="btn btn-small btn-danger" onclick="archivePayment(${payment.id})" title="Archive this payment">📦</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    // Make headers sortable
    makeHeadersSortable();
}

// Make table headers sortable
function makeHeadersSortable() {
    const headers = document.querySelectorAll('#payments-table thead th');

    headers.forEach((header, index) => {
        // Skip action column
        if (index === headers.length - 1) return;

        header.classList.add('sortable');
        header.onclick = () => sortTable(index, header);
    });
}

// Sort table by column
let currentSortColumn = -1;
let currentSortDirection = 'asc';

function sortTable(columnIndex, headerElement) {
    const payments = window.paymentsData;
    if (!payments) return;

    // Toggle sort direction
    if (currentSortColumn === columnIndex) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        currentSortDirection = 'asc';
        currentSortColumn = columnIndex;
    }

    // Remove sort classes from all headers
    document.querySelectorAll('#payments-table thead th').forEach(th => {
        th.classList.remove('sorted-asc', 'sorted-desc');
    });

    // Add sort class to current header
    headerElement.classList.add(currentSortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc');

    // Sort data
    const sortedPayments = [...payments].sort((a, b) => {
        let aVal, bVal;

        switch (columnIndex) {
            case 0: // Row number (reverse of index)
                return currentSortDirection === 'asc' ?
                    payments.indexOf(a) - payments.indexOf(b) :
                    payments.indexOf(b) - payments.indexOf(a);
            case 1: // Name
                aVal = a.userName.toLowerCase();
                bVal = b.userName.toLowerCase();
                break;
            case 2: // Email
                aVal = a.userEmail.toLowerCase();
                bVal = b.userEmail.toLowerCase();
                break;
            case 3: // Phone
                aVal = a.userPhone;
                bVal = b.userPhone;
                break;
            case 4: // Amount
                aVal = parseFloat(a.amount);
                bVal = parseFloat(b.amount);
                break;
            case 5: // Method
                aVal = a.paymentMethod;
                bVal = b.paymentMethod;
                break;
            case 6: // Status
                aVal = a.paymentStatus;
                bVal = b.paymentStatus;
                break;
            case 7: // Unique ID
                aVal = a.uniqueId;
                bVal = b.uniqueId;
                break;
            case 8: // Approved
                aVal = a.approved ? 1 : 0;
                bVal = b.approved ? 1 : 0;
                break;
            case 9: // Checked In
                aVal = a.checkedIn ? 1 : 0;
                bVal = b.checkedIn ? 1 : 0;
                break;
            case 10: // Date
                aVal = new Date(a.createdAt).getTime();
                bVal = new Date(b.createdAt).getTime();
                break;
            default:
                return 0;
        }

        if (aVal < bVal) return currentSortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Re-render with sorted data
    const tbody = document.getElementById('payments-tbody');
    tbody.innerHTML = sortedPayments.map((payment, index) => {
        const rowNumber = index + 1;

        const statusClass = payment.paymentStatus === 'completed' ? 'status-completed' :
            payment.paymentStatus === 'pending' ? 'status-pending' :
            'status-failed';

        const checkedInIcon = payment.checkedIn ? '✅' : '⏳';
        const approvedIcon = payment.approved ? '✅' : '⏳';

        const date = new Date(payment.createdAt).toLocaleString();

        const approveButton = payment.approved ?
            `<span class="status status-completed">✅ Approved</span>` :
            `<button class="btn btn-small btn-success" onclick="approvePayment(${payment.id})">✅ Approve</button>`;

        return `
            <tr>
                <td>${rowNumber}</td>
                <td>${escapeHtml(payment.userName)}</td>
                <td>${escapeHtml(payment.userEmail)}</td>
                <td>${escapeHtml(payment.userPhone)}</td>
                <td>${payment.amount} EGP</td>
                <td>${formatPaymentMethod(payment.paymentMethod)}</td>
                <td><span class="status ${statusClass}">${payment.paymentStatus}</span></td>
                <td><code>${payment.uniqueId}</code></td>
                <td>${approvedIcon}</td>
                <td>${checkedInIcon}</td>
                <td>${date}</td>
                <td>
                    <div class="action-buttons">
                        ${approveButton}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Format payment method
function formatPaymentMethod(method) {
    const methods = {
        'paymob-wallet': '📱 Mobile Wallet',
        'paymob-card': '💳 Card/Debit'
    };
    return methods[method] || method;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Approve payment (no confirmation prompt)
async function approvePayment(paymentId) {
    try {
        const response = await fetch(`/api/payments/${paymentId}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to approve payment');
        }

        showSuccess('✅ Payment approved successfully!');
        loadStatistics(); // Reload statistics
        loadPayments(); // Reload table
    } catch (error) {
        console.error('Approve payment error:', error);
        showError(error.message || 'Failed to approve payment', 'dashboard-error');
    }
}

// Archive a single payment
async function archivePayment(paymentId) {
    try {
        const response = await fetch(`/api/payments/${paymentId}/archive`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to archive payment');
        }

        showSuccess('📦 Payment archived successfully!');
        loadStatistics(); // Reload statistics
        loadPayments(); // Reload table

        // Reload archived if it's visible
        const archivedSection = document.getElementById('archived-section');
        if (archivedSection.style.display !== 'none') {
            loadArchivedPayments();
        }
    } catch (error) {
        console.error('Archive payment error:', error);
        showError(error.message || 'Failed to archive payment', 'dashboard-error');
    }
}

// Archive all payments
async function archiveAllPayments() {
    try {
        const response = await fetch('/api/payments/archive-all', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to archive payments');
        }

        showSuccess(`📦 ${data.archivedCount} payment(s) archived successfully! Table cleared and statistics reset.`);
        loadStatistics(); // Reload statistics (should show 0s now)
        loadPayments(); // Reload table (should be empty)

        // Reload archived if it's visible
        const archivedSection = document.getElementById('archived-section');
        if (archivedSection.style.display !== 'none') {
            loadArchivedPayments();
        }
    } catch (error) {
        console.error('Archive all payments error:', error);
        showError(error.message || 'Failed to archive payments', 'dashboard-error');
    }
}

// Toggle archived payments section
function toggleArchivedSection() {
    const section = document.getElementById('archived-section');
    const btn = document.getElementById('toggle-archived-btn');

    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = 'Hide Archived';
        loadArchivedPayments();
    } else {
        section.style.display = 'none';
        btn.textContent = 'Show Archived';
    }
}

// Load archived payments
async function loadArchivedPayments() {
    try {
        const tbody = document.getElementById('archived-tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center">Loading archived payments...</td>
            </tr>
        `;

        const response = await fetch('/api/payments/archived', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to load archived payments');
        }

        renderArchivedPayments(data.payments);

    } catch (error) {
        console.error('Load archived payments error:', error);
        document.getElementById('archived-tbody').innerHTML = `
            <tr>
                <td colspan="12" class="text-center error">Failed to load archived payments</td>
            </tr>
        `;
    }
}

// Render archived payments table
function renderArchivedPayments(payments) {
    const tbody = document.getElementById('archived-tbody');

    if (!payments || payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="12" class="text-center">No archived payments</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = payments.map((payment, index) => {
        const rowNumber = index + 1;

        const statusClass = payment.paymentStatus === 'completed' ? 'status-completed' :
            payment.paymentStatus === 'pending' ? 'status-pending' :
            'status-failed';

        const checkedInIcon = payment.checkedIn ? '✅' : '⏳';
        const approvedIcon = payment.approved ? '✅' : '⏳';

        const archivedDate = payment.archivedAt ? new Date(payment.archivedAt).toLocaleString() : 'N/A';
        const archivedBy = payment.archivedBy || 'Unknown';

        return `
            <tr>
                <td>${rowNumber}</td>
                <td>${escapeHtml(payment.userName)}</td>
                <td>${escapeHtml(payment.userEmail)}</td>
                <td>${escapeHtml(payment.userPhone)}</td>
                <td>${payment.amount} EGP</td>
                <td>${formatPaymentMethod(payment.paymentMethod)}</td>
                <td><span class="status ${statusClass}">${payment.paymentStatus}</span></td>
                <td><code>${payment.uniqueId}</code></td>
                <td>${approvedIcon}</td>
                <td>${checkedInIcon}</td>
                <td>${archivedDate}</td>
                <td>${escapeHtml(archivedBy)}</td>
            </tr>
        `;
    }).join('');
}

// Logout
function logout() {
    authToken = null;
    localStorage.removeItem('adminToken');

    // Clear refresh interval
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }

    showLogin();

    // Clear form
    document.getElementById('login-form').reset();
}

// Complete payment and send Telegram notification (for testing/manual completion)
async function completeAndNotify(uniqueId) {
    if (!confirm(`Complete payment ${uniqueId} and send Telegram notification?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/test-complete-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uniqueId })
        });

        const data = await response.json();

        if (data.success) {
            showMessage('dashboard-success', `✅ Payment completed and Telegram notification sent!`);
            loadDashboard();
        } else {
            showMessage('dashboard-error', data.message || 'Failed to complete payment');
        }
    } catch (error) {
        console.error('Complete payment error:', error);
        showMessage('dashboard-error', 'Error completing payment');
    }
}