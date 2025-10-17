// ==================== UTILITY: FORMAT PAYMENT METHOD ====================
function formatPaymentMethod(method) {
    switch (method) {
        case 'paymob-wallet':
            return 'Wallet';
        case 'card':
        case 'debit':
        case 'credit':
            return 'Card/Debit';
        case 'cash':
            return 'Cash';
        default:
            return method ? method.charAt(0).toUpperCase() + method.slice(1) : '-';
    }
}
// ==================== UTILITY: ESCAPE HTML ====================
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"`=]/g, function(c) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;',
            '`': '&#96;',
            '=': '&#61;'
        }[c];
    });
}
// ==================== ENHANCED ADMIN DASHBOARD FEATURES ====================

// Global variables for enhanced features
let selectedPayments = new Set();
let allPaymentsData = [];
let filteredPaymentsData = [];
let currentPage = 1;
let pageSize = 25;
let totalPages = 1;
let currentFilters = {};
let visibleColumns = {
    checkbox: true,
    number: true,
    name: true,
    email: true,
    phone: true,
    amount: true,
    method: true,
    status: true,
    uniqueid: true,
    approved: true,
    checkedin: true,
    date: true,
    actions: true
};

// ==================== ADVANCED FILTERING ====================

function toggleFilterPanel() {
    const panel = document.getElementById('filter-panel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';

    if (!isVisible) {
        // Load saved filters from localStorage
        loadSavedFilters();
    }
}

function applyFilters() {
    const filters = {
        dateFrom: document.getElementById('filter-date-from').value,
        dateTo: document.getElementById('filter-date-to').value,
        status: document.getElementById('filter-status').value,
        method: document.getElementById('filter-method').value,
        amountMin: document.getElementById('filter-amount-min').value,
        amountMax: document.getElementById('filter-amount-max').value,
        approved: document.getElementById('filter-approved').value,
        checkedIn: document.getElementById('filter-checkedin').value
    };

    currentFilters = filters;

    // Save filters to localStorage
    localStorage.setItem('adminFilters', JSON.stringify(filters));

    // Apply filters to data
    filteredPaymentsData = allPaymentsData.filter(payment => {
        // Date range filter
        if (filters.dateFrom) {
            const paymentDate = new Date(payment.createdAt);
            const fromDate = new Date(filters.dateFrom);
            if (paymentDate < fromDate) return false;
        }

        if (filters.dateTo) {
            const paymentDate = new Date(payment.createdAt);
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999); // End of day
            if (paymentDate > toDate) return false;
        }

        // Status filter
        if (filters.status && payment.paymentStatus !== filters.status) return false;

        // Method filter
        if (filters.method && payment.paymentMethod !== filters.method) return false;

        // Amount range filter
        if (filters.amountMin && parseFloat(payment.amount) < parseFloat(filters.amountMin)) return false;
        if (filters.amountMax && parseFloat(payment.amount) > parseFloat(filters.amountMax)) return false;

        // Approval filter
        if (filters.approved !== '') {
            const isApproved = filters.approved === 'true';
            if (payment.approved !== isApproved) return false;
        }

        // Check-in filter
        if (filters.checkedIn !== '') {
            const isCheckedIn = filters.checkedIn === 'true';
            if (payment.checkedIn !== isCheckedIn) return false;
        }

        return true;
    });

    currentPage = 1; // Reset to first page
    renderPayments(filteredPaymentsData);
    updatePagination();
    showSuccess(`Applied filters: ${filteredPaymentsData.length} payments found`);
}

// Make only small table filters update table in real time
document.addEventListener('DOMContentLoaded', () => {
    const tableFilterIds = [
        'table-search-input', 'status-filter', 'method-filter', 'approved-filter'
    ];
    tableFilterIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updateTableFilters);
            el.addEventListener('change', updateTableFilters);
        }
    });
});

