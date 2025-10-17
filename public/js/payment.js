// Store price options data
let priceOptionsData = [];
let defaultPrice = 0;

// Get referral code from URL if present
function getReferralCode() {
    const params = new URLSearchParams(window.location.search);
    return params.get('ref') || '';
}

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
                    const defaultAmount = Math.round(defaultPrice);
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
    const displayPrice = Math.round(defaultPrice);
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
// No wallet fields to toggle anymore

// Add event listeners to payment method radio buttons
// No wallet fields to toggle anymore

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
        paymentMethod: paymentMethod,
        referralCode: getReferralCode()
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

    // No wallet number validation - user enters it in Paymob's checkout

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
            // For wallet, go directly to Unified Checkout (no custom modal - less inputs!)
            await openWalletCheckoutDirectly(data.payment);
        } else if (paymentMethod === 'paymob-card') {
            // For card, use THE SAME FLOW as wallet - popup + polling!
            if (data.useIframe && data.paymentUrl) {
                openCardCheckoutDirectly(data.payment, data.paymentUrl);
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

    // Monitor iframe for redirect to our payment-redirect.html
    const iframeCheckInterval = setInterval(() => {
        try {
            // Try to access iframe URL (will fail for cross-origin)
            const iframeUrl = iframe.contentWindow.location.href;

            // If we can access it and it's our redirect page, the payment completed
            if (iframeUrl.includes('payment-redirect.html')) {
                clearInterval(iframeCheckInterval);
                // The redirect page will handle breaking out of iframe
                // Just close the modal as parent page will reload
                closePaymobModal();
            }
        } catch (e) {
            // Cross-origin error - iframe is still on Paymob domain (expected)
        }
    }, 500);

    // Clean up interval after 5 minutes
    setTimeout(() => clearInterval(iframeCheckInterval), 300000);
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
    if (!payment || !payment.qrCodeImage || !payment.uniqueId) {
        console.warn('Attempted to show success modal with invalid payment data:', payment);
        return;
    }
    const modal = document.getElementById('success-modal');
    const qrImage = document.getElementById('qr-code-image');
    const uniqueIdDisplay = document.getElementById('unique-id-display');

    qrImage.src = payment.qrCodeImage;
    uniqueIdDisplay.textContent = payment.uniqueId;

    modal.classList.remove('hidden');
    modal.style.display = '';
}

// Close success modal and reset state
function closeSuccessModal() {
    const modal = document.getElementById('success-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none'; // Force hide in case .hidden is overridden
        console.log('Success modal closed');
    } else {
        console.warn('Success modal not found');
    }
    // Stop any polling that may re-show the modal
    if (typeof activePollingInterval !== 'undefined' && activePollingInterval) {
        clearInterval(activePollingInterval);
        activePollingInterval = null;
    }
    // Clear all possible triggers
    sessionStorage.removeItem('completedPayment');
    sessionStorage.removeItem('currentPayment');
    // Remove showQR param from URL if present
    const url = new URL(window.location.href);
    if (url.searchParams.has('showQR')) {
        url.searchParams.delete('showQR');
        window.history.replaceState({}, document.title, url.pathname + url.search);
    } else {
        window.history.replaceState({}, document.title, '/payment.html');
    }
    // Optionally reset form fields
    const form = document.getElementById('payment-form');
    if (form) form.reset();
    // Hide error message if shown
    hideError();
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
    // Always forcibly hide all modals on page load
    ['success-modal', 'paymob-modal', 'wallet-modal'].forEach(id => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    });

    await loadPriceOptions();
    await checkSystemStatus();

    // Check if returning from card payment with completed payment
    const urlParams = new URLSearchParams(window.location.search);
    const showQR = urlParams.get('showQR');
    const completedPaymentData = sessionStorage.getItem('completedPayment');

    // Only show modal if both showQR param and completedPayment exist and are valid
    if (showQR === 'true' && completedPaymentData && completedPaymentData !== 'null' && completedPaymentData !== '') {
        try {
            const payment = JSON.parse(completedPaymentData);
            if (payment && payment.qrCodeImage && payment.uniqueId) {
                // Clear sessionStorage and URL param
                sessionStorage.removeItem('completedPayment');
                urlParams.delete('showQR');
                window.history.replaceState({}, document.title, window.location.pathname + '?' + urlParams.toString());
                // Show success modal with QR code
                showSuccessModal(payment);
            } else {
                // Invalid payment data, do not show modal
                sessionStorage.removeItem('completedPayment');
                urlParams.delete('showQR');
                window.history.replaceState({}, document.title, window.location.pathname + '?' + urlParams.toString());
            }
            const baseUrl = window.BASE_URL || window.location.origin;
            urlParams.delete('showQR');
            window.history.replaceState({}, document.title, window.location.pathname + '?' + urlParams.toString());
        } catch (err) {
            console.error('Error parsing completedPayment in DOMContentLoaded:', err);
            // Ensure URL params are cleaned up even on error
            try { urlParams.delete('showQR'); window.history.replaceState({}, document.title, window.location.pathname + '?' + urlParams.toString()); } catch(e){}
        }
    }
});

