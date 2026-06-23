let currentPage = 1;
let totalPages = 1;

async function loadUsers(page) {
    currentPage = page;
    const search = document.getElementById('searchInput').value;
    const status = document.getElementById('statusFilter').value;
    const creditMin = document.getElementById('creditMin').value;
    const creditMax = document.getElementById('creditMax').value;
    const sort = document.getElementById('sortSelect').value;

    const data = await request(`/admin/api/users?page=${page}&per_page=10&search=${encodeURIComponent(search)}&status=${status}&credit_min=${creditMin}&credit_max=${creditMax}&sort=${sort}`);
    if (data) {
        renderTable(data.data);
        renderPagination(data.total);
    }
}

function renderTable(users) {
    const tbody = document.getElementById('userTableBody');
    tbody.innerHTML = '';
    users.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.nickname || ''}</td>
            <td>${user.real_name || ''}</td>
            <td>${user.prefixed_id || ''}</td>
            <td>${user.status}</td>
            <td>${user.credit_score}</td>
            <td>${formatDateTime(user.created_at)}</td>
            <td>${formatDateTime(user.last_login_at)}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-info" onclick="viewUser(${user.id})">详情</button>
                ${user.status !== 'banned' ? `<button class="btn btn-sm btn-danger" onclick="showBanModal(${user.id})">封禁</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPagination(total) {
    const perPage = 10;
    totalPages = Math.ceil(total / perPage);
    const current = currentPage;
    const maxVisible = 5;
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }
    let html = '';
    if (start > 1) {
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadUsers(1)">1</button>`;
        if (start > 2) html += `<span class="mx-1">...</span>`;
    }
    for (let i = start; i <= end; i++) {
        html += `<button class="btn btn-sm ${i === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="loadUsers(${i})">${i}</button> `;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="mx-1">...</span>`;
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadUsers(${totalPages})">${totalPages}</button>`;
    }
    document.getElementById('pagination').innerHTML = html;
}
async function viewUser(id) {
    const data = await request(`/admin/api/users/${id}`);
    if (data) {
        const user = data.data.user;
        const posts = data.data.posts;
        const violations = data.data.violations;

        let html = `
            <p><strong>用户ID:</strong> ${user.id}</p>
            <p><strong>昵称:</strong> ${user.nickname || ''}</p>
            <p><strong>真实姓名:</strong> ${user.real_name || ''}</p>
            <p><strong>学号/工号:</strong> ${user.prefixed_id || ''}</p>
            <p><strong>状态:</strong> ${user.status}</p>
            <p><strong>信誉分:</strong> ${user.credit_score}</p>
            <p><strong>注册时间:</strong> ${formatDateTime(user.created_at)}</p>
            <h6 class="mt-3">发布记录</h6>
            <ul>${posts.map(p => `<li>${p.title} (${p.status}) - ${formatDateTime(p.created_at)}</li>`).join('') || '<li>无</li>'}</ul>
            <h6 class="mt-3">违规记录</h6>
            <ul>${violations.map(v => `<li>${v.reason} 扣${-v.change}分 - ${formatDateTime(v.created_at)}</li>`).join('') || '<li>无</li>'}</ul>
        `;
        document.getElementById('userDetailBody').innerHTML = html;
        new bootstrap.Modal(document.getElementById('userDetailModal')).show();
    }
}

function showBanModal(id) {
    document.getElementById('banUserId').value = id;
    new bootstrap.Modal(document.getElementById('banModal')).show();
}

async function banUser() {
    const id = document.getElementById('banUserId').value;
    const reason = document.getElementById('banReason').value;
    const data = await request(`/admin/api/users/${id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ reason })
    });
    if (data.code === 0) {
        alert('封禁成功');
        bootstrap.Modal.getInstance(document.getElementById('banModal')).hide();
        loadUsers(currentPage);
    } else {
        alert(data.message);
    }
}
function showCreditModal() {
    document.getElementById('creditMinInput').value = '';
    document.getElementById('creditMaxInput').value = '';
    new bootstrap.Modal(document.getElementById('creditModal')).show();
}

function applyCreditFilter() {
    const min = document.getElementById('creditMinInput').value;
    const max = document.getElementById('creditMaxInput').value;
    document.getElementById('creditMin').value = min;
    document.getElementById('creditMax').value = max;
    bootstrap.Modal.getInstance(document.getElementById('creditModal')).hide();
    loadUsers(1);
}
document.addEventListener('DOMContentLoaded', () => {
    // 状态筛选 change 事件
    document.getElementById('statusFilter').addEventListener('change', () => loadUsers(1));
    // 排序 change 事件
    document.getElementById('sortSelect').addEventListener('change', () => loadUsers(1));
    // 初始加载
    loadUsers(1);
});