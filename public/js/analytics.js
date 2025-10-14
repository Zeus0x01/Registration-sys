// ==================== ANALYTICS FUNCTIONALITY ====================

let analyticsCharts = {};
let analyticsData = {};

// ==================== ANALYTICS INITIALIZATION ====================

function toggleAnalytics() {
    const section = document.getElementById('analytics-section');
    const btn = document.getElementById('toggle-analytics-btn');
    
    if (section.style.display === 'none') {
        section.style.display = 'block';
        btn.textContent = 'Hide Analytics';
        loadAnalyticsData();
    } else {
        section.style.display = 'none';
        btn.textContent = 'Show Analytics';
    }
}

async function loadAnalyticsData() {
    try {
        // Get all payments data for analytics
        const response = await fetch('/api/payments', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Failed to load analytics data');
        }
        
        analyticsData = data.payments;
        generateAnalyticsCharts();
        updateAnalyticsSummary();
        
    } catch (error) {
        console.error('Load analytics error:', error);
        showError('Failed to load analytics data', 'dashboard-error');
    }
}

function refreshAnalytics() {
    loadAnalyticsData();
    showSuccess('Analytics data refreshed');
}

// ==================== CHART GENERATION ====================

function generateAnalyticsCharts() {
    // Payment Trends Chart (Last 7 Days)
    generatePaymentTrendsChart();
    
    // Payment Methods Distribution
    generatePaymentMethodsChart();
}

function generatePaymentTrendsChart() {
    const ctx = document.getElementById('paymentTrendsChart');
    if (!ctx) return;
    
    // Get last 7 days data
    const last7Days = getLast7Days();
    const dailyCounts = last7Days.map(date => {
        return analyticsData.filter(payment => {
            const paymentDate = new Date(payment.createdAt).toDateString();
            return paymentDate === date.toDateString();
        }).length;
    });
    
    // Simple chart implementation (you can replace with Chart.js)
    drawSimpleBarChart(ctx, {
        labels: last7Days.map(date => date.toLocaleDateString('en-US', { weekday: 'short' })),
        data: dailyCounts,
        title: 'Payments per Day',
        color: '#667eea'
    });
}

function generatePaymentMethodsChart() {
    const ctx = document.getElementById('paymentMethodsChart');
    if (!ctx) return;
    
    const methodCounts = {
        'Mobile Wallet': analyticsData.filter(p => p.paymentMethod === 'paymob-wallet').length,
        'Card/Debit': analyticsData.filter(p => p.paymentMethod === 'paymob-card').length
    };
    
    drawSimplePieChart(ctx, {
        labels: Object.keys(methodCounts),
        data: Object.values(methodCounts),
        colors: ['#667eea', '#764ba2']
    });
}

function generateDailyRevenueChart() {
    const ctx = document.getElementById('dailyRevenueChart');
    if (!ctx) return;
    
    const last7Days = getLast7Days();
    const dailyRevenue = last7Days.map(date => {
        return analyticsData.filter(payment => {
            const paymentDate = new Date(payment.createdAt).toDateString();
            return paymentDate === date.toDateString() && payment.approved;
        }).reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    });
    
    drawSimpleBarChart(ctx, {
        labels: last7Days.map(date => date.toLocaleDateString('en-US', { weekday: 'short' })),
        data: dailyRevenue,
        title: 'Daily Revenue (EGP)',
        color: '#10b981'
    });
}

function generateStatusDistributionChart() {
    const ctx = document.getElementById('statusDistributionChart');
    if (!ctx) return;
    
    const statusCounts = {
        'Completed': analyticsData.filter(p => p.paymentStatus === 'completed').length,
        'Pending': analyticsData.filter(p => p.paymentStatus === 'pending').length,
        'Failed': analyticsData.filter(p => p.paymentStatus === 'failed').length
    };
    
    drawSimplePieChart(ctx, {
        labels: Object.keys(statusCounts),
        data: Object.values(statusCounts),
        colors: ['#10b981', '#f59e0b', '#ef4444']
    });
}