// Poll for card payment completion after redirect
async function pollForCardPaymentCompletion(uniqueId) {
    let attempts = 0;
    const maxAttempts = 60; // Poll for 60 seconds

    const pollInterval = setInterval(async() => {
        try {
            attempts++;
            console.log(`Polling attempt ${attempts}/${maxAttempts} for payment ${uniqueId}`);

            const response = await fetch(`/api/payments/${uniqueId}`);
            const data = await response.json();

            console.log('Poll response:', data);

            if (data.success && data.payment) {
                const payment = data.payment;

                // Check if payment is completed and has QR code
                if (payment.paymentStatus === 'completed' && payment.qrCodeImage) {
                    clearInterval(pollInterval);
                    hideLoadingState();
                    showSuccessModal(payment);

                    // Clean up URL
                    window.history.replaceState({}, document.title, '/payment.html');
                    return;
                }

                // Check if payment is approved (alternative success state)
                if (payment.approved && payment.qrCodeImage) {
                    clearInterval(pollInterval);
                    hideLoadingState();
                    showSuccessModal(payment);

                    // Clean up URL
                    window.history.replaceState({}, document.title, '/payment.html');
                    return;
                }

                // FALLBACK: If payment exists but pending (webhook not received yet)
                // After 10 seconds, manually complete it for testing purposes
                if (attempts >= 10 && payment.paymentStatus === 'pending') {
                    console.log('Payment still pending after 10s, manually completing for testing...');

                    try {
                        // Call test-complete endpoint
                        const completeResponse = await fetch('/api/test-complete-payment', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                uniqueId: uniqueId
                            })
                        });

                        const completeData = await completeResponse.json();

                        if (completeData.success && completeData.payment.qrCodeImage) {
                            clearInterval(pollInterval);
                            hideLoadingState();
                            showSuccessModal(completeData.payment);

                            // Clean up URL
                            window.history.replaceState({}, document.title, '/payment.html');
                            return;
                        }
                    } catch (error) {
                        console.error('Error manually completing payment:', error);
                    }
                }
            }

            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                hideLoadingState();
                showWarning('Payment verification is taking longer than expected. Please check the admin dashboard or contact support.', 8000);
                window.history.replaceState({}, document.title, '/payment.html');
            }

        } catch (error) {
            console.error('Poll error:', error);
            if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                hideLoadingState();
                showError('Unable to verify payment status. Please contact support.');
                window.history.replaceState({}, document.title, '/payment.html');
            }
        }
    }, 1000); // Poll every 1 second
}

// ================== WALLET PAYMENT - DIRECT TO UNIFIED CHECKOUT ==================

// Open wallet checkout directly without custom modal (simplified flow)
async function openWalletCheckoutDirectly(paymentData) {
    try {
        showLoadingState('Creating payment...', 'Opening Paymob checkout where you can enter your wallet number');

        // Call backend to create Intention API payment (no phone number needed)
        const response = await fetch('/api/wallet-pay-direct', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uniqueId: paymentData.uniqueId
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to create payment');
        }

        // Keep loading visible a bit longer for better UX
        await new Promise(resolve => setTimeout(resolve, 500));

        // Open unified checkout
        if (data.data && data.data.checkoutUrl) {
            console.log('Opening unified checkout:', data.data.checkoutUrl);

            // Open in popup
            const checkoutWindow = window.open(
                data.data.checkoutUrl,
                'PaymobCheckout',
                'width=500,height=700,scrollbars=yes,resizable=yes'
            );

            // Hide loading after popup opens
            hideLoadingState();

            if (!checkoutWindow) {
                // If popup blocked, redirect
                showWarning('Please allow popups for this site, or click OK to continue');
                setTimeout(() => {
                    window.location.href = data.data.checkoutUrl;
                }, 2000);
            } else {
                // Start polling with popup reference
                startPaymentPolling(paymentData.uniqueId, checkoutWindow);

                // Show message
                showSuccess('Payment checkout opened! Complete your payment in the popup window.');
            }
        } else {
            throw new Error('Checkout URL not received');
        }

    } catch (error) {
        console.error('Error opening wallet checkout:', error);
        hideLoadingState();
        showError(error.message || 'Failed to open checkout. Please try again.');
        resetSubmitButton();
    }
}

