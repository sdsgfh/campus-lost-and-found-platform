let currentPage = 1;
let totalPages = 1;
let currentFeedbackId = null; // 用于详情和回复

async function loadFeedbacks(page) {
    currentPage = page;
    const status = document.getElementById('statusFilter').value;

    const data = await request(`/admin/api/feedbacks?page=${page}&per_page=10&status=${status}`);
    if (data) {
        renderTable(data.data);
        renderPagination(data.total);
    }
}

function renderTable(feedbacks) {
    const tbody = document.getElementById('feedbackTableBody');
    tbody.innerHTML = '';
    feedbacks.forEach(f => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${f.id}</td>
            <td>${f.user_id}</td>
            <td>${f.content.substring(0, 50)}${f.content.length > 50 ? '...' : ''}</td>
            <td>${f.status === 'pending' ? '待处理' : '已回复'}</td>
            <td>${formatDateTime(f.created_at)}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-info" onclick="viewFeedback(${f.id})">查看</button>
                ${f.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="showReplyModal(${f.id})">回复</button>` : ''}
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
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadFeedbacks(1)">1</button>`;
        if (start > 2) html += `<span class="mx-1">...</span>`;
    }
    for (let i = start; i <= end; i++) {
        html += `<button class="btn btn-sm ${i === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="loadFeedbacks(${i})">${i}</button> `;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="mx-1">...</span>`;
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadFeedbacks(${totalPages})">${totalPages}</button>`;
    }
    document.getElementById('pagination').innerHTML = html;
}

// 查看反馈详情
async function viewFeedback(id) {
    const data = await request(`/admin/api/feedbacks/${id}`);
    if (data && data.code === 0) {
        const fb = data.data;
        // 构造详情内容（可根据需要美化）
        const detailHtml = `
            <p><strong>ID：</strong>${fb.id}</p>
            <p><strong>用户ID：</strong>${fb.user_id}</p>
            <p><strong>反馈内容：</strong>${fb.content}</p>
            <p><strong>状态：</strong>${fb.status === 'pending' ? '待处理' : '已回复'}</p>
            <p><strong>提交时间：</strong>${fb.created_at}</p>
            ${fb.reply_content ? `<p><strong>回复内容：</strong>${fb.reply_content}</p>` : ''}
            ${fb.reply_time ? `<p><strong>回复时间：</strong>${fb.reply_time}</p>` : ''}
            ${fb.images && fb.images.length > 0 ? `
                <p><strong>图片：</strong></p>
                <div>${fb.images.map(url => `<img src="${url}" style="max-width:200px; margin:5px;">`).join('')}</div>
            ` : ''}
        `;
        // 将详情放入某个模态框中，这里假设存在一个 id 为 feedbackDetailBody 的容器
        const modalBody = document.getElementById('feedbackDetailBody');
        if (modalBody) {
            modalBody.innerHTML = detailHtml;
            new bootstrap.Modal(document.getElementById('feedbackDetailModal')).show();
        } else {
            // 如果没有模态框，可降级为 alert
            alert('查看详情：\n' + fb.content);
        }
    }
}

// 显示回复模态框
function showReplyModal(id) {
    currentFeedbackId = id;
    document.getElementById('replyContent').value = '';
    new bootstrap.Modal(document.getElementById('replyModal')).show();
}

// 发送回复
async function sendReply() {
    const content = document.getElementById('replyContent').value;
    if (!content.trim()) {
        alert('请输入回复内容');
        return;
    }
    const result = await request(`/admin/api/feedbacks/${currentFeedbackId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ reply_content: content })
    });
    if (result && result.code === 0) {
        alert('回复成功');
        bootstrap.Modal.getInstance(document.getElementById('replyModal')).hide();
        loadFeedbacks(currentPage);
    } else {
        alert(result?.message || '回复失败');
    }
}

// 原有 replyFeedback 函数已废弃，由 showReplyModal 替代
function replyFeedback(id) {
    // 保留空函数或直接调用 showReplyModal
    showReplyModal(id);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('statusFilter').addEventListener('change', () => loadFeedbacks(1));
    loadFeedbacks(1);
});