function updateTableFilters() {
    const searchTerm = document.getElementById('table-search-input').value.toLowerCase().trim();
    const status = document.getElementById('status-filter').value;
    const method = document.getElementById('method-filter').value;
    const approved = document.getElementById('approved-filter').value;

    filteredPaymentsData = allPaymentsData.filter(payment => {
        // Search
        if (searchTerm && !(
                payment.userName.toLowerCase().includes(searchTerm) ||
                payment.userEmail.toLowerCase().includes(searchTerm) ||
                payment.userPhone.includes(searchTerm) ||
                payment.uniqueId.toLowerCase().includes(searchTerm) ||
                payment.amount.toString().includes(searchTerm)
            )) return false;

        // Status
        if (status !== 'all' && payment.paymentStatus !== status) return false;

        // Method
        if (method !== 'all') {
            if (method === 'card' && payment.paymentMethod !== 'paymob-card') return false;
            if (method === 'wallet' && payment.paymentMethod !== 'paymob-wallet') return false;
            if (method === 'cash' && payment.paymentMethod !== 'cash') return false;
        }

        // Approved
        if (approved !== 'all') {
            if (approved === 'approved' && !payment.approved) return false;
            if (approved === 'pending' && payment.approved) return false;
        }

        return true;
    });
    currentPage = 1;
    renderPayments(filteredPaymentsData);
    updatePagination();
}

function clearFilters() {
    // Clear all filter inputs
    document.getElementById('filter-date-from').value = '';
    document.getElementById('filter-date-to').value = '';
    document.getElementById('filter-status').value = '';
    document.getElementById('filter-method').value = '';
    document.getElementById('filter-amount-min').value = '';
    document.getElementById('filter-amount-max').value = '';
    document.getElementById('filter-approved').value = '';
    document.getElementById('filter-checkedin').value = '';

    // Clear current filters
    currentFilters = {};
    localStorage.removeItem('adminFilters');

    // Reset to show all data
    filteredPaymentsData = [...allPaymentsData];
    currentPage = 1;
    renderPayments(filteredPaymentsData);
    updatePagination();
    showSuccess('Filters cleared');
}

function loadSavedFilters() {
    const savedFilters = localStorage.getItem('adminFilters');
    if (savedFilters) {
        const filters = JSON.parse(savedFilters);

        document.getElementById('filter-date-from').value = filters.dateFrom || '';
        document.getElementById('filter-date-to').value = filters.dateTo || '';
        document.getElementById('filter-status').value = filters.status || '';
        document.getElementById('filter-method').value = filters.method || '';
        document.getElementById('filter-amount-min').value = filters.amountMin || '';
        document.getElementById('filter-amount-max').value = filters.amountMax || '';
        document.getElementById('filter-approved').value = filters.approved || '';
        document.getElementById('filter-checkedin').value = filters.checkedIn || '';
    }
}

// ==================== PAGINATION ====================

function updatePagination() {
    const totalItems = filteredPaymentsData.length;
    totalPages = Math.ceil(totalItems / pageSize);

    const paginationContainer = document.getElementById('pagination-container');
    const paginationInfo = document.getElementById('pagination-info');
    const pageNumbers = document.getElementById('page-numbers');

    if (totalItems <= pageSize) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';

    // Update pagination info
    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);
    paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalItems} payments`;

    // Update page numbers
    let pageNumbersHtml = '';
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        pageNumbersHtml += `<button class="pagination-btn ${isActive ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }

    pageNumbers.innerHTML = pageNumbersHtml;

    // Update navigation buttons
    document.getElementById('first-page').disabled = currentPage === 1;
    document.getElementById('prev-page').disabled = currentPage === 1;
    document.getElementById('next-page').disabled = currentPage === totalPages;
    document.getElementById('last-page').disabled = currentPage === totalPages;
}

function goToPage(page) {
    if (page === -1) {
        // Previous page
        if (currentPage > 1) currentPage--;
    } else if (page === 1 && currentPage < totalPages) {
        // Next page
        currentPage++;
    } else if (typeof page === 'number' && page >= 1 && page <= totalPages) {
        // Specific page
        currentPage = page;
    }

    renderPayments(filteredPaymentsData);
    updatePagination();
}

function changePageSize() {
    pageSize = parseInt(document.getElementById('page-size-select').value);
    currentPage = 1;
    renderPayments(filteredPaymentsData);
    updatePagination();
}

// ==================== COLUMN CUSTOMIZATION ====================

function toggleColumnDropdown() {
    const dropdown = document.getElementById('column-dropdown');
    dropdown.classList.toggle('show');

    // Close dropdown when clicking outside
    document.addEventListener('click', function(event) {
        if (!dropdown.contains(event.target)) {
            dropdown.classList.remove('show');
        }
    });
}