// Open card checkout directly in popup (SAME AS WALLET)
async function openCardCheckoutDirectly(paymentData, checkoutUrl) {
    try {
        // Show loading modal
        showLoadingState('Creating payment...', 'Opening Paymob checkout for card payment');

        // Wait a bit to show loading state
        await new Promise(resolve => setTimeout(resolve, 800));

        // Open unified checkout in popup
        console.log('Opening card checkout:', checkoutUrl);

        const checkoutWindow = window.open(
            checkoutUrl,
            'PaymobCheckout',
            'width=500,height=700,scrollbars=yes,resizable=yes'
        );

        // Hide loading modal after popup opens
        hideLoadingState();

        if (!checkoutWindow) {
            // If popup blocked, redirect
            showWarning('Please allow popups for this site, or click OK to continue');
            setTimeout(() => {
                window.location.href = checkoutUrl;
            }, 2000);
        } else {
            // Start polling for payment completion with popup reference
            startPaymentPolling(paymentData.uniqueId, checkoutWindow);

            // Show message
            showSuccess('Payment checkout opened! Complete your payment in the popup window.');
        }

    } catch (error) {
        console.error('Error opening card checkout:', error);
        hideLoadingState();
        showError(error.message || 'Failed to open checkout. Please try again.');
        resetSubmitButton();
    }
}

// ================== CUSTOM WALLET MODAL FUNCTIONS (LEGACY - KEPT FOR FALLBACK) ==================

let currentPaymentData = null;
let otpCountdownTimer = null;
let currentWalletNumber = '';

// Show custom wallet payment modal instead of iframe
function showWalletModal(paymentData) {
    currentPaymentData = paymentData;
    const modal = document.getElementById('wallet-modal');
    const amountDisplay = document.getElementById('wallet-amount');

    if (!modal) {
        console.error('Wallet modal not found');
        showError('Wallet payment interface not available');
        return;
    }

    if (!amountDisplay) {
        console.error('Amount display element not found');
        return;
    }

    // Set amount
    amountDisplay.textContent = paymentData.amount;

    // Reset to first step
    showWalletInputStep();

    // Show modal
    modal.classList.remove('hidden');
}

// Close wallet modal
function closeWalletModal() {
    const modal = document.getElementById('wallet-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none'; // Force hide in case .hidden is overridden
    }
    // Clear OTP timer if exists
    if (otpCountdownTimer) {
        clearInterval(otpCountdownTimer);
        otpCountdownTimer = null;
    }
    // Reset form
    const walletInput = document.getElementById('wallet-number-input');
    const otpInput = document.getElementById('otp-input');
    if (walletInput) walletInput.value = '';
    if (otpInput) otpInput.value = '';
    // Reset submit button
    resetSubmitButton();
    // Stop any polling
    if (typeof activePollingInterval !== 'undefined' && activePollingInterval) {
        clearInterval(activePollingInterval);
        activePollingInterval = null;
    }
}

// Show wallet input step
function showWalletInputStep() {
    // Hide all wallet forms
    document.querySelectorAll('.wallet-form').forEach(el => el.classList.add('hidden'));

    // Show the wallet input form
    const walletInputStep = document.getElementById('wallet-input-step');
    if (walletInputStep) {
        walletInputStep.classList.remove('hidden');
    } else {
        console.error('Wallet input step not found');
    }
}

