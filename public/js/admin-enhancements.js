// ==================== ENHANCED ADMIN DASHBOARD FEATURES ====================

// Global variables for selection and filtering
let selectedPayments = new Set();
let allPaymentsData = [];
let filteredPaymentsData = [];

// ==================== SEARCH FUNCTIONALITY ====================

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
                payment.uniqueId.toLowerCase().includes(searchTerm)
            );
        });
    }

    renderPayments(filteredPaymentsData);
}

// ==================== BULK SELECTION ====================

function toggleSelectAll() {
    const selectAll = document.getElementById('select-all');
    const checkboxes = document.querySelectorAll('#payments-tbody input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
        const uniqueId = checkbox.value;
        if (selectAll.checked) {
            selectedPayments.add(uniqueId);
        } else {
            selectedPayments.delete(uniqueId);
        }
    });

    updateBulkActionsUI();
}

function toggleSelectAllArchived() {
    const selectAll = document.getElementById('select-all-archived');
    const checkboxes = document.querySelectorAll('#archived-tbody input[type="checkbox"]');

    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
        const uniqueId = checkbox.value;
        if (selectAll.checked) {
            selectedPayments.add(uniqueId);
        } else {
            selectedPayments.delete(uniqueId);
        }
    });

    updateBulkActionsUI();
}

function toggleSelection(uniqueId) {
    const checkbox = document.querySelector(`#payments-tbody input[value="${uniqueId}"]`);

    if (checkbox) {
        if (checkbox.checked) {
            selectedPayments.add(uniqueId);
        } else {
            selectedPayments.delete(uniqueId);
        }
    }

    updateBulkActionsUI();
}

function updateBulkActionsUI() {
    const bulkActions = document.getElementById('bulk-actions');
    const selectedCount = document.getElementById('selected-count');

    if (selectedPayments.size > 0) {
        bulkActions.style.display = 'flex';
        selectedCount.textContent = `${selectedPayments.size} selected`;
    } else {
        bulkActions.style.display = 'none';
        selectedCount.textContent = '0 selected';
    }

    // Update select-all checkbox state
    const allCheckboxes = document.querySelectorAll('#payments-tbody input[type="checkbox"]');
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox && allCheckboxes.length > 0) {
        const checkedCount = Array.from(allCheckboxes).filter(cb => cb.checked).length;
        selectAllCheckbox.checked = checkedCount === allCheckboxes.length && checkedCount > 0;
        selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
    }
}

function clearSelection() {
    selectedPayments.clear();
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateBulkActionsUI();
}

// ==================== BULK ACTIONS ====================

async function bulkApprove() {
    if (selectedPayments.size === 0) return;

    if (!confirm(`Approve ${selectedPayments.size} payment(s)?`)) return;

    const results = {
        success: 0,
        failed: 0
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
            }
        } catch (error) {
            console.error(`Failed to approve ${uniqueId}:`, error);
            results.failed++;
        }
    }

    if (results.success > 0 && results.failed === 0) {
        showSuccess(`Successfully approved ${results.success} payment(s)`);
    } else if (results.success > 0 && results.failed > 0) {
        showWarning(`Approved: ${results.success}, Failed: ${results.failed}`);
    } else {
        showError(`Failed to approve ${results.failed} payment(s)`);
    }

    clearSelection();
    loadPayments();
    loadStatistics();
}

async function bulkArchive() {
    if (selectedPayments.size === 0) return;

    if (!confirm(`Archive ${selectedPayments.size} payment(s)?`)) return;

    const results = {
        success: 0,
        failed: 0
    };

    for (const uniqueId of selectedPayments) {
        try {
            const response = await fetch(`/api/payments/${uniqueId}/archive`, {
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
            }
        } catch (error) {
            console.error(`Failed to archive ${uniqueId}:`, error);
            results.failed++;
        }
    }

    if (results.success > 0 && results.failed === 0) {
        showSuccess(`Successfully archived ${results.success} payment(s)`);
    } else if (results.success > 0 && results.failed > 0) {
        showWarning(`Archived: ${results.success}, Failed: ${results.failed}`);
    } else {
        showError(`Failed to archive ${results.failed} payment(s)`);
    }

    clearSelection();
    loadPayments();
    loadStatistics();
}

async function bulkDelete() {
    if (selectedPayments.size === 0) return;

    if (!confirm(`⚠️ PERMANENTLY DELETE ${selectedPayments.size} payment(s)?\n\nThis action CANNOT be undone!`)) return;

    const results = {
        success: 0,
        failed: 0
    };

    for (const uniqueId of selectedPayments) {
        try {
            const response = await fetch(`/api/payments/${uniqueId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${window.authToken}`
                }
            });

            if (response.ok) {
                results.success++;
            } else {
                results.failed++;
            }
        } catch (error) {
            console.error(`Failed to delete ${uniqueId}:`, error);
            results.failed++;
        }
    }

    if (results.success > 0 && results.failed === 0) {
        showSuccess(`Successfully deleted ${results.success} payment(s)`);
    } else if (results.success > 0 && results.failed > 0) {
        showWarning(`Deleted: ${results.success}, Failed: ${results.failed}`);
    } else {
        showError(`Failed to delete ${results.failed} payment(s)`);
    }

    clearSelection();
    loadPayments();
    loadStatistics();
}

// ==================== CSV EXPORT ====================

let isExporting = false; // Prevent double-click