function toggleColumn(columnName) {
    visibleColumns[columnName] = !visibleColumns[columnName];

    // Save column preferences
    localStorage.setItem('adminVisibleColumns', JSON.stringify(visibleColumns));

    // Re-render table with new column visibility
    renderPayments(filteredPaymentsData);
}

function loadColumnPreferences() {
    const savedColumns = localStorage.getItem('adminVisibleColumns');
    if (savedColumns) {
        visibleColumns = {...visibleColumns, ...JSON.parse(savedColumns) };

        // Update checkboxes
        Object.keys(visibleColumns).forEach(column => {
            const checkbox = document.getElementById(`col-${column}`);
            if (checkbox) {
                checkbox.checked = visibleColumns[column];
            }
        });
    }
}

// ==================== ENHANCED SEARCH ====================

function searchPayments() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();

    if (!searchTerm) {
        filteredPaymentsData = [...allPaymentsData];
    } else {
        filteredPaymentsData = allPaymentsData.filter(payment => {
            return (
                payment.userName.toLowerCase().includes(searchTerm) ||
                payment.userEmail.toLowerCase().includes(searchTerm) ||
                payment.userPhone.includes(searchTerm) ||
                payment.uniqueId.toLowerCase().includes(searchTerm) ||
                payment.amount.toString().includes(searchTerm)
            );
        });
    }

    currentPage = 1;
    renderPayments(filteredPaymentsData);
    updatePagination();
}