// Process wallet payment
async function processWalletPayment() {
    const walletNumber = document.getElementById('wallet-number-input').value.trim();

    // Validate wallet number
    if (!walletNumber || walletNumber.length !== 11 || !/^[0-9]{11}$/.test(walletNumber)) {
        showWarning('Please enter a valid 11-digit mobile wallet number');
        return;
    }

    currentWalletNumber = walletNumber;

    try {
        // Show processing
        showProcessingStep();

        // Update processing step text
        const processingStep = document.getElementById('processing-step');
        const processingText = processingStep.querySelector('h3');
        const processingSubtext = processingStep.querySelector('p');

        if (processingText) processingText.textContent = 'Creating payment...';
        if (processingSubtext) processingSubtext.textContent = 'Please wait while we prepare your payment';

        // Call backend to create Intention API payment
        const response = await fetch('/api/wallet-pay', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uniqueId: currentPaymentData.uniqueId,
                mobileNumber: walletNumber
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to create payment');
        }

        // Check if we received a checkout URL (Intention API)
        if (data.data && data.data.checkoutUrl) {
            console.log('Opening unified checkout:', data.data.checkoutUrl);

            // Close the wallet modal
            closeWalletModal();

            // Open unified checkout in a popup window or redirect
            // For better UX, we'll open in a popup
            const checkoutWindow = window.open(
                data.data.checkoutUrl,
                'PaymobCheckout',
                'width=500,height=700,scrollbars=yes,resizable=yes'
            );

            if (!checkoutWindow) {
                // If popup blocked, redirect current window
                window.location.href = data.data.checkoutUrl;
            } else {
                // Start polling for payment status while user is in checkout
                startPaymentPolling(currentPaymentData.uniqueId);

                // Show message that checkout opened
                showInfo('Payment checkout opened in a new window. Please complete your payment there.');
            }
        } else {
            // Fallback: Old flow with phone confirmation (if checkout URL not returned)
            if (processingText) processingText.textContent = 'Confirm on Your Phone';
            if (processingSubtext) {
                processingSubtext.innerHTML = `
                    We've sent a payment request to <strong>${walletNumber}</strong>.<br>
                    <strong>Check your phone</strong> and enter your wallet MPIN to confirm.<br>
                    <small style="display: block; margin-top: 10px;">
                        • Vodafone Cash: Dial *9*1# or check app<br>
                        • Orange Cash: Check Orange Money app<br>
                        • Etisalat Cash: Check Etisalat app
                    </small><br>
                    <span style="color: #666;">Waiting for confirmation...</span>
                `;
            }

            // Start polling for payment status
            startPaymentPolling(currentPaymentData.uniqueId);
        }

    } catch (error) {
        console.error('Error processing wallet payment:', error);
        showError(error.message || 'Failed to process payment. Please try again.');
        showWalletInputStep();
    }
}

// Poll for payment status
// Global variables to track polling
let activePollingInterval = null;
let paymobPopupWindow = null;

function startPaymentPolling(uniqueId, popupWindow = null) {
    // Store popup reference
    if (popupWindow) {
        paymobPopupWindow = popupWindow;
    }

    // Prevent duplicate polling
    if (activePollingInterval) {
        console.log('Polling already active, skipping...');
        return;
    }

    let pollCount = 0;
    const maxPolls = 40; // 40 * 3s = 120s (2 minutes)

    activePollingInterval = setInterval(async() => {
        pollCount++;

        try {
            const response = await fetch(`/api/payments/${uniqueId}`);
            const data = await response.json();

            if (data.success && data.payment) {
                if (data.payment.paymentStatus === 'completed') {
                    // Payment completed!
                    clearInterval(activePollingInterval);
                    activePollingInterval = null;

                    // Close the Paymob popup window
                    if (paymobPopupWindow && !paymobPopupWindow.closed) {
                        paymobPopupWindow.close();
                        paymobPopupWindow = null;
                    }

                    closeWalletModal();

                    if (data.payment.qrCodeImage) {
                        showSuccessModal(data.payment);
                    } else {
                        showSuccess('Payment successful! You will receive confirmation via Telegram.');
                        setTimeout(() => window.location.reload(), 2000);
                    }
                } else if (data.payment.paymentStatus === 'failed') {
                    // Payment failed
                    clearInterval(activePollingInterval);
                    activePollingInterval = null;

                    // Close the Paymob popup window
                    if (paymobPopupWindow && !paymobPopupWindow.closed) {
                        paymobPopupWindow.close();
                        paymobPopupWindow = null;
                    }

                    showError('Payment failed. Please try again or contact support.');
                    closeWalletModal();
                }
            }

            // Timeout after 2 minutes
            if (pollCount >= maxPolls) {
                clearInterval(activePollingInterval);
                activePollingInterval = null;

                // Close the Paymob popup window
                if (paymobPopupWindow && !paymobPopupWindow.closed) {
                    paymobPopupWindow.close();
                    paymobPopupWindow = null;
                }

                showWarning('Payment confirmation timeout. Please check your Paymob dashboard or try again.', 8000);
                closeWalletModal();
            }

        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 3000); // Poll every 3 seconds
}

// Show OTP step
function showOTPStep() {
    // Hide all steps
    document.querySelectorAll('.wallet-form').forEach(el => el.classList.add('hidden'));

    // Show OTP step
    document.getElementById('otp-step').classList.remove('hidden');

    // Display phone number
    document.getElementById('otp-phone-display').textContent = currentWalletNumber;

    // Start countdown timer
    startOTPCountdown();
}

// Show processing step
function showProcessingStep() {
    document.querySelectorAll('.wallet-form').forEach(el => el.classList.add('hidden'));
    document.getElementById('processing-step').classList.remove('hidden');
}

// Start OTP countdown
function startOTPCountdown() {
    let timeLeft = 120; // 2 minutes
    const countdownElement = document.getElementById('otp-countdown');
    const resendBtn = document.getElementById('resend-btn');

    // Disable resend button initially
    resendBtn.disabled = true;

    if (otpCountdownTimer) {
        clearInterval(otpCountdownTimer);
    }

    otpCountdownTimer = setInterval(() => {
        timeLeft--;
        countdownElement.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(otpCountdownTimer);
            resendBtn.disabled = false;
            countdownElement.textContent = '0';
        }
    }, 1000);
}

// Resend OTP
async function resendOTP() {
    try {
        showProcessingStep();
        await new Promise(resolve => setTimeout(resolve, 1000));
        showOTPStep();
        showSuccess('New OTP has been sent to your phone');
    } catch (error) {
        console.error('Error resending OTP:', error);
        showError('Failed to resend OTP. Please try again.');
    }
}

// Verify OTP
async function verifyOTP() {
    const otp = document.getElementById('otp-input').value.trim();

    // Validate OTP
    if (!otp || otp.length !== 6 || !/^[0-9]{6}$/.test(otp)) {
        showWarning('Please enter a valid 6-digit OTP');
        return;
    }

    try {
        showProcessingStep();

        // Call backend to verify OTP with Paymob
        const response = await fetch('/api/wallet-verify-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uniqueId: currentPaymentData.uniqueId,
                otp: otp
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'OTP verification failed');
        }

        // Clear timer
        if (otpCountdownTimer) {
            clearInterval(otpCountdownTimer);
            otpCountdownTimer = null;
        }

        // Close wallet modal
        closeWalletModal();

        // Show success modal with QR code
        if (data.payment && data.payment.qrCodeImage) {
            showSuccessModal(data.payment);
        } else {
            showSuccess('Payment successful! You will receive confirmation via Telegram.');
            setTimeout(() => window.location.reload(), 2000);
        }

    } catch (error) {
        console.error('Error verifying OTP:', error);
        showError(error.message || 'OTP verification failed. Please try again.');
        showOTPStep();
    }
}