// ==================== SIMPLE CHART IMPLEMENTATION ====================

function drawSimpleBarChart(canvas, options) {
    const ctx = canvas.getContext('2d');
    const { labels, data, title, color } = options;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const padding = 30;
    const chartWidth = canvas.width - 2 * padding;
    const chartHeight = canvas.height - 2 * padding;
    const barWidth = chartWidth / labels.length;
    const maxValue = Math.max(...data);
    
    // Draw bars
    ctx.fillStyle = color;
    labels.forEach((label, index) => {
        const barHeight = (data[index] / maxValue) * chartHeight;
        const x = padding + index * barWidth + barWidth * 0.1;
        const y = canvas.height - padding - barHeight;
        
        ctx.fillRect(x, y, barWidth * 0.8, barHeight);
        
        // Draw value on top of bar
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(data[index], x + barWidth * 0.4, y - 5);
        ctx.fillStyle = color;
    });
    
    // Draw labels
    ctx.fillStyle = '#666';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    labels.forEach((label, index) => {
        const x = padding + index * barWidth + barWidth * 0.5;
        ctx.fillText(label, x, canvas.height - 5);
    });
    
    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 15);
}

function drawSimplePieChart(canvas, options) {
    const ctx = canvas.getContext('2d');
    const { labels, data, colors } = options;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 25;
    
    const total = data.reduce((sum, value) => sum + value, 0);
    let currentAngle = 0;
    
    // Draw pie slices
    data.forEach((value, index) => {
        const sliceAngle = (value / total) * 2 * Math.PI;
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.closePath();
        ctx.fillStyle = colors[index];
        ctx.fill();
        
        // Draw label
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius + 15);
        const labelY = centerY + Math.sin(labelAngle) * (radius + 15);
        
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${labels[index]}: ${value}`, labelX, labelY);
        
        currentAngle += sliceAngle;
    });
}

// ==================== ANALYTICS SUMMARY ====================

function updateAnalyticsSummary() {
    const today = new Date().toDateString();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    // Today's revenue
    const todayRevenue = analyticsData.filter(payment => {
        const paymentDate = new Date(payment.createdAt).toDateString();
        return paymentDate === today && payment.approved;
    }).reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    
    // This week's revenue
    const weekRevenue = analyticsData.filter(payment => {
        const paymentDate = new Date(payment.createdAt);
        return paymentDate >= weekAgo && payment.approved;
    }).reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    
    // Conversion rate (approved / total)
    const totalPayments = analyticsData.length;
    const approvedPayments = analyticsData.filter(p => p.approved).length;
    const conversionRate = totalPayments > 0 ? (approvedPayments / totalPayments * 100).toFixed(1) : 0;
    
    // Average processing time (simplified calculation)
    const avgProcessingTime = calculateAverageProcessingTime();
    
    // Update UI
    document.getElementById('today-revenue').textContent = `${todayRevenue.toFixed(2)} EGP`;
    document.getElementById('week-revenue').textContent = `${weekRevenue.toFixed(2)} EGP`;
    document.getElementById('conversion-rate').textContent = `${conversionRate}%`;
    document.getElementById('avg-processing-time').textContent = `${avgProcessingTime} min`;
}

function calculateAverageProcessingTime() {
    const approvedPayments = analyticsData.filter(p => p.approved && p.approvedAt);
    
    if (approvedPayments.length === 0) return 0;
    
    const totalTime = approvedPayments.reduce((sum, payment) => {
        const created = new Date(payment.createdAt);
        const approved = new Date(payment.approvedAt);
        return sum + (approved - created);
    }, 0);
    
    const avgTimeMs = totalTime / approvedPayments.length;
    return Math.round(avgTimeMs / (1000 * 60)); // Convert to minutes
}

// ==================== UTILITY FUNCTIONS ====================

function getLast7Days() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        days.push(date);
    }
    return days;
}

// Export functions to global scope
window.toggleAnalytics = toggleAnalytics;
window.refreshAnalytics = refreshAnalytics;
