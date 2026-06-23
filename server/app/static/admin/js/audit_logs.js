let currentPage = 1;
let totalPages = 1;

async function loadAuditLogs(page) {
    currentPage = page;
    const type = document.getElementById('typeFilter').value;
    const result = document.getElementById('resultFilter').value;

    const data = await request(`/admin/api/audit/logs?page=${page}&per_page=10&type=${type}&result=${result}`);
    if (data) {
        renderTable(data.data);
        renderPagination(data.total);
    }
}

function renderTable(logs) {
    const tbody = document.getElementById('auditLogTableBody');
    tbody.innerHTML = '';
    logs.forEach(l => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${l.id}</td>
            <td>${l.audit_type}</td>
            <td>${l.target_id}</td>
            <td>${l.auditor_id || ''}</td>
            <td>${l.audit_result}</td>
            <td>${l.reason || ''}</td>
            <td>${l.auto_check_result || ''}</td>
            <td>${formatDateTime(l.created_at)}</td>
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
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadAuditLogs(1)">1</button>`;
        if (start > 2) html += `<span class="mx-1">...</span>`;
    }
    for (let i = start; i <= end; i++) {
        html += `<button class="btn btn-sm ${i === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="loadAuditLogs(${i})">${i}</button> `;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="mx-1">...</span>`;
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadAuditLogs(${totalPages})">${totalPages}</button>`;
    }
    document.getElementById('pagination').innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('typeFilter').addEventListener('change', () => loadAuditLogs(1));
    document.getElementById('resultFilter').addEventListener('change', () => loadAuditLogs(1));
    loadAuditLogs(1);
});