from app import create_app
import os
from flask import Flask, send_from_directory

app = Flask(__name__)
UPLOAD_FOLDER = r'D:\Python Projects\xiaomi\uploads'
# 确保uploads文件夹存在（防止报错）
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
# 暴露uploads文件夹为静态资源
@app.route('/uploads/<path:filename>')
def serve_uploaded_file(filename):
    # 安全返回uploads里的文件，支持中文/特殊字符
    return send_from_directory(
        app.config['UPLOAD_FOLDER'],
        filename,
        as_attachment=False  # 直接显示，不下载
    )
app = create_app()

@app.route('/ping')
def ping():
    return "pong"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)