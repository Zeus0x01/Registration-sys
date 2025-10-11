// Store price options data
let priceOptionsData = [];
let defaultPrice = 0;

// Load price options
async function loadPriceOptions() {
    try {
        const response = await fetch('/api/settings/public');
        const data = await response.json();

        if (!data.success) {
            showError('Unable to load pricing information.');
            return false;
        }

        defaultPrice = data.price;

        // Check if price options exist
        if (data.priceOptions) {
            try {
                priceOptionsData = JSON.parse(data.priceOptions);

                // If we have valid price options, show the dropdown
                if (Array.isArray(priceOptionsData) && priceOptionsData.length > 0) {
                    const selectElement = document.getElementById('selectedPrice');
                    selectElement.innerHTML = '<option value="">Choose an option...</option>';

                    // Add default price as first option
                    const defaultOptionElement = document.createElement('option');
                    defaultOptionElement.value = 'default';
                    const defaultAmount = defaultPrice % 1 === 0 ? parseInt(defaultPrice) : defaultPrice;
                    defaultOptionElement.textContent = `Standard - ${defaultAmount} EGP`;
                    selectElement.appendChild(defaultOptionElement);

                    // Add custom price options
                    priceOptionsData.forEach((option, index) => {
                        const optionElement = document.createElement('option');
                        optionElement.value = index;
                        const amount = option.amount % 1 === 0 ? parseInt(option.amount) : option.amount;
                        optionElement.textContent = `${option.label} - ${amount} EGP`;
                        selectElement.appendChild(optionElement);
                    });

                    document.getElementById('price-selection').classList.remove('hidden');
                    document.getElementById('price-display').classList.add('hidden');
                    return true;
                }
            } catch (error) {
                console.error('Error parsing price options:', error);
            }
        }

        // If no price options, show default price
        const displayPrice = defaultPrice % 1 === 0 ? parseInt(defaultPrice) : defaultPrice;
        document.getElementById('defaultPrice').textContent = `${displayPrice} EGP`;
        document.getElementById('price-selection').classList.add('hidden');
        document.getElementById('price-display').classList.remove('hidden');
        return true;

    } catch (error) {
        console.error('Error loading price options:', error);
        showError('Unable to load pricing information.');
        return false;
    }
}

