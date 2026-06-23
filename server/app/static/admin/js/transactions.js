let currentPage = 1;
let totalPages = 1;

async function loadTransactions(page) {
    currentPage = page;
    const search = document.getElementById('searchInput').value;
    const type = document.getElementById('typeFilter').value;

    const data = await request(`/admin/api/transactions?page=${page}&per_page=10&search=${encodeURIComponent(search)}&type=${type}`);
    if (data) {
        renderTable(data.data);
        renderPagination(data.total);
    }
}

function renderTable(records) {
    const tbody = document.getElementById('transactionTableBody');
    tbody.innerHTML = '';
    records.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.id}</td>
            <td>${r.post_id}</td>
            <td>${r.type}</td>
            <td>${r.publisher_id}</td>
            <td>${r.receiver_id}</td>
            <td>${formatDateTime(r.completed_at)}</td>
            <td>${r.protection_end_time ? formatDateTime(r.protection_end_time) : ''}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-info" onclick="viewTransaction(${r.id})">详情</button>
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
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadTransactions(1)">1</button>`;
        if (start > 2) html += `<span class="mx-1">...</span>`;
    }
    for (let i = start; i <= end; i++) {
        html += `<button class="btn btn-sm ${i === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="loadTransactions(${i})">${i}</button> `;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="mx-1">...</span>`;
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadTransactions(${totalPages})">${totalPages}</button>`;
    }
    document.getElementById('pagination').innerHTML = html;
}

async function viewTransaction(id) {
    const data = await request(`/admin/api/transactions/${id}`);
    if (data) {
        const r = data.data;
        const modalBody = document.getElementById('transactionDetailBody');
        modalBody.innerHTML = `
            <p><strong>记录ID:</strong> ${r.id}</p>
            <p><strong>帖子标题:</strong> ${r.post ? r.post.title : '未知'}</p>
            <p><strong>帖子类型:</strong> ${r.post ? r.post.type : ''}</p>
            <p><strong>帖子描述:</strong> ${r.post ? r.post.description : ''}</p>
            <div><strong>帖子图片:</strong> ${(r.post && r.post.images) ? r.post.images.map(url => `<img src="${url}" style="max-width:100px; margin:5px;">`).join('') : '无'}</div>
            <p><strong>发布者:</strong> ${r.publisher ? `${r.publisher.nickname} (ID:${r.publisher.id}) 信誉分:${r.publisher.credit_score}` : '未知'}</p>
            <p><strong>对接者:</strong> ${r.receiver ? `${r.receiver.nickname} (ID:${r.receiver.id}) 信誉分:${r.receiver.credit_score}` : '未知'}</p>
            <p><strong>交易类型:</strong> ${r.type}</p>
            <p><strong>完成时间:</strong> ${formatDateTime(r.completed_at)}</p>
            <p><strong>保护期结束:</strong> ${formatDateTime(r.protection_end_time)}</p>
        `;
        new bootstrap.Modal(document.getElementById('transactionDetailModal')).show();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('typeFilter').addEventListener('change', () => loadTransactions(1));
    document.getElementById('searchBtn').addEventListener('click', () => loadTransactions(1));
    loadTransactions(1);
});