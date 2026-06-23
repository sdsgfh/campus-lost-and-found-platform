let dailyRange = 30; // 默认30天
let dailyChart = null;
let authChartInstance = null;
let postTypeChartInstance = null;

// 加载统计数据并绘制图表
async function loadStatistics() {
    // 获取仪表盘数据（包含累计统计）
    const data = await request('/admin/api/statistics/dashboard');
    if (data && data.code === 0) {
        const stats = data.data;
        document.getElementById('statTotalUsers').innerText = stats.total_users || 0;
        document.getElementById('statTotalPosts').innerText = stats.total_posts || 0;
        document.getElementById('statTotalTransactions').innerText = stats.total_transactions || 0;
        const authRate = stats.total_users > 0 ? ((stats.total_verified / stats.total_users) * 100).toFixed(1) : 0;
        document.getElementById('statAuthRate').innerText = authRate + '%';
    }

    // 获取用户认证分布数据
    await loadAuthDistribution();
    // 获取发布类型分布数据
    await loadPostTypeDistribution();
    // 获取每日趋势数据
    await loadDailyTrend(dailyRange);
}

// 用户认证分布
async function loadAuthDistribution() {
    const data = await request('/admin/api/statistics/auth-distribution');
    if (data && data.code === 0) {
        renderAuthChart(data.data);
    } else {
        console.error('获取认证分布失败');
    }
}

function renderAuthChart(authData) {
    const ctx = document.getElementById('authChart').getContext('2d');
    if (authChartInstance) authChartInstance.destroy();
    authChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['未认证', '已认证', '已注销', '已封禁'],
            datasets: [{
                data: [
                    authData.find(d => d.status === 'unverified')?.count || 0,
                    authData.find(d => d.status === 'verified')?.count || 0,
                    authData.find(d => d.status === 'cancelled')?.count || 0,
                    authData.find(d => d.status === 'banned')?.count || 0
                ],
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#E7E9ED']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 25  // 饼图缩小
            }
        }
    });
}

// 发布类型分布
async function loadPostTypeDistribution() {
    const data = await request('/admin/api/statistics/post-type-distribution');
    if (data && data.code === 0) {
        renderPostTypeChart(data.data);
    } else {
        console.error('获取发布类型分布失败');
    }
}

function renderPostTypeChart(postData) {
    const ctx = document.getElementById('postTypeChart').getContext('2d');
    if (postTypeChartInstance) postTypeChartInstance.destroy();
    postTypeChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['寻物', '招领', '出售', '求购'],
            datasets: [{
                label: '发布数量',
                data: [
                    postData.find(d => d.type === 'lost')?.count || 0,
                    postData.find(d => d.type === 'found')?.count || 0,
                    postData.find(d => d.type === 'sale')?.count || 0,
                    postData.find(d => d.type === 'wanted')?.count || 0
                ],
                backgroundColor: '#36A2EB'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: 10
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            },
            // 显示柱子数值
            plugins: {
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    formatter: Math.round,
                    font: { size: 12 }
                }
            }
        }
    });
}

// 每日趋势
async function loadDailyTrend(days) {
    const data = await request(`/admin/api/statistics/trends?days=${days}`);
    if (data && data.code === 0) {
        renderDailyTrend(data.data);
    } else {
        console.error('获取每日趋势失败');
    }
}

function renderDailyTrend(trendData) {
    if (dailyChart) dailyChart.destroy();
    const ctx = document.getElementById('dailyTrendChart').getContext('2d');
    dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: trendData.map(item => item.date),
            datasets: [
                { label: '新增用户', data: trendData.map(item => item.new_users), borderColor: '#2E7D32', backgroundColor: 'rgba(46,125,50,0.1)', fill: true },
                { label: '新增发布', data: trendData.map(item => item.new_posts), borderColor: '#2196F3', backgroundColor: 'rgba(33,150,243,0.1)', fill: true }
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

document.addEventListener('DOMContentLoaded', () => {
    loadStatistics();

    // 绑定时间范围切换按钮
    document.querySelectorAll('[data-range]').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('[data-range]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            dailyRange = parseInt(this.dataset.range);
            loadDailyTrend(dailyRange);
        });
    });
});