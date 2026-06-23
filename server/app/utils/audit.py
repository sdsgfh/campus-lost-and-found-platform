import re
import os


class SensitiveWordFilter:
    def __init__(self, word_file='sensitive_words.txt'):
        self.trie = {}
        file_path = os.path.join(os.path.dirname(__file__), word_file)
        self.build_trie(file_path)
    def build_trie(self, file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                words = [line.strip() for line in f if line.strip()]
            print(f"✅ 敏感词库加载成功，共 {len(words)} 个敏感词")
        except FileNotFoundError:
            print(f"❌ 警告：敏感词文件 {file_path} 不存在，审核功能禁用")
            return
        for word in words:
            node = self.trie
            for char in word:
                node = node.setdefault(char, {})
            node['end'] = True
            node['word'] = word
    def check(self, text):
        if not text or not isinstance(text, str):
            return False, None
        text_clean = re.sub(r'[^\w\s]', '', text.lower())
        length = len(text_clean)
        i = 0
        while i < length:
            node = self.trie
            if text_clean[i] not in node:
                i += 1
                continue
            j = i
            hit_word = None
            while j < length and text_clean[j] in node:
                node = node[text_clean[j]]
                if node.get('end'):
                    hit_word = node['word']
                j += 1
            if hit_word:
                return True, hit_word
            i += 1
        return False, None
    def replace(self, text, replace_char='*'):
        if not text or not isinstance(text, str):
            return text
        text_origin = text
        text_clean = re.sub(r'[^\w\s]', '', text.lower())
        length = len(text_clean)
        i = 0
        while i < length:
            node = self.trie
            if text_clean[i] not in node:
                i += 1
                continue
            j = i
            hit_word = None
            while j < length and text_clean[j] in node:
                node = node[text_clean[j]]
                if node.get('end'):
                    hit_word = node['word']
                j += 1
            if hit_word:
                pattern = re.compile(re.escape(hit_word), re.IGNORECASE)
                text_origin = pattern.sub(replace_char * len(hit_word), text_origin)
                i = j
            else:
                i += 1
        return text_origin
sensitive_filter = SensitiveWordFilter()

# ========== 发布场景专用严格审核函数（新增） ==========
def strict_audit_post_content(content):
    """
    发布帖子专用严格审核：检测到敏感词直接拒绝，不替换、不放行
    :param content: 待审核内容（dict: title+description / str）
    :return: {'passed': bool, 'reason': str}
    """
    # 拼接标题+描述
    if isinstance(content, dict):
        text = f"{content.get('title', '')} {content.get('description', '')}".strip()
    else:
        text = str(content).strip()

    # 敏感词检测
    is_hit, hit_word = sensitive_filter.check(text)
    if is_hit:
        return {
            'passed': False,  # 直接拒绝提交
            'reason': f'内容包含敏感词「{hit_word}」，审核不通过，请修改后重新提交'
        }
    else:
        return {
            'passed': True,
            'reason': '内容合规，审核通过'
        }

# ========== 通用审核函数（保留，供其他模块使用） ==========
def audit_content(content_type, content):
    """
    统一内容审核入口（聊天/个人信息等场景）
    :param content_type: 内容类型（chat/text/profile）
    :param content: 待审核内容（字符串/标题+描述组合）
    :return: {'passed': bool, 'reason': str, 'content': 处理后的内容}
    """
    # 如果是组合内容（如发布的标题+描述）
    if isinstance(content, dict):
        text = f"{content.get('title', '')} {content.get('description', '')}".strip()
    else:
        text = str(content).strip()

    # 敏感词检测
    is_hit, hit_word = sensitive_filter.check(text)
    if is_hit:
        # 聊天场景：替换敏感词+放行
        if content_type == 'chat':
            processed_content = sensitive_filter.replace(text)  # 执行替换
            return {
                'passed': True,  # 放行
                'reason': f'消息包含敏感词：{hit_word}（已自动替换）',
                'content': processed_content  # 返回替换后的内容
            }
        # 其他场景（个人信息）：替换敏感词+放行
        else:
            processed_content = sensitive_filter.replace(text)
            return {
                'passed': True,
                'reason': f'已替换敏感词：{hit_word}',
                'content': processed_content
            }
    else:
        return {
            'passed': True,
            'reason': '内容合规',
            'content': text
        }


# 兼容旧函数（避免其他模块报错）
def check_sensitive_word(content):
    return sensitive_filter.check(content)[0]


def replace_sensitive_word(content):
    return sensitive_filter.replace(content)