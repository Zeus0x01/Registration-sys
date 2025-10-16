let authToken = null;
let videoStream = null;
let scanningActive = false;
let currentPaymentUniqueId = null;

// Check if already logged in
document.addEventListener('DOMContentLoaded', () => {
    authToken = localStorage.getItem('checkinToken');

    if (authToken) {
        showCheckIn();
    } else {
        showLogin();
    }
});

// Show/Hide sections
function showLogin() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('checkin-section').classList.add('hidden');
}

function showCheckIn() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('checkin-section').classList.remove('hidden');
}

// Show message
function showMessage(message, type = 'info') {
    const messageDiv = document.getElementById('checkin-message');
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove('hidden');

    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}

// Show error in login
function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');

    setTimeout(() => {
        errorDiv.classList.add('hidden');
    }, 5000);
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
        localStorage.setItem('checkinToken', authToken);

        showCheckIn();
    } catch (error) {
        console.error('Login error:', error);
        showLoginError(error.message || 'Login failed. Please try again.');
    }
});

// Manual check-in form
document.getElementById('manual-checkin-form').addEventListener('submit', async(e) => {
    e.preventDefault();

    const uniqueId = document.getElementById('uniqueId').value.trim().toUpperCase();
    await verifyPayment(uniqueId);
});

// Verify payment
async function verifyPayment(uniqueId, payload = null) {
    try {
        let url = `/api/payments/${uniqueId}`;
        if (payload) {
            url += `?payload=${encodeURIComponent(payload)}`;
        }

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Backend error:', data.message || 'Verification failed');
            throw new Error(data.message || 'Verification failed');
        }

        console.log('Backend valid value:', data.valid);
        if (data.valid && data.payment) {
            currentPaymentUniqueId = uniqueId;
            showResult(data.valid, data.payment);
        } else {
            console.error('Payment not valid:', data);
            showResult(data.valid, data.payment, data.message || 'Payment not valid.');
        }

    } catch (error) {
        console.error('Verification error:', error);
        showResult(false, null, error.message);
    }
}

// Show verification result
function showResult(isValid, payment = null, errorMessage = null) {
    const resultSection = document.getElementById('result-section');
    const resultIcon = document.getElementById('result-icon');
    const resultTitle = document.getElementById('result-title');
    const resultDetails = document.getElementById('result-details');
    const checkinBtn = document.getElementById('checkin-btn');
    const resultCard = document.getElementById('result-card');

    resultSection.classList.remove('hidden');

    if (isValid && payment) {
        resultCard.className = 'result-card valid';
        resultIcon.textContent = '✅';
        resultTitle.textContent = 'Valid Payment';

        resultDetails.innerHTML = `
            <p><strong>Name:</strong> ${escapeHtml(payment.userName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(payment.userEmail)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(payment.userPhone)}</p>
            <p><strong>Amount:</strong> ${payment.amount} EGP</p>
            <p><strong>Method:</strong> ${formatPaymentMethod(payment.paymentMethod)}</p>
        `;

        // Always hide check-in button
        checkinBtn.classList.add('hidden');

    } else {
        resultCard.className = 'result-card invalid';
        resultIcon.textContent = '❌';
        resultTitle.textContent = 'Invalid Payment';
        resultDetails.innerHTML = `<p>${errorMessage || 'Payment not found or not verified.'}</p>`;
        checkinBtn.classList.add('hidden');
        currentPaymentUniqueId = null;
    }

    // Scroll to result
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// Perform check-in
async function performCheckIn() {
    if (!currentPaymentUniqueId) return;

    // Show loading state
    const checkinBtn = document.getElementById('checkin-btn');
    const originalText = checkinBtn.textContent;
    checkinBtn.textContent = 'Checking in...';
    checkinBtn.disabled = true;

    try {
        const response = await fetch(`/api/payments/${currentPaymentUniqueId}/checkin`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Check-in failed');
        }

        showMessage('✅ Check-in successful!', 'success');

        // Reload payment data to show updated check-in status
        if (data.payment) {
            showResult(true, data.payment);
        } else {
            // Fallback: just hide the button and update text
            checkinBtn.classList.add('hidden');
            const statusP = document.querySelector('#result-details p:last-child');
            if (statusP) {
                statusP.innerHTML = '<strong>Check-In Status:</strong> ✅ Checked In at ' + new Date().toLocaleString();
            }
        }

        // Reset form
        document.getElementById('manual-checkin-form').reset();

    } catch (error) {
        console.error('Check-in error:', error);
        showMessage('❌ ' + (error.message || 'Check-in failed'), 'error');

        // Reset button
        checkinBtn.textContent = originalText;
        checkinBtn.disabled = false;
    }
}

// QR Scanner
async function startScanner() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const statusDiv = document.getElementById('scanner-status');
    const startBtn = document.getElementById('start-scan-btn');
    const stopBtn = document.getElementById('stop-scan-btn');

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
        });

        video.srcObject = videoStream;
        video.play();

        scanningActive = true;
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        statusDiv.textContent = '📷 Scanning... Point camera at QR code';
        statusDiv.className = 'scanner-status active';

        requestAnimationFrame(tick);

    } catch (error) {
        console.error('Camera access error:', error);
        statusDiv.textContent = '❌ Camera access denied';
        statusDiv.className = 'scanner-status error';
    }
}

function stopScanner() {
    scanningActive = false;

    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }

    const video = document.getElementById('video');
    video.srcObject = null;

    const startBtn = document.getElementById('start-scan-btn');
    const stopBtn = document.getElementById('stop-scan-btn');
    const statusDiv = document.getElementById('scanner-status');

    startBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    statusDiv.textContent = '';
    statusDiv.className = 'scanner-status';
}

function tick() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const statusDiv = document.getElementById('scanner-status');

    if (!scanningActive || video.readyState !== video.HAVE_ENOUGH_DATA) {
        if (scanningActive) {
            requestAnimationFrame(tick);
        }
        return;
    }

    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
        // QR code detected
        console.log('QR Code detected:', code.data);
        statusDiv.textContent = '✅ QR Code detected!';
        statusDiv.className = 'scanner-status success';

        stopScanner();

        // Process QR code data
        const payload = code.data;

        // Extract unique ID from payload (format: uniqueId:hmac)
        const [uniqueId] = payload.split(':');

        if (uniqueId && uniqueId.length === 8) {
            verifyPayment(uniqueId, payload);
        } else {
            showMessage('Invalid QR code format', 'error');
        }

        return;
    }

    if (scanningActive) {
        requestAnimationFrame(tick);
    }
}

// Format payment method
function formatPaymentMethod(method) {
    const methods = {
        'paymob-wallet': '📱 Mobile Wallet',
        'paymob-card': '💳 Card/Debit'
    };
    return methods[method] || method;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Logout
function logout() {
    stopScanner();
    authToken = null;
    localStorage.removeItem('checkinToken');
    showLogin();
    document.getElementById('login-form').reset();
    document.getElementById('result-section').classList.add('hidden');
}