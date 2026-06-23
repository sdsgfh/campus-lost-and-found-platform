let currentPage = 1;
let totalPages = 1;
let currentReportId = null;

async function loadReports(page) {
    currentPage = page;
    const search = document.getElementById('searchInput').value;
    const status = document.getElementById('statusFilter').value;

    const data = await request(`/admin/api/reports?page=${page}&per_page=10&search=${encodeURIComponent(search)}&status=${status}`);
    if (data) {
        renderTable(data.data);
        renderPagination(data.total);
    }
}

function renderTable(reports) {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';
    reports.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.id}</td>
            <td>${r.report_type}</td>
            <td>${r.sub_type || ''}</td>
            <td>${r.reporter_id}</td>
            <td>${r.target_type}</td>
            <td>${r.target_id}</td>
            <td><span class="badge ${getStatusBadgeClass(r.status)}">${getStatusText(r.status)}</span></td>
            <td>${formatDateTime(r.created_at)}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-info" onclick="viewReport(${r.id})">详情</button>
                ${r.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="openAuditModal(${r.id})">审核</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStatusText(status) {
    const map = {
        'pending': '待审核',
        'approved': '举报成立',
        'rejected': '举报不成立'
    };
    return map[status] || status;
}

function getStatusBadgeClass(status) {
    const map = {
        'pending': 'bg-warning',
        'approved': 'bg-success',
        'rejected': 'bg-danger'
    };
    return map[status] || 'bg-secondary';
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
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadReports(1)">1</button>`;
        if (start > 2) html += `<span class="mx-1">...</span>`;
    }
    for (let i = start; i <= end; i++) {
        html += `<button class="btn btn-sm ${i === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="loadReports(${i})">${i}</button> `;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="mx-1">...</span>`;
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadReports(${totalPages})">${totalPages}</button>`;
    }
    document.getElementById('pagination').innerHTML = html;
}

async function viewReport(id) {
    const data = await request(`/admin/api/reports/${id}`);
    if (data) {
        const r = data.data;
        currentReportId = id;
        const modalBody = document.getElementById('reportDetailBody');
        modalBody.innerHTML = `
            <p><strong>举报ID:</strong> ${r.id}</p>
            <p><strong>举报类型:</strong> ${r.report_type}${r.sub_type ? '/' + r.sub_type : ''}</p>
            <p><strong>举报人:</strong> ${r.reporter ? `${r.reporter.nickname} (ID:${r.reporter.id}) 信誉分:${r.reporter.credit_score}` : '未知'}</p>
            <p><strong>被举报对象类型:</strong> ${r.target_type}</p>
            <p><strong>被举报对象ID:</strong> ${r.target_id}</p>
            <p><strong>被举报对象详情:</strong> ${r.target_info ? JSON.stringify(r.target_info) : '无'}</p>
            <p><strong>举报理由:</strong> ${r.reason}</p>
            <p><strong>证据图片:</strong> ${(r.evidence_images || []).map(url => `<img src="${url}" style="max-width:100px; margin:5px;">`).join('')}</p>
            <p><strong>状态:</strong> <span class="badge ${getStatusBadgeClass(r.status)}">${getStatusText(r.status)}</span></p>
            <p><strong>举报时间:</strong> ${formatDateTime(r.created_at)}</p>
        `;
        new bootstrap.Modal(document.getElementById('reportDetailModal')).show();
    }
}

function openAuditModal(id) {
    currentReportId = id;
    document.getElementById('auditReportId').value = id;
    document.getElementById('auditReason').value = '';
    document.getElementById('isMalicious').checked = false;
    document.getElementById('auditResultSelect').value = 'approved';
    updateAuditModalView();
    new bootstrap.Modal(document.getElementById('auditReportModal')).show();
}

function updateAuditModalView() {
    const result = document.getElementById('auditResultSelect').value;
    if (result === 'approved') {
        document.getElementById('auditModalTitle').innerText = '审核成立';
        document.getElementById('maliciousCheckGroup').style.display = 'none';
    } else {
        document.getElementById('auditModalTitle').innerText = '审核不成立';
        document.getElementById('maliciousCheckGroup').style.display = 'block';
    }
}

async function confirmAudit() {
    const id = document.getElementById('auditReportId').value;
    const result = document.getElementById('auditResultSelect').value;
    const reason = document.getElementById('auditReason').value;
    const isMalicious = document.getElementById('isMalicious').checked;

    const data = await request(`/admin/api/reports/${id}/audit`, {
        method: 'POST',
        body: JSON.stringify({
            result,
            reason,
            is_malicious: isMalicious
        })
    });
    if (data.code === 0) {
        alert('审核成功');
        bootstrap.Modal.getInstance(document.getElementById('auditReportModal')).hide();
        loadReports(currentPage);
    } else {
        alert(data.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('statusFilter').addEventListener('change', () => loadReports(1));
    document.getElementById('searchBtn').addEventListener('click', () => loadReports(1));
    document.getElementById('auditResultSelect').addEventListener('change', updateAuditModalView);
    loadReports(1);
});