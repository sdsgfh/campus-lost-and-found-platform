async function loadBanners() {
    const data = await request('/admin/api/banners');
    if (data) {
        renderTable(data.data);
    }
}

function renderTable(banners) {
    const tbody = document.getElementById('bannerTableBody');
    tbody.innerHTML = '';
    banners.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${b.id}</td>
            <td>${b.title || ''}</td>
            <td><img src="${b.image_url}" style="max-width:80px; max-height:40px;"></td>
            <td>${b.link_type}</td>
            <td>${b.link_value || ''}</td>
            <td>${b.sort_order}</td>
            <td>${b.status}</td>
            <td class="table-actions">
                <button class="btn btn-sm btn-warning" onclick="editBanner(${b.id})">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteBanner(${b.id})">删除</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function showCreateModal() {
    document.getElementById('bannerModalTitle').innerText = '新增轮播图';
    document.getElementById('bannerId').value = '';
    document.getElementById('bannerTitle').value = '';
    document.getElementById('bannerImageUrl').value = '';
    document.getElementById('bannerLinkType').value = 'none';
    document.getElementById('bannerLinkValue').value = '';
    document.getElementById('bannerSortOrder').value = '0';
    document.getElementById('bannerStatus').value = 'active';
    new bootstrap.Modal(document.getElementById('bannerModal')).show();
}

async function editBanner(id) {
    const data = await request(`/admin/api/banners/${id}`);
    if (data) {
        const b = data.data;
        document.getElementById('bannerModalTitle').innerText = '编辑轮播图';
        document.getElementById('bannerId').value = b.id;
        document.getElementById('bannerTitle').value = b.title || '';
        document.getElementById('bannerImageUrl').value = b.image_url;
        document.getElementById('bannerLinkType').value = b.link_type;
        document.getElementById('bannerLinkValue').value = b.link_value || '';
        document.getElementById('bannerSortOrder').value = b.sort_order;
        document.getElementById('bannerStatus').value = b.status;
        new bootstrap.Modal(document.getElementById('bannerModal')).show();
    }
}

async function saveBanner() {
    const id = document.getElementById('bannerId').value;
    const title = document.getElementById('bannerTitle').value;
    const image_url = document.getElementById('bannerImageUrl').value;
    const link_type = document.getElementById('bannerLinkType').value;
    const link_value = document.getElementById('bannerLinkValue').value;
    const sort_order = parseInt(document.getElementById('bannerSortOrder').value) || 0;
    const status = document.getElementById('bannerStatus').value;

    if (!image_url) {
        alert('图片URL不能为空');
        return;
    }

    const data = { title, image_url, link_type, link_value, sort_order, status };
    let url = '/admin/api/banners';
    let method = 'POST';
    if (id) {
        url = `/admin/api/banners/${id}`;
        method = 'PUT';
    }
    const result = await request(url, {
        method,
        body: JSON.stringify(data)
    });
    if (result.code === 0) {
        alert('保存成功');
        bootstrap.Modal.getInstance(document.getElementById('bannerModal')).hide();
        loadBanners();
    } else {
        alert(result.message);
    }
}

async function deleteBanner(id) {
    if (!confirm('确定删除吗？')) return;
    const result = await request(`/admin/api/banners/${id}`, { method: 'DELETE' });
    if (result.code === 0) {
        alert('删除成功');
        loadBanners();
    } else {
        alert(result.message);
    }
}

loadBanners();