// ==================== ENHANCED EXPORT ====================
// Alias for export button compatibility
window.exportToCSV = function() {
    // Use the same logic as exportToExcel but output CSV
    const filteredData = window.filteredPaymentsData || [];
    const allData = window.allPaymentsData || [];
    const dataToExport = filteredData.length > 0 ? filteredData : allData;

    if (dataToExport.length === 0) {
        showWarning('No payments to export. Please load payments first.');
        return;
    }

    const headers = [
        'Name', 'Email', 'Phone', 'Amount (EGP)', 'Payment Method',
        'Status', 'Unique ID', 'Approved', 'Checked In', 'Date', 'Approved By', 'Checked In By'
    ];

    const rows = dataToExport.map(payment => [
        payment.userName,
        payment.userEmail,
        payment.userPhone,
        payment.amount,
        payment.paymentMethod === 'paymob-wallet' ? 'Mobile Wallet' : 'Card/Debit',
        payment.paymentStatus,
        payment.uniqueId,
        payment.approved ? 'Yes' : 'No',
        payment.checkedIn ? 'Yes' : 'No',
        new Date(payment.createdAt).toLocaleString(),
        payment.approvedBy || '',
        payment.checkedInBy || ''
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payments_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess(`Successfully exported ${dataToExport.length} payments to CSV format`);
};

let isExportingExcel = false; // Prevent double-click

function exportToExcel() {
    if (isExportingExcel) return;
    isExportingExcel = true;

    // Use window variables to access data from admin.js
    const filteredData = window.filteredPaymentsData || [];
    const allData = window.allPaymentsData || [];
    const dataToExport = filteredData.length > 0 ? filteredData : allData;

    console.log('Export Excel - Filtered:', filteredData.length, 'All:', allData.length);

    if (dataToExport.length === 0) {
        isExportingExcel = false;
        showWarning('No payments to export. Please load payments first.');
        return;
    }

    // Create Excel-like CSV with better formatting
    const headers = [
        'Name', 'Email', 'Phone', 'Amount (EGP)', 'Payment Method',
        'Status', 'Unique ID', 'Approved', 'Checked In', 'Date', 'Approved By', 'Checked In By'
    ];

    const rows = dataToExport.map(payment => [
        payment.userName,
        payment.userEmail,
        payment.userPhone,
        payment.amount,
        payment.paymentMethod === 'paymob-wallet' ? 'Mobile Wallet' : 'Card/Debit',
        payment.paymentStatus,
        payment.uniqueId,
        payment.approved ? 'Yes' : 'No',
        payment.checkedIn ? 'Yes' : 'No',
        new Date(payment.createdAt).toLocaleString(),
        payment.approvedBy || '',
        payment.checkedInBy || ''
    ]);

    // Add summary row
    const summaryRow = [
        '', '', '', '', '', '', '', '', '', '', '', ''
    ];

    const csvContent = [
        'Payment Export Report',
        `Generated: ${new Date().toLocaleString()}`,
        `Total Records: ${dataToExport.length}`,
        '',
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
        '',
        'Summary',
    `Total Amount: ${Math.round(dataToExport.reduce((sum, p) => sum + parseFloat(p.amount), 0))} EGP`,
        `Approved: ${dataToExport.filter(p => p.approved).length}`,
        `Checked In: ${dataToExport.filter(p => p.checkedIn).length}`
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `payments_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    isExportingExcel = false;
    showSuccess(`Successfully exported ${dataToExport.length} payments to Excel format`);
}

// ==================== ENHANCED TABLE RENDERING ====================

function renderPayments(payments) {
    const tbody = document.getElementById('payments-tbody');

    if (!payments || payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center">No payments found</td>
            </tr>
        `;
        return;
    }

    // Apply pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedPayments = payments.slice(startIndex, endIndex);

    // Store payments globally for search and export
    window.paymentsData = paginatedPayments;
    window.allPaymentsData = payments;
    window.filteredPaymentsData = payments;

    // Render rows with column visibility
    tbody.innerHTML = paginatedPayments.map((payment, index) => {
        const rowNumber = startIndex + index + 1;
        // Payment method icon
        let methodIcon = '';
        if (payment.paymentMethod === 'paymob-card') methodIcon = '<span class="icon-card" title="Card">&#128179;</span>';
        else if (payment.paymentMethod === 'paymob-wallet') methodIcon = '<span class="icon-wallet" title="Wallet">&#128241;</span>';
        else methodIcon = '<span class="icon-cash" title="Cash">&#128176;</span>';

        // Status pill
        let statusClass = '';
        let statusLabel = payment.paymentStatus;
        if (payment.paymentStatus === 'completed') {
            statusClass = 'status-pill status-success';
            statusLabel = 'Completed';
        } else if (payment.paymentStatus === 'paid') {
            statusClass = 'status-pill status-info';
            statusLabel = 'Paid';
        } else if (payment.paymentStatus === 'pending') {
            statusClass = 'status-pill status-warning';
            statusLabel = 'Pending';
        } else {
            statusClass = 'status-pill status-danger';
        }

        // Selection circle
        const selectCircle = `<span class="select-circle${payment.selected ? ' selected' : ''}" onclick="toggleSelection('${payment.uniqueId}')"></span>`;

        // Customer info
        const customerName = payment.userName ? `<span class="customer-name">${escapeHtml(payment.userName)}</span>` : '-';
        const customerEmail = payment.userEmail ? `<span class="customer-email">${escapeHtml(payment.userEmail)}</span>` : '-';
        const customerPhone = payment.userPhone ? `<span class="customer-phone">${escapeHtml(payment.userPhone)}</span>` : '-';

        // Amount
    const amount = payment.amount ? `<span class="amount-bold">${Math.round(payment.amount)}</span> <span class="currency">EGP</span>` : '-';

        // Date
        const date = payment.createdAt ? `<span class="date-main">${new Date(payment.createdAt).toLocaleDateString()}</span> <span class="date-sub">${new Date(payment.createdAt).toLocaleTimeString()}</span>` : '-';

        // Status pill
        const statusPill = `<span class="${statusClass}">${statusLabel}</span>`;

        // Actions: Approve button (enabled for 'paid', disabled for 'completed')
        const approveButton = (payment.paymentStatus === 'paid' && !payment.approved) ?
            `<button class="btn-success btn-small" onclick="approvePayment('${payment.id}')">Approve</button>` :
            `<button class="btn-success btn-small" disabled style="opacity:0.6;cursor:not-allowed;">${payment.approved || payment.paymentStatus === 'completed' ? 'Approved' : 'Approve'}</button>`;

        return `
            <tr class="dashboard-row-card">
                
                <td class="id-cell">${payment.uniqueId || rowNumber}</td>
                <td class="customer-cell">${customerName}</td>
                <td class="contact-cell">${customerEmail}<br>${customerPhone}</td>
                <td class="amount-cell">${amount}</td>
                <td class="method-cell">${methodIcon} ${formatPaymentMethod(payment.paymentMethod)}</td>
                <td class="status-cell">${statusPill}</td>
                <td class="date-cell">${date}</td>
                <td class="actions-cell">${approveButton}</td>
            </tr>
        `;
    }).join('');

    // Keep static headers defined in admin.html for consistent styling
}

function updateTableHeaders() {
    const thead = document.querySelector('#payments-table thead tr');
    let headerHtml = '';

    if (visibleColumns.checkbox) {
        headerHtml += '<th><input type="checkbox" id="select-all" onchange="toggleSelectAll()" title="Select all"></th>';
    }

    if (visibleColumns.number) {
        headerHtml += '<th>#</th>';
    }

    if (visibleColumns.name) {
        headerHtml += '<th>Name</th>';
    }

    if (visibleColumns.email) {
        headerHtml += '<th>Email</th>';
    }

    if (visibleColumns.phone) {
        headerHtml += '<th>Phone</th>';
    }

    if (visibleColumns.amount) {
        headerHtml += '<th>Amount</th>';
    }

    if (visibleColumns.method) {
        headerHtml += '<th>Method</th>';
    }

    if (visibleColumns.status) {
        headerHtml += '<th>Status</th>';
    }

    if (visibleColumns.uniqueid) {
        headerHtml += '<th>Unique ID</th>';
    }

    if (visibleColumns.approved) {
        headerHtml += '<th>Approved</th>';
    }

    if (visibleColumns.checkedin) {
        headerHtml += '<th>Checked In</th>';
    }

    if (visibleColumns.date) {
        headerHtml += '<th>Date</th>';
    }

    if (visibleColumns.actions) {
        headerHtml += '<th>Actions</th>';
    }

    thead.innerHTML = headerHtml;
}

// ==================== ENHANCED BULK ACTIONS ====================

async function bulkApprove() {
    if (selectedPayments.size === 0) return;

    const confirmed = await confirmDialog(
        `Approve ${selectedPayments.size} payment(s)? This action will mark them as completed and generate QR codes.`,
        'Bulk Approve Payments'
    );

    if (confirmed !== 'confirm') return;

    const loadingNotif = showLoading(`Approving ${selectedPayments.size} payments...`);

    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    for (const uniqueId of selectedPayments) {
        try {
            const payment = allPaymentsData.find(p => p.uniqueId === uniqueId);
            if (!payment) continue;

            const response = await fetch(`/api/payments/${payment.id}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                results.success++;
            } else {
                results.failed++;
                const errorData = await response.json();
                results.errors.push(`${uniqueId}: ${errorData.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(`Failed to approve ${uniqueId}:`, error);
            results.failed++;
            results.errors.push(`${uniqueId}: ${error.message}`);
        }
    }

    removeNotification(loadingNotif);

    if (results.success > 0 && results.failed === 0) {
        showSuccess(`Successfully approved ${results.success} payment(s)`);
    } else if (results.success > 0 && results.failed > 0) {
        showWarning(`Approved: ${results.success}, Failed: ${results.failed}`);
        if (results.errors.length > 0) {
            console.error('Bulk approve errors:', results.errors);
        }
    } else {
        showError(`Failed to approve ${results.failed} payment(s)`);
    }

    clearSelection();
    loadPayments();
    loadStatistics();
}

// ==================== INITIALIZATION ====================
// Alias for refresh button compatibility
window.loadPayments = function() {
    loadDashboardData();
};

// Initialize enhanced features when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication status
    const token = localStorage.getItem('adminToken');
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');

    if (token) {
        // Hide login, show dashboard
        if (loginSection) loginSection.classList.add('hidden');
        if (dashboardSection) dashboardSection.classList.remove('hidden');

        // Load column preferences
        loadColumnPreferences();
        // Load saved filters
        loadSavedFilters();
        // Set up event listeners for enhanced features
        setupEnhancedEventListeners();
        // Toggle archived section visibility
        const toggleBtn = document.getElementById('toggle-archived-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleArchivedSection);
        }
        // Load payment settings and update form
        fetch('/api/settings/public')
            .then(res => res.json())
            .then(data => {
                if (data && data.success) {
                    const priceInput = document.getElementById('price');
                    if (priceInput) priceInput.value = data.price || '';
                    const isActiveSelect = document.getElementById('isActive');
                    if (isActiveSelect) isActiveSelect.value = data.isActive ? 'true' : 'false';
                    let opts = [];
                    if (data.priceOptions) {
                        try {
                            opts = JSON.parse(data.priceOptions);
                        } catch {
                            opts = [];
                        }
                    }
                    renderPriceOptions(opts);
                }
            })
            .catch(() => {});
        // Load dashboard data
        loadDashboardData();
    } else {
        // Show login, hide dashboard
        if (loginSection) loginSection.classList.remove('hidden');
        if (dashboardSection) dashboardSection.classList.add('hidden');
    }
});

// Render price options in settings form
function renderPriceOptions(options) {
    const container = document.getElementById('price-options-container');
    if (!container) return;
    container.innerHTML = '';
    let optsArr = options;
    if (typeof options === 'string') {
        try {
            optsArr = JSON.parse(options);
        } catch {
            optsArr = [];
        }
    }
    if (!Array.isArray(optsArr)) optsArr = [];
    optsArr.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'price-option-row';
        div.innerHTML = `
            <input type="text" class="price-option-label" value="${opt.label || ''}" placeholder="Label" style="width:120px; margin-right:8px;">
            <input type="number" class="price-option-input" value="${opt.amount || ''}" step="0.01" min="0" style="width:100px; margin-right:8px;">
            <button type="button" class="btn btn-danger btn-small" onclick="removePriceOption(${idx})">Remove</button>
        `;
        container.appendChild(div);
    });
}

