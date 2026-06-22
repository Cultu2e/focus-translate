# 网页翻译插件 - Python后端服务

## 功能特性

- 支持划词翻译（选中文字即可翻译）
- 支持整页翻译
- 支持多种翻译API（Google、百度、有道）
- 实时显示翻译结果
- 可清除翻译恢复原文

## 安装步骤

### 1. 安装Python依赖

```bash
cd translate-server
pip install -r requirements.txt
```

### 2. 启动翻译服务

```bash
python server.py
```

服务将在 http://localhost:5000 启动

### 3. 安装浏览器扩展

1. 打开 Chrome/Edge 浏览器
2. 进入扩展管理页面: `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `translate-extension` 文件夹

## 使用方法

### 划词翻译
1. 确保Python服务已启动
2. 在网页上选中英文文本
3. 翻译结果会自动显示在鼠标附近

### 整页翻译
1. 点击浏览器工具栏的翻译图标
2. 点击"翻译整个页面"按钮
3. 所有英文内容会被替换为中文（鼠标悬停可查看原文）

### 清除翻译
点击"清除翻译"按钮恢复原文

## 配置翻译API

### Google翻译（默认，免费）
无需配置，直接使用

### 百度翻译
1. 访问 https://fanyi-api.baidu.com/ 申请API
2. 在 `server.py` 中修改:
```python
translator = BaiduTranslator(appid='你的appid', appkey='你的key')
```

### 有道翻译
1. 访问 https://ai.youdao.com/ 申请API
2. 在 `server.py` 中修改:
```python
translator = YoudaoTranslator(app_key='你的key', app_secret='你的secret')
```

## API端点

### 单条翻译
```bash
POST /translate
Content-Type: application/json

{
  "text": "Hello World",
  "target_lang": "zh-CN"
}
```

响应:
```json
{
  "success": true,
  "translation": "你好，世界",
  "source": "Hello World"
}
```

### 批量翻译
```bash
POST /translate/batch
Content-Type: application/json

{
  "texts": ["Hello", "World"],
  "target_lang": "zh-CN"
}
```

### 健康检查
```bash
GET /health
```

## 注意事项

1. Google翻译API在中国大陆可能需要科学上网
2. 如需国内稳定使用，建议申请百度或有道API
3. 免费API有调用频率限制，请勿滥用
