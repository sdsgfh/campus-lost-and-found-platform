let currentPage = 1;
let currentStatus = '';
let currentSearch = '';
let currentAppealId = null;

document.addEventListener('DOMContentLoaded', function() {
    loadAppeals(1);
    document.getElementById('searchBtn').addEventListener('click', function() {
        currentSearch = document.getElementById('searchInput').value;
        currentStatus = document.getElementById('statusFilter').value;
        loadAppeals(1);
    });
    document.getElementById('statusFilter').addEventListener('change', function() {
        currentStatus = this.value;
        loadAppeals(1);
    });
});

async function loadAppeals(page) {
    currentPage = page;
    let url = `/admin/api/appeals?page=${page}&per_page=10`;
    if (currentStatus) url += `&status=${currentStatus}`;
    if (currentSearch) url += `&search=${encodeURIComponent(currentSearch)}`;

    const data = await get(url);
    if (data && data.code === 0) {
        renderTable(data.data);
        renderPagination(data.total, page);
    } else {
        renderTable([]);
    }
}

function renderTable(appeals) {
    const tbody = document.getElementById('appealTableBody');
    tbody.innerHTML = '';
    if (!appeals || appeals.length === 0) {
        tbody.innerHTML = '看得到<td colspan="8" class="text-center">暂无数据</td>看得到';
        return;
    }
    appeals.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${getAppealTypeText(item.appeal_type)}</td>
            <td>${item.appellant_id}</td>
            <td>${item.target_type}</td>
            <td>${item.target_id}</td>
            <td><span class="badge ${getStatusBadgeClass(item.status)}">${getStatusText(item.status)}</span></td>
            <td>${formatDateTime(item.created_at)}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-info" onclick="showAppealDetail(${item.id})">详情</button>
                ${item.status === 'pending' ? `<button class="btn btn-sm btn-success" onclick="prepareAudit(${item.id})">审核</button>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getAppealTypeText(type) {
    const map = {
        'post_off': '帖子下架',
        'credit_deduct': '信誉分扣除',
        'claim_dispute': '冒领申诉'
    };
    return map[type] || type;
}

function getStatusText(status) {
    const map = {
        'pending': '待审核',
        'approved': '申诉成立',
        'rejected': '申诉不成立'
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

function renderPagination(total, page) {
    const perPage = 10;
    const totalPages = Math.ceil(total / perPage);
    const current = page;
    const maxVisible = 5;
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }
    let html = '';
    if (start > 1) {
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadAppeals(1)">1</button>`;
        if (start > 2) html += `<span class="mx-1">...</span>`;
    }
    for (let i = start; i <= end; i++) {
        html += `<button class="btn btn-sm ${i === current ? 'btn-primary' : 'btn-outline-primary'}" onclick="loadAppeals(${i})">${i}</button> `;
    }
    if (end < totalPages) {
        if (end < totalPages - 1) html += `<span class="mx-1">...</span>`;
        html += `<button class="btn btn-sm btn-outline-primary" onclick="loadAppeals(${totalPages})">${totalPages}</button>`;
    }
    document.getElementById('pagination').innerHTML = html;
}

async function showAppealDetail(id) {
    currentAppealId = id;
    const data = await get(`/admin/api/appeals/${id}`);
    if (data && data.code === 0) {
        const appeal = data.data;
        const modalBody = document.getElementById('appealDetailBody');
        modalBody.innerHTML = `
            <p><strong>申诉ID：</strong>${appeal.id}</p>
            <p><strong>申诉类型：</strong>${getAppealTypeText(appeal.appeal_type)}</p>
            <p><strong>申诉人：</strong>${appeal.appellant ? appeal.appellant.nickname : '未知'} (ID: ${appeal.appellant_id})</p>
            <p><strong>目标类型：</strong>${appeal.target_type}</p>
            <p><strong>目标ID：</strong>${appeal.target_id}</p>
            <p><strong>申诉理由：</strong>${appeal.reason}</p>
            <p><strong>证据图片：</strong></p>
            <div>
                ${appeal.evidence_images && appeal.evidence_images.length > 0 ?
                    appeal.evidence_images.map(url => `<img src="${url}" style="max-width:200px; margin:5px;">`).join('') :
                    '无'
                }
            </div>
            <p><strong>申诉时间：</strong>${formatDateTime(appeal.created_at)}</p>
            <p><strong>处理状态：</strong>${getStatusText(appeal.status)}</p>
            ${appeal.result ? `<p><strong>处理结果：</strong>${appeal.result}</p>` : ''}
        `;
        new bootstrap.Modal(document.getElementById('appealDetailModal')).show();
    }
}

function prepareAudit(id) {
    currentAppealId = id;
    const auditIdInput = document.getElementById('auditAppealId');
    const auditReasonTextarea = document.getElementById('auditReason');
    if (!auditIdInput || !auditReasonTextarea) {
        console.error('审核模态框元素缺失');
        return;
    }
    auditIdInput.value = id;
    auditReasonTextarea.value = '';
    // 重置下拉框默认值
    const resultSelect = document.getElementById('auditResultSelect');
    if (resultSelect) resultSelect.value = 'approved';
    // 隐藏恶意申诉选项（申诉中暂时不实现恶意判断，可根据需要调整）
    const maliciousGroup = document.getElementById('maliciousCheckGroup');
    if (maliciousGroup) maliciousGroup.style.display = 'none';
    new bootstrap.Modal(document.getElementById('auditAppealModal')).show();
}

async function confirmAppealAudit() {
    const idInput = document.getElementById('auditAppealId');
    const reasonTextarea = document.getElementById('auditReason');
    const resultSelect = document.getElementById('auditResultSelect');
    const maliciousCheckbox = document.getElementById('isMalicious');

    if (!idInput || !reasonTextarea || !resultSelect) {
        console.error('无法获取审核表单元素');
        alert('页面错误，请刷新后重试');
        return;
    }

    const id = idInput.value;
    const result = resultSelect.value;  // 从下拉框获取结果
    const reason = reasonTextarea.value;
    const isMalicious = maliciousCheckbox ? maliciousCheckbox.checked : false;

    if (!result) {
        alert('请选择审核结果');
        return;
    }

    const data = await post(`/admin/api/appeals/${id}/audit`, {
        result: result,
        reason: reason,
        is_malicious: isMalicious
    });
    if (data && data.code === 0) {
        alert('审核成功');
        const modal = bootstrap.Modal.getInstance(document.getElementById('auditAppealModal'));
        if (modal) modal.hide();
        loadAppeals(currentPage);
    } else {
        alert(data?.message || '审核失败');
    }
}