// Add price option logic
window.addPriceOption = function() {
    const container = document.getElementById('price-options-container');
    const div = document.createElement('div');
    div.className = 'price-option-row';
    div.innerHTML = `
        <input type="text" class="price-option-label" placeholder="Label" style="width:120px; margin-right:8px;">
        <input type="number" class="price-option-input" placeholder="Amount" step="0.01" min="0" style="width:100px; margin-right:8px;">
        <button type="button" class="btn btn-danger btn-small" onclick="removePriceOption(Array.from(container.children).indexOf(this.parentNode))">Remove</button>
    `;
    container.appendChild(div);
};

// Remove price option logic
window.removePriceOption = function(idx) {
    const container = document.getElementById('price-options-container');
    const rows = container.getElementsByClassName('price-option-row');
    if (rows[idx]) container.removeChild(rows[idx]);
};

// Toggle archived section visibility
function toggleArchivedSection() {
    const archivedSection = document.getElementById('archived-section');
    const toggleButton = document.getElementById('toggle-archived-btn');
    if (!archivedSection || !toggleButton) return;
    const isHidden = archivedSection.classList.contains('hidden');
    archivedSection.classList.toggle('hidden');
    toggleButton.textContent = isHidden ? 'Hide Archived' : 'Show Archived';
    if (isHidden && typeof loadArchivedPayments === 'function') {
        loadArchivedPayments();
    }
}

