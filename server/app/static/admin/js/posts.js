let currentPage = 1;
let totalPages = 1;
let currentPostId = null;

async function loadPosts(page) {
    currentPage = page;
    const search = document.getElementById('searchInput').value;
    const status = document.getElementById('statusFilter').value;
    const type = document.getElementById('typeFilter').value;
    const sort = document.getElementById('sortSelect').value;

    const data = await request(`/admin/api/posts?page=${page}&per_page=10&search=${encodeURIComponent(search)}&status=${status}&type=${type}&sort=${sort}`);
    if (data) {
        renderTable(data.data);
        renderPagination(data.total);
    }
}

function renderTable(posts) {
    const tbody = document.getElementById('postTableBody');
    tbody.innerHTML = '';
    posts.forEach(p => {
        const tr = document.createElement('tr');
        // 构建操作按钮：始终有详情按钮，仅 active 状态添加下架按钮
        let actionsHtml = `<button class="btn btn-sm btn-info" onclick="viewPost(${p.id})">详情</button>`;
        if (p.status === 'active') {
            actionsHtml += ` <button class="btn btn-sm btn-warning" onclick="offPost(${p.id})">下架</button>`;
        }
        tr.innerHTML = `
            <td>${p.id}</td>
            <td>${p.title}</td>
            <td>${p.type}</td>
            <td>${p.user_nickname}</td>
            <td>${p.status}</td>
            <td>${formatDateTime(p.created_at)}</td>
            <td class="table-actions">${actionsHtml}</td>
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
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadPosts(1)">1</button>`;
        if (start > 2) html += `<span class="mx-1">...</span>`;
    }
    for (let i = start; i <= end; i++) {
        html += `<button class="btn btn-sm ${i === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="loadPosts(${i})">${i}</button> `;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="mx-1">...</span>`;
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadPosts(${totalPages})">${totalPages}</button>`;
    }
    document.getElementById('pagination').innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('statusFilter').addEventListener('change', () => loadPosts(1));
    document.getElementById('typeFilter').addEventListener('change', () => loadPosts(1));
    document.getElementById('sortSelect').addEventListener('change', () => loadPosts(1));
    document.getElementById('searchBtn').addEventListener('click', () => loadPosts(1));
    loadPosts(1);
});

async function viewPost(id) {
    const data = await request(`/admin/api/posts/${id}`);
    if (data) {
        const post = data.data;
        currentPostId = id;
        const modalBody = document.getElementById('postDetailBody');
        modalBody.innerHTML = `
            <p><strong>ID:</strong> ${post.id}</p>
            <p><strong>标题:</strong> ${post.title}</p>
            <p><strong>描述:</strong> ${post.description}</p>
            <p><strong>类型:</strong> ${post.type}</p>
            <p><strong>状态:</strong> ${post.status}</p>
            <p><strong>地点:</strong> ${post.location || ''}</p>
            <p><strong>丢失时间:</strong> ${formatDateTime(post.lost_time)}</p>
            <p><strong>有效期:</strong> ${post.expiry_days}天</p>
            <p><strong>价格:</strong> ${post.price || ''}</p>
            <p><strong>成色:</strong> ${post.condition || ''}</p>
            <p><strong>浏览量:</strong> ${post.view_count}</p>
            <p><strong>收藏量:</strong> ${post.favorite_count}</p>
            <p><strong>发布者:</strong> ${post.user.nickname} (信誉分: ${post.user.credit_score})</p>
            <div><strong>图片:</strong> ${(post.images || []).map(url => `<img src="${url}" style="max-width:100px; margin:5px;">`).join('')}</div>
            <div><strong>相关举报:</strong> ${post.reports ? post.reports.map(r => `举报ID:${r.id} (${r.reason})`).join('<br>') : '无'}</div>
        `;
        document.getElementById('offPostBtn').style.display = post.status === 'active' ? 'inline-block' : 'none';
        document.getElementById('restorePostBtn').style.display = post.status === 'off' ? 'inline-block' : 'none';
        new bootstrap.Modal(document.getElementById('postDetailModal')).show();
    }
}

function offPost(id) {
    if (id) {
        showOffModal(id);
    } else if (currentPostId) {
        showOffModal(currentPostId);
    } else {
        console.error('未指定帖子ID');
    }
}

function showOffModal(id) {
    document.getElementById('offPostId').value = id;
    document.getElementById('offReason').value = '';
    document.getElementById('offDeductCredit').value = 15;
    new bootstrap.Modal(document.getElementById('offReasonModal')).show();
}

async function confirmOffPost() {
    const id = document.getElementById('offPostId').value;
    const reason = document.getElementById('offReason').value;
    let deductCredit = parseInt(document.getElementById('offDeductCredit').value);
    if (isNaN(deductCredit)) deductCredit = 0;
    const data = await request(`/admin/api/posts/${id}/off`, {
        method: 'POST',
        body: JSON.stringify({ reason, deduct_credit: deductCredit })
    });
    if (data.code === 0) {
        alert('下架成功');
        // 安全关闭模态框
        const offReasonModal = bootstrap.Modal.getInstance(document.getElementById('offReasonModal'));
        if (offReasonModal) offReasonModal.hide();
        const postDetailModal = bootstrap.Modal.getInstance(document.getElementById('postDetailModal'));
        if (postDetailModal) postDetailModal.hide();
        loadPosts(currentPage);
    } else {
        console.error('下架失败:', data);
        alert(`下架失败：${data.message || '未知错误'}`);
    }
}

async function restorePost() {
    const data = await request(`/admin/api/posts/${currentPostId}/restore`, {
        method: 'POST',
        body: JSON.stringify({ restore_credit: 15 })
    });
    if (data.code === 0) {
        alert('恢复成功');
        const postDetailModal = bootstrap.Modal.getInstance(document.getElementById('postDetailModal'));
        if (postDetailModal) postDetailModal.hide();
        loadPosts(currentPage);
    } else {
        alert(data.message);
    }
}