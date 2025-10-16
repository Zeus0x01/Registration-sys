// Admin Login JavaScript

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');

    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

// Handle login form submission
document.getElementById('login-form').addEventListener('submit', async(e) => {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    // Basic validation
    if (!username || !password) {
        showError('Please enter both username and password');
        return;
    }

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

        // Store token in localStorage
        localStorage.setItem('adminToken', data.token);

        // Show dashboard
        showDashboard();
    } catch (error) {
        console.error('Login error:', error);
        showError(error.message || 'Login failed. Please try again.');
    }
});

// Show dashboard after successful login
function showDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');

    // Load dashboard data using enhanced dashboard loader
    if (typeof loadDashboardData === 'function') {
        loadDashboardData();
    }
}

// Fetch dashboard data
async function fetchDashboardData() {
    try {
        const token = localStorage.getItem('adminToken');

        if (!token) {
            console.error('No token found');
            return;
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

        // Display data in the dashboard
        displayDashboardData(data);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

// Display dashboard data
function displayDashboardData(data) {
    // This function will update the dashboard UI with the fetched data
    console.log('Dashboard data loaded successfully');

    // If admin-enhanced.js has a global function to initialize dashboard, call it
    if (typeof initializeDashboard === 'function') {
        initializeDashboard();
    }
}

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('adminToken');

    if (token) {
        // Verify token validity
        verifyToken(token);
    }
});

// Verify token validity
async function verifyToken(token) {
    try {
        const response = await fetch('/api/admin/verify-token', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (response.ok && data.valid) {
            showDashboard();
        } else {
            // Token invalid, clear it
            localStorage.removeItem('adminToken');
        }
    } catch (error) {
        console.error('Token verification error:', error);
        localStorage.removeItem('adminToken');
    }
}

// Logout function
function logout() {
    localStorage.removeItem('adminToken');
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
}

// Make logout function globally available
window.logout = logout;