// Toggle select all archived items
function toggleSelectAllArchived() {
    const selectAllCheckbox = document.getElementById('select-all-archived');
    const checkboxes = document.querySelectorAll('#archived-table tbody input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const token = localStorage.getItem('adminToken');

        if (!token) {
            console.log('No token found - user needs to log in first');
            // Don't show error, just return as user likely needs to log in
            return;
        }

        // Show loading state in the dedicated tbody
        const tbody = document.getElementById('payments-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center table-loading">Loading...</td></tr>';
        }

        // Fetch payments data
        const response = await fetch('/api/payments', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch dashboard data');
        }

        const data = await response.json();

        // Store all payments data globally
        allPaymentsData = data.payments || [];
        filteredPaymentsData = [...allPaymentsData];

        // Render payments using Payment Peek Pro-styled renderer
        renderPayments(data.payments || []);

        // Update stats
        updateDashboardStats(data.stats || {});

        // Update pagination
        updatePagination();

        console.log('Dashboard data loaded successfully');
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        const tbody = document.getElementById('payments-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Error loading data. Please try again.</td></tr>';
        }
    }
}

// Display payments in the table
function displayPayments(payments) {
    const tableBody = document.getElementById('payments-table').querySelector('tbody');

    if (payments.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="13" class="text-center">No payments found</td></tr>';
        return;
    }

    let html = '';

    payments.forEach((payment, index) => {
        html += `
            <tr data-id="${payment.id}">
                <td><input type="checkbox" class="payment-checkbox" data-id="${payment.id}"></td>
                <td>${index + 1}</td>
                <td>${payment.userName || '-'}</td>
                <td>
                    ${payment.userEmail || '-'}<br>
                    <span style="color:#555;font-size:13px;">${payment.userPhone || '-'}</span>
                </td>
                <td>${payment.amount ? payment.amount + ' EGP' : '-'}</td>
                <td>${payment.paymentMethod || '-'}</td>
                <td>${payment.paymentStatus || '-'}</td>
                <td>${payment.createdAt ? new Date(payment.createdAt).toLocaleString() : '-'}</td>
                <td class="table-actions-cell">
                    <button class="btn btn-danger btn-small" onclick="archivePayment(${payment.id})">Archive</button>
                    <button class="btn btn-success btn-small" onclick="approvePayment(${payment.id})">Approve</button>
                    <button class="btn btn-secondary btn-small" onclick="deletePayment(${payment.id})">Delete</button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

// Update dashboard stats
function updateDashboardStats(stats) {
    // Check if elements exist before updating them
    const totalPaymentsEl = document.getElementById('total-payments');
    const totalAmountEl = document.getElementById('total-amount');
    const pendingPaymentsEl = document.getElementById('pending-payments');
    const completedPaymentsEl = document.getElementById('completed-payments');

    if (totalPaymentsEl) totalPaymentsEl.textContent = stats.totalPayments || 0;
    if (totalAmountEl) totalAmountEl.textContent = stats.totalAmount ? '$' + stats.totalAmount : '$0';
    if (pendingPaymentsEl) pendingPaymentsEl.textContent = stats.pendingPayments || 0;
    if (completedPaymentsEl) completedPaymentsEl.textContent = stats.completedPayments || 0;
}

function setupEnhancedEventListeners() {
    // Close column dropdown when clicking outside
    document.addEventListener('click', function(event) {
        const dropdown = document.getElementById('column-dropdown');
        if (!dropdown.contains(event.target)) {
            dropdown.classList.remove('show');
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Ctrl+F to focus search
        if (event.ctrlKey && event.key === 'f') {
            event.preventDefault();
            document.getElementById('search-input').focus();
        }

        // Ctrl+A to select all visible payments
        if (event.ctrlKey && event.key === 'a' && event.target.tagName !== 'INPUT') {
            event.preventDefault();
            toggleSelectAll();
        }

        // Escape to clear selection
        if (event.key === 'Escape') {
            clearSelection();
        }
    });
}

// Export functions to global scope
window.toggleFilterPanel = toggleFilterPanel;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.toggleColumnDropdown = toggleColumnDropdown;
window.toggleColumn = toggleColumn;
window.goToPage = goToPage;
window.changePageSize = changePageSize;
window.exportToExcel = exportToExcel;

// Settings form submit handler
document.addEventListener('DOMContentLoaded', () => {
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const price = parseFloat(document.getElementById('price').value) || 0;
            const isActive = document.getElementById('isActive').value === 'true';
            // Collect price options as array of objects
            const priceOptionRows = document.querySelectorAll('#price-options-container .price-option-row');
            const priceOptionsArr = Array.from(priceOptionRows)
                .map(row => {
                    const label = row.querySelector('.price-option-label') ?.value ?.trim();
                    const amount = parseFloat(row.querySelector('.price-option-input') ?.value);
                    return label && !isNaN(amount) && amount > 0 ? { label, amount } : null;
                })
                .filter(opt => opt !== null);

            // Send to backend
            try {
                const token = localStorage.getItem('adminToken');
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ price, priceOptions: JSON.stringify(priceOptionsArr), isActive })
                });
                const data = await res.json();
                if (data.success) {
                    showSuccess('Settings saved successfully');
                } else {
                    showWarning(data.message || 'Failed to save settings');
                }
            } catch (err) {
                showError('Error saving settings');
            }
        });
    }
});


function approvePayment(id) {
    const token = localStorage.getItem('adminToken');
    if (!token) return alert('Admin token missing. Please log in again.');
    fetch(`/api/payments/${id}/approve`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showSuccess('Payment approved successfully');
                loadDashboardData();
            } else {
                showWarning(data.message || 'Failed to approve payment');
            }
        })
        .catch(() => showWarning('Error approving payment'));
}

function deletePayment(id) {
    const token = localStorage.getItem('adminToken');
    if (!token) return alert('Admin token missing. Please log in again.');
    const payment = allPaymentsData.find(p => p.id === id);
    if (!payment) return showWarning('Payment not found');
    if (!confirm('Are you sure you want to permanently delete this payment?')) return;
    fetch(`/api/payments/${payment.uniqueId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showSuccess('Payment deleted successfully');
                loadDashboardData();
            } else {
                showWarning(data.message || 'Failed to delete payment');
            }
        })
        .catch(() => showWarning('Error deleting payment'));
}