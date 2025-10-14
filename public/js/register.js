// Admin Registration JavaScript

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');

    successDiv.classList.add('hidden');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');

    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
}

// Show success message
function showSuccess(message) {
    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');

    errorDiv.classList.add('hidden');
    successDiv.textContent = message;
    successDiv.classList.remove('hidden');
}

// Get referral code from URL if present
function getReferralCode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || '';
}

// Handle form submission
document.getElementById('register-form').addEventListener('submit', async(e) => {
    e.preventDefault();

    const registerBtn = document.getElementById('register-btn');
    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating Account...';

    const formData = {
        username: document.getElementById('username').value.trim(),
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        fullName: document.getElementById('fullName').value.trim(),
        referralCode: getReferralCode()
    };
    // Validation
    if (formData.username.length < 3) {
        showError('Username must be at least 3 characters long');
        resetButton();
        return;
    }

    if (formData.password.length < 6) {
        showError('Password must be at least 6 characters long');
        resetButton();
        return;
    }

    if (formData.password !== formData.confirmPassword) {
        showError('Passwords do not match');
        resetButton();
        return;
    }

    try {
        const response = await fetch('/api/admin/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Registration failed');
        }

        showSuccess('✅ Account created successfully! Redirecting to login...');

        // Clear form
        document.getElementById('register-form').reset();

        // Redirect to login page after 2 seconds
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 2000);

    } catch (error) {
        console.error('Registration error:', error);
        showError(error.message || 'Failed to create account. Please try again.');
        resetButton();
    }
});

function resetButton() {
    const registerBtn = document.getElementById('register-btn');
    registerBtn.disabled = false;
    registerBtn.textContent = 'Create Admin Account';
}

// Password strength indicator (optional enhancement)
document.getElementById('password').addEventListener('input', (e) => {
    const password = e.target.value;
    const strength = calculatePasswordStrength(password);

    // You can add visual feedback here
    console.log('Password strength:', strength);
});

function calculatePasswordStrength(password) {
    let strength = 0;

    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    return strength;
}