// Check if payment system is active
async function checkSystemStatus() {
    try {
        const response = await fetch('/api/settings/public');
        const data = await response.json();

        if (!data.success || !data.isActive) {
            showError('Payment system is currently inactive. Please check back later.');
            document.getElementById('payment-form').style.display = 'none';
            return false;
        }
        return true;
    } catch (error) {
        console.error('Error checking system status:', error);
        showError('Unable to connect to server. Please try again later.');
        document.getElementById('payment-form').style.display = 'none';
        return false;
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

// Hide error message
function hideError() {
    const errorDiv = document.getElementById('error-message');
    errorDiv.classList.add('hidden');
}

// Toggle wallet number field based on payment method
function togglePaymentFields() {
    const checkedRadio = document.querySelector('input[name="paymentMethod"]:checked');
    if (!checkedRadio) return;

    const paymentMethod = checkedRadio.value;
    const walletFields = document.getElementById('wallet-fields');
    const walletNumber = document.getElementById('walletNumber');

    if (paymentMethod === 'paymob-wallet') {
        walletFields.classList.remove('hidden');
        walletNumber.required = true;
    } else {
        walletFields.classList.add('hidden');
        walletNumber.required = false;
        walletNumber.value = '';
    }
}

// Add event listeners to payment method radio buttons
document.querySelectorAll('input[name="paymentMethod"]').forEach(radio => {
    radio.addEventListener('change', togglePaymentFields);
});

// Handle form submission
document.getElementById('payment-form').addEventListener('submit', async(e) => {
    e.preventDefault();
    hideError();

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

    const formData = {
        userName: document.getElementById('userName').value.trim(),
        userEmail: document.getElementById('userEmail').value.trim(),
        userPhone: document.getElementById('userPhone').value.trim(),
        paymentMethod: paymentMethod
    };

    // Add selected price option if available
    const priceSelection = document.getElementById('price-selection');
    if (!priceSelection.classList.contains('hidden')) {
        const selectedValue = document.getElementById('selectedPrice').value;
        if (!selectedValue) {
            showError('Please select a price option');
            resetSubmitButton();
            return;
        }
        // If 'default' is selected, don't send selectedPriceIndex (will use default price on backend)
        // Otherwise, send the index of the selected custom price option
        if (selectedValue !== 'default') {
            formData.selectedPriceIndex = parseInt(selectedValue);
        }
    }

    // Add wallet number if mobile wallet is selected
    if (paymentMethod === 'paymob-wallet') {
        const walletNumber = document.getElementById('walletNumber').value.trim();
        if (!walletNumber || walletNumber.length !== 11) {
            showError('Please enter a valid 11-digit wallet number');
            resetSubmitButton();
            return;
        }
        formData.walletNumber = walletNumber;
    }

    try {
        const response = await fetch('/api/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Payment creation failed');
        }

        // Store payment data for later use
        sessionStorage.setItem('currentPayment', JSON.stringify(data.payment));

        // Handle payment based on method
        if (paymentMethod === 'paymob-wallet') {
            // For wallet, show iframe with wallet payment
            if (data.useIframe && data.paymentUrl) {
                showPaymobIframe(data.paymentUrl);
            } else {
                throw new Error('Payment URL not provided');
            }
        } else if (paymentMethod === 'paymob-card') {
            // For card, show iframe with card payment
            if (data.useIframe && data.paymentUrl) {
                showPaymobIframe(data.paymentUrl);
            } else {
                throw new Error('Payment URL not provided');
            }
        } else {
            throw new Error('Invalid payment method');
        }

    } catch (error) {
        console.error('Payment error:', error);
        showError(error.message || 'Failed to process payment. Please try again.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Proceed to Payment';
    }
});

// Show Paymob iframe modal
function showPaymobIframe(paymentUrl) {
    const modal = document.getElementById('paymob-modal');
    const iframe = document.getElementById('paymob-iframe');

    iframe.src = paymentUrl;
    modal.classList.remove('hidden');

    // Listen for postMessage from Paymob iframe
    window.addEventListener('message', handlePaymobMessage);
}

// Handle messages from Paymob iframe
async function handlePaymobMessage(event) {
    // Verify origin (Paymob domain)
    if (!event.origin.includes('paymob.com') && !event.origin.includes('accept.paymob.com')) {
        return;
    }

    const data = event.data;
    console.log('Paymob message received:', data);

    // Check for success or failure
    if (data.success === true || data.type === 'success') {
        // Payment successful, wait a moment for webhook processing
        setTimeout(async() => {
            await verifyPaymentAndShowSuccess();
        }, 2000);
    } else if (data.success === false || data.type === 'error' || data.type === 'cancel') {
        closePaymobModal();
        showError('Payment was cancelled or failed. Please try again.');
        resetSubmitButton();
    }
}

// Verify payment and show success modal
async function verifyPaymentAndShowSuccess() {
    const paymentData = JSON.parse(sessionStorage.getItem('currentPayment'));

    if (!paymentData || !paymentData.uniqueId) {
        closePaymobModal();
        showError('Payment verification failed. Please contact support.');
        resetSubmitButton();
        return;
    }

    try {
        // Fetch payment details to confirm completion
        const response = await fetch(`/api/payments/${paymentData.uniqueId}`, {
            headers: {
                'Authorization': 'Bearer guest' // Will fail auth but still return data if QR is valid
            }
        });

        const data = await response.json();

        // Close iframe
        closePaymobModal();

        if (data.success && data.payment && data.payment.qrCodeImage) {
            showSuccessModal(data.payment);
            sessionStorage.removeItem('currentPayment');
        } else {
            // Payment not yet confirmed, show message
            showError('Payment is being processed. Please wait for confirmation email.');
            resetSubmitButton();
        }

    } catch (error) {
        console.error('Verification error:', error);
        closePaymobModal();
        showError('Payment verification failed. Please check your email for confirmation.');
        resetSubmitButton();
    }
}

// Close Paymob modal
function closePaymobModal() {
    const modal = document.getElementById('paymob-modal');
    const iframe = document.getElementById('paymob-iframe');

    modal.classList.add('hidden');
    iframe.src = '';

    window.removeEventListener('message', handlePaymobMessage);
}

// Show success modal with QR code
function showSuccessModal(payment) {
    const modal = document.getElementById('success-modal');
    const qrImage = document.getElementById('qr-code-image');
    const uniqueIdDisplay = document.getElementById('unique-id-display');

    qrImage.src = payment.qrCodeImage;
    uniqueIdDisplay.textContent = payment.uniqueId;

    modal.classList.remove('hidden');
}

// Download QR code
function downloadQR() {
    const qrImage = document.getElementById('qr-code-image');
    const uniqueId = document.getElementById('unique-id-display').textContent;

    const link = document.createElement('a');
    link.download = `event-ticket-${uniqueId}.png`;
    link.href = qrImage.src;
    link.click();
}

// Reset submit button
function resetSubmitButton() {
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Proceed to Payment';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async() => {
    await loadPriceOptions();
    await checkSystemStatus();
    togglePaymentFields(); // Initialize wallet fields visibility
});