function exportToCSV() {
    if (isExporting) return;
    isExporting = true;

    // Use window variables to access data from admin.js
    const filteredData = window.filteredPaymentsData || [];
    const allData = window.allPaymentsData || [];
    const dataToExport = filteredData.length > 0 ? filteredData : allData;

    console.log('Export CSV - Filtered:', filteredData.length, 'All:', allData.length);

    if (dataToExport.length === 0) {
        isExporting = false;
        showWarning('No payments to export. Please load payments first.');
        return;
    }

    // CSV headers
    const headers = [
        'Name', 'Email', 'Phone', 'Amount (EGP)', 'Payment Method',
        'Status', 'Unique ID', 'Approved', 'Checked In', 'Date'
    ];

    // CSV rows
    const rows = dataToExport.map(payment => [
        payment.userName,
        payment.userEmail,
        payment.userPhone,
        payment.amount,
        payment.paymentMethod,
        payment.paymentStatus,
        payment.uniqueId,
        payment.approved ? 'Yes' : 'No',
        payment.checkedIn ? 'Yes' : 'No',
        new Date(payment.createdAt).toLocaleString()
    ]);

    // Combine headers and rows
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `payments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    isExporting = false;
    showSuccess(`Successfully exported ${dataToExport.length} payments to CSV`);
}

// ==================== LOAD ARCHIVED PAYMENTS ====================

async function loadArchivedPayments() {
    try {
        console.log('Loading archived payments with token:', window.authToken ? 'Token exists' : 'No token found');

        const response = await fetch('/api/payments/archived', {
            headers: {
                'Authorization': `Bearer ${window.authToken}`
            }
        });

        console.log('Archived payments response status:', response.status);

        const data = await response.json();
        console.log('Archived payments data:', data);

        if (!response.ok) {
            throw new Error(data.message || `Server error: ${response.status}`);
        }

        if (!data.success) {
            throw new Error(data.message || 'Failed to load archived payments');
        }

        // Check if we have payments
        if (!data.payments || data.payments.length === 0) {
            document.getElementById('archived-tbody').innerHTML = `
                <tr>
                    <td colspan="14" class="text-center" style="padding: 40px; color: #666;">
                        <div style="font-size: 48px; margin-bottom: 15px;">📁</div>
                        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">No Archived Payments</div>
                        <div style="font-size: 14px;">There are no archived payments to display.</div>
                    </td>
                </tr>
            `;
            return;
        }

        renderArchivedPayments(data.payments);

    } catch (error) {
        console.error('Load archived payments error:', error);
        if (typeof showError === 'function') {
            showError(`Failed to load archived payments: ${error.message}`);
        }
        document.getElementById('archived-tbody').innerHTML = `
            <tr>
                <td colspan="14" class="text-center error" style="padding: 30px;">
                    <div style="font-size: 36px; margin-bottom: 10px;">❌</div>
                    <div style="font-weight: 600; margin-bottom: 5px;">Error Loading Archived Payments</div>
                    <div style="font-size: 13px; color: #666;">${error.message}</div>
                </td>
            </tr>
        `;
    }
}

function renderArchivedPayments(payments) {
    const tbody = document.getElementById('archived-tbody');

    if (!payments || payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="14" class="text-center">No archived payments</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = payments.map((payment, index) => {
        const rowNumber = index + 1;
        const statusClass = payment.paymentStatus === 'completed' ? 'status-completed' :
            payment.paymentStatus === 'pending' ? 'status-pending' : 'status-failed';

        const approvedIcon = payment.approved ? '✅' : '⏳';
        const checkedInIcon = payment.checkedIn ? '✅' : '⏳';
        const archivedDate = payment.archivedAt ? new Date(payment.archivedAt).toLocaleString() : 'N/A';
        const archivedBy = payment.archivedBy || 'System';

        return `
            <tr>
                <td><input type="checkbox" value="${payment.uniqueId}" onchange="toggleSelection('${payment.uniqueId}')"></td>
                <td>${rowNumber}</td>
                <td>${payment.userName}</td>
                <td>${payment.userEmail}</td>
                <td>${payment.userPhone}</td>
                <td>${payment.amount} EGP</td>
                <td>
                    <span style="display: inline-flex; align-items: center; gap: 5px;">
                        ${payment.paymentMethod === 'paymob-wallet' ? '📱 Wallet' : '💳 Card/Debit'}
                    </span>
                </td>
                <td><span class="status-badge ${statusClass}">${payment.paymentStatus}</span></td>
                <td><code>${payment.uniqueId}</code></td>
                <td class="text-center">${approvedIcon}</td>
                <td class="text-center">${checkedInIcon}</td>
                <td>${archivedDate}</td>
                <td>${archivedBy}</td>
                <td>
                    <button class="btn btn-danger btn-small" onclick="deletePayment('${payment.uniqueId}')" title="Delete permanently">
                        🗑️
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ==================== TOGGLE ARCHIVED SECTION ====================

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

// Export functions to global scope
window.searchPayments = searchPayments;
window.toggleSelectAll = toggleSelectAll;
window.toggleSelectAllArchived = toggleSelectAllArchived;
window.toggleSelection = toggleSelection;
window.clearSelection = clearSelection;
window.bulkApprove = bulkApprove;
window.bulkArchive = bulkArchive;
window.bulkDelete = bulkDelete;
window.exportToCSV = exportToCSV;
window.loadArchivedPayments = loadArchivedPayments;
window.toggleArchivedSection = toggleArchivedSection;