// ==================== 全局配置 ====================
const TOKEN_KEY = 'admin_token';
const baseUrl = ''; // 相对路径

// 获取存储的 token
function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// 保存 token
function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

// 清除 token
function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

// 跳转到登录页
function redirectToLogin() {
    clearToken();
    window.location.href = '/admin/login';
}

// 跳转到修改密码页
function redirectToChangePassword() {
    window.location.href = '/admin/change-password';
}

// 显示提示消息（可替换为更好的弹窗库，如 Swal、Element UI 的 Message）
function showToast(message, type = 'info') {
    // 简单起见，使用 alert，实际项目中可替换为更美观的提示组件
    alert(`[${type}] ${message}`);
}

// 格式化日期时间
function formatDateTime(datetime) {
    if (!datetime) return '';
    const d = new Date(datetime);
    return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ==================== 请求封装====================
async function request(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    try {
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            if (response.status === 401) {
                showToast('登录已过期，请重新登录', 'warning');
                redirectToLogin();
                return { code: 401, message: '未授权' };
            }
            if (response.status === 403) {
                showToast('您没有权限执行此操作', 'error');
                return { code: 403, message: '禁止访问' };
            }
            const errorText = await response.text();
            return { code: response.status, message: errorText || '请求失败' };
        }

        const data = await response.json();
        if (data.code === 1001) {
            showToast('首次登录或密码过期，请修改密码', 'info');
            redirectToChangePassword();
            return { code: 1001, message: '需要修改密码' };
        }
        if (data.code !== 0) {
            showToast(data.message || '操作失败', 'error');
            return data;
        }
        return data;
    } catch (error) {
        console.error('请求失败:', error);
        showToast('网络异常或服务器错误', 'error');
        return { code: -1, message: '网络错误' };
    }
}

async function get(url, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    return request(fullUrl, { method: 'GET' });
}

async function post(url, data = {}) {
    return request(url, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

async function put(url, data = {}) {
    return request(url, {
        method: 'PUT',
        body: JSON.stringify(data)
    });
}

async function del(url) {
    return request(url, { method: 'DELETE' });
}

// ==================== 退出登录 ====================
async function logout() {
    try {
        await post('/admin/logout');
    } catch (error) {
        // 忽略错误，仍清除本地 token
    } finally {
        clearToken();
        window.location.href = '/admin/login';
    }
}

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的 Promise 错误:', event.reason);
    showToast('页面发生错误，请刷新重试', 'error');
    // 尝试清除可能残留的遮罩层
    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
    document.body.classList.remove('modal-open');
});