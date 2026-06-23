let currentPage = 1;
let totalPages = 1;
let currentStatus = '';
let currentSearch = '';

document.addEventListener('DOMContentLoaded', function() {
    loadAnnouncements(1);
});

function loadAnnouncements(page) {
    currentPage = page;
    let url = '/admin/api/announcements?page=' + page + '&per_page=10';
    if (currentStatus) url += '&status=' + currentStatus;
    if (currentSearch) url += '&search=' + encodeURIComponent(currentSearch);

    get(url).then(data => {
        if (data && data.code === 0) {
            renderTable(data.data);
            totalPages = Math.ceil(data.total / 10);
            renderPagination();
        } else {
            renderTable([]);
        }
    }).catch(err => {
        console.error('加载公告失败', err);
        renderTable([]);
    });
}

function renderTable(list) {
    const tbody = document.getElementById('announcementTable');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!list || list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">暂无数据</td></tr>';
        return;
    }
    list.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${escapeHtml(item.title)}</td>
            <td>${escapeHtml(item.content)}</td>
            <td><span class="badge ${item.status === 'published' ? 'bg-success' : 'bg-secondary'}">${item.status === 'published' ? '已发布' : '草稿'}</span></td>
            <td>${item.publish_time}</td>
            <td>${item.created_at}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editAnnouncement(${item.id})">编辑</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAnnouncement(${item.id})">删除</button>
                <button class="btn btn-sm btn-outline-warning" onclick="toggleStatus(${item.id})">切换状态</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderPagination() {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    pagination.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" onclick="loadAnnouncements(${i})">${i}</a>`;
        pagination.appendChild(li);
    }
}

function filterStatus() {
    currentStatus = document.getElementById('statusFilter').value;
    loadAnnouncements(1);
}

function search() {
    currentSearch = document.getElementById('searchInput').value;
    loadAnnouncements(1);
}

function openModal() {
    const modalEl = document.getElementById('announcementModal');
    if (!modalEl) {
        console.error('模态框元素不存在');
        return;
    }
    document.getElementById('modalTitle').innerText = '新建公告';
    document.getElementById('announcementForm').reset();
    document.getElementById('announcementId').value = '';
    const now = new Date().toISOString().slice(0, 16);
    document.getElementById('publishTime').value = now;
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function editAnnouncement(id) {
    const modalEl = document.getElementById('announcementModal');
    if (!modalEl) {
        console.error('模态框元素不存在');
        return;
    }
    try {
        const data = await get(`/admin/api/announcements/${id}`);
        if (data && data.code === 0) {
            const a = data.data;
            document.getElementById('modalTitle').innerText = '编辑公告';
            document.getElementById('announcementId').value = a.id;
            document.getElementById('title').value = a.title;
            document.getElementById('content').value = a.content;
            const publishTime = a.publish_time.replace(' ', 'T');
            document.getElementById('publishTime').value = publishTime;
            document.getElementById('status').value = a.status;
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        } else {
            console.error('获取公告详情失败', data);
        }
    } catch (error) {
        console.error('编辑公告出错', error);
    }
}

async function saveAnnouncement() {
    const id = document.getElementById('announcementId').value;
    const title = document.getElementById('title').value.trim();
    const content = document.getElementById('content').value.trim();
    const publishTime = document.getElementById('publishTime').value.replace('T', ' ');
    const status = document.getElementById('status').value;

    if (!title || !content) {
        alert('标题和内容不能为空');
        return;
    }

    const data = { title, content, publish_time: publishTime, status };
    let result;
    try {
        if (id) {
            result = await put(`/admin/api/announcements/${id}`, data);
        } else {
            result = await post('/admin/api/announcements', data);
        }
        if (result && result.code === 0) {
            const modalEl = document.getElementById('announcementModal');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();
            loadAnnouncements(currentPage);
        }
    } catch (error) {
        console.error('保存公告失败', error);
    }
}
async function deleteAnnouncement(id) {
    if (!confirm('确定删除该公告吗？')) return;
    try {
        const result = await del(`/admin/api/announcements/${id}`);
        if (result && result.code === 0) {
            loadAnnouncements(currentPage);
        }
    } catch (error) {
        console.error('删除公告失败', error);
    }
}

async function toggleStatus(id) {
    try {
        const result = await post(`/admin/api/announcements/${id}/toggle`);
        if (result && result.code === 0) {
            loadAnnouncements(currentPage);
        }
    } catch (error) {
        console.error('切换状态失败', error);
    }
}

// 辅助函数：转义HTML，防止XSS
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}