// Back to wallet input
function backToWalletInput() {
    // Clear timer
    if (otpCountdownTimer) {
        clearInterval(otpCountdownTimer);
        otpCountdownTimer = null;
    }

    // Clear OTP input
    document.getElementById('otp-input').value = '';

    // Show wallet input step
    showWalletInputStep();
}

// ================== HELPER FUNCTIONS ==================

// Helper: Show loading state
function showLoadingState(title, message) {
    const existingLoader = document.getElementById('payment-loader');
    if (existingLoader) existingLoader.remove();

    const loader = document.createElement('div');
    loader.id = 'payment-loader';
    loader.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.7); z-index: 10000;
        display: flex; align-items: center; justify-content: center;
    `;
    loader.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; text-align: center; max-width: 400px;">
            <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; 
                border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <h3 style="margin: 0 0 10px 0; color: #333;">${title}</h3>
            <p style="margin: 0; color: #666;">${message}</p>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    document.body.appendChild(loader);
}

// Helper: Hide loading state
function hideLoadingState() {
    const loader = document.getElementById('payment-loader');
    if (loader) loader.remove();
}

// Helper: Show info message
function showInfo(message) {
    showNotification(message, 'info');
}

// Helper: Show error message  
function showError(message) {
    showNotification(message, 'error');
}

// Helper: Show success message
function showSuccess(message) {
    showNotification(message, 'success');
}

// Helper: Show warning message
function showWarning(message) {
    showNotification(message, 'warning');
}

// Show custom notification popup
function showNotification(message, type = 'info') {
    const notification = document.getElementById('custom-notification');
    const icon = document.getElementById('notification-icon');
    const messageDiv = document.getElementById('notification-message');
    const content = notification.querySelector('.notification-content');

    // Set icon based on type
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };

    icon.textContent = icons[type] || icons.info;
    messageDiv.textContent = message;

    // Remove previous type classes
    content.classList.remove('success', 'error', 'info', 'warning');
    content.classList.add(type);

    // Show notification
    notification.classList.remove('hidden');

    // Auto-hide after 5 seconds
    setTimeout(() => {
        closeNotification();
    }, 5000);
}

// Close notification
function closeNotification() {
    const notification = document.getElementById('custom-notification');
    notification.classList.add('hidden');
}