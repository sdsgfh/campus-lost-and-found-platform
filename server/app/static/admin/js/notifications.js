document.addEventListener('DOMContentLoaded', function() {
    const recipientTypeRadios = document.querySelectorAll('input[name="recipientType"]');
    const userIdsInput = document.getElementById('userIds');

    recipientTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            userIdsInput.disabled = this.value === 'all';
        });
    });

    document.getElementById('notificationForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        const recipientType = document.querySelector('input[name="recipientType"]:checked').value;
        let userIds = [];
        if (recipientType === 'specific') {
            const idsStr = userIdsInput.value.trim();
            if (!idsStr) {
                alert('请输入用户ID');
                return;
            }
            userIds = idsStr.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            if (userIds.length === 0) {
                alert('无效的用户ID');
                return;
            }
        }
        const title = document.getElementById('title').value.trim();
        const content = document.getElementById('content').value.trim();
        if (!title || !content) {
            alert('标题和内容不能为空');
            return;
        }
        const data = {
            user_ids: userIds,
            title,
            content
        };
        const result = await request('/admin/api/notifications/send', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        if (result && result.code === 0) {
            alert(result.message);
            document.getElementById('notificationForm').reset();
            userIdsInput.disabled = true;
        } else {
            alert(result ? result.message : '发送失败');
        }
    });
});