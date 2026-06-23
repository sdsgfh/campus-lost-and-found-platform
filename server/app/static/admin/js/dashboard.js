let currentDays = 7; // 默认显示7天
let chartInstance = null;

// 加载概览卡片数据
async function loadOverview() {
    const data = await request('/admin/api/statistics/dashboard');
    if (data && data.code === 0) {
        const stats = data.data;
        // 今日新增
        document.getElementById('newUsersToday').innerText = stats.new_users_today || 0;
        document.getElementById('newVerifiedToday').innerText = stats.new_verified_today || 0;
        document.getElementById('newPostsToday').innerText = stats.new_posts_today || 0;
        document.getElementById('newTransactionsToday').innerText = stats.new_transactions_today || 0;
        document.getElementById('pendingReports').innerText = stats.pending_reports || 0;
        document.getElementById('pendingAppeals').innerText = stats.pending_appeals || 0;

        // 累计数据
        document.getElementById('totalUsers').innerText = stats.total_users || 0;
        document.getElementById('totalVerified').innerText = stats.total_verified || 0;
        document.getElementById('totalBanned').innerText = stats.total_banned || 0;
        document.getElementById('totalPosts').innerText = stats.total_posts || 0;
        document.getElementById('pendingReportsTotal').innerText = stats.pending_reports || 0;
        document.getElementById('pendingAppealsTotal').innerText = stats.pending_appeals || 0;
    }
}

// 加载趋势数据并绘制图表
async function loadTrends(days) {
    const data = await request(`/admin/api/statistics/trends?days=${days}`);
    if (data && data.code === 0) {
        const trends = data.data;
        const ctx = document.getElementById('trendChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trends.map(item => item.date),
                datasets: [
                    { label: '新增用户', data: trends.map(item => item.new_users), borderColor: '#2E7D32', backgroundColor: 'rgba(46,125,50,0.1)', tension: 0.1, fill: true },
                    { label: '新增发布', data: trends.map(item => item.new_posts), borderColor: '#2196F3', backgroundColor: 'rgba(33,150,243,0.1)', tension: 0.1, fill: true },
                    { label: '新增交易', data: trends.map(item => item.new_transactions), borderColor: '#FF9800', backgroundColor: 'rgba(255,152,0,0.1)', tension: 0.1, fill: true }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }
}

// 根据范围映射天数
function getDaysFromRange(range) {
    switch (range) {
        case 'day': return 7;      // 日视图：最近7天
        case 'week': return 30;     // 周视图：最近30天
        case 'month': return 90;    // 月视图：最近90天
        case 'year': return 365;    // 年视图：最近365天
        default: return 7;
    }
}

function changeRange(range) {
    const days = getDaysFromRange(range);
    currentDays = days;
    loadTrends(days);
}

document.addEventListener('DOMContentLoaded', () => {
    loadOverview();
    loadTrends(currentDays); // 默认加载7天

    document.querySelectorAll('.range-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            changeRange(this.dataset.range);
        });
    });
});