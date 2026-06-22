"""
网页翻译服务 - 稳定版
修复各翻译引擎，确保可用
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import hashlib
import time
import gc
import sys
import random
import json
import os
import re
from collections import OrderedDict
from urllib.parse import quote

app = Flask(__name__)
CORS(app)

# ========== 加载配置 ==========
def load_config():
    config_path = os.path.join(os.path.dirname(__file__), 'config.json')
    default_config = {
        "baidu": {"appid": "", "appkey": ""},
        "youdao": {"app_key": "", "app_secret": ""},
        "priority": ["baidu", "youdao", "google", "mymemory"]
    }

    if os.path.exists(config_path):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                user_config = json.load(f)
                for key in default_config:
                    if key in user_config:
                        if isinstance(default_config[key], dict):
                            default_config[key].update(user_config[key])
                        else:
                            default_config[key] = user_config[key]
        except Exception as e:
            print(f"加载配置失败: {e}", file=sys.stderr)

    return default_config

CONFIG = load_config()

# ========== 缓存 ==========
class LRUCache:
    def __init__(self, capacity=300):
        self.cache = OrderedDict()
        self.capacity = capacity

    def get(self, key):
        if key not in self.cache:
            return None
        self.cache.move_to_end(key)
        return self.cache[key]

    def put(self, key, value):
        if key in self.cache:
            self.cache.move_to_end(key)
        self.cache[key] = value
        if len(self.cache) > self.capacity:
            self.cache.popitem(last=False)

    def clear(self):
        self.cache.clear()

translation_cache = LRUCache(capacity=300)

# ========== 速率限制 ==========
class RateLimiter:
    def __init__(self, max_requests=100, window=60):
        self.max_requests = max_requests
        self.window = window
        self.requests = []

    def is_allowed(self):
        now = time.time()
        self.requests = [t for t in self.requests if now - t < self.window]
        if len(self.requests) >= self.max_requests:
            return False
        self.requests.append(now)
        return True

rate_limiter = RateLimiter(max_requests=100, window=60)

# ========== 翻译引擎 ==========

class GoogleTranslator:
    """Google翻译 - 最稳定"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.0'
        })
        self.enabled = True
        self.name = 'Google翻译'

    def translate(self, text, target_lang='zh-CN'):
        if not text or not text.strip():
            return ""

        cache_key = f"google:{text}:{target_lang}"
        cached = translation_cache.get(cache_key)
        if cached:
            return cached

        try:
            # 使用Google翻译API
            url = "https://translate.googleapis.com/translate_a/single"
            params = {
                'client': 'gtx',
                'sl': 'auto',
                'tl': target_lang,
                'dt': 't',
                'q': text[:1000]
            }

            response = self.session.get(url, params=params, timeout=8)

            if response.status_code != 200:
                print(f"Google返回状态码: {response.status_code}", file=sys.stderr)
                return None

            result = response.json()

            if result and isinstance(result, list) and len(result) > 0:
                translated_parts = []
                for item in result[0]:
                    if item and isinstance(item, list) and len(item) > 0:
                        translated_parts.append(item[0])

                if translated_parts:
                    translation = ''.join(translated_parts)
                    translation_cache.put(cache_key, translation)
                    return translation

            return None

        except Exception as e:
            print(f"Google翻译错误: {e}", file=sys.stderr)
            return None


class BaiduTranslator:
    """百度翻译API"""

    def __init__(self):
        self.appid = CONFIG['baidu'].get('appid', '').strip()
        self.appkey = CONFIG['baidu'].get('appkey', '').strip()
        self.url = 'https://fanyi-api.baidu.com/api/trans/vip/translate'
        self.session = requests.Session()
        self.enabled = bool(self.appid and self.appkey)
        self.name = '百度翻译'

    def translate(self, text, target_lang='zh'):
        if not self.enabled:
            return None

        if not text or not text.strip():
            return ""

        cache_key = f"baidu:{text}:{target_lang}"
        cached = translation_cache.get(cache_key)
        if cached:
            return cached

        try:
            salt = random.randint(32768, 65536)
            sign_str = f"{self.appid}{text}{salt}{self.appkey}"
            sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest()

            params = {
                'q': text[:1000],
                'from': 'auto',
                'to': target_lang,
                'appid': self.appid,
                'salt': salt,
                'sign': sign
            }

            response = self.session.get(self.url, params=params, timeout=8)
            response.raise_for_status()

            result = response.json()

            if 'trans_result' in result:
                translation = '\n'.join([item['dst'] for item in result['trans_result']])
                translation_cache.put(cache_key, translation)
                return translation

            if 'error_code' in result:
                error_msg = result.get('error_msg', '未知错误')
                print(f"百度API错误: {error_msg}", file=sys.stderr)
                # 如果是认证错误，禁用该引擎
                if result.get('error_code') in ['52001', '52002', '52003']:
                    self.enabled = False
                    print("百度翻译认证失败，已禁用", file=sys.stderr)
                return None

        except Exception as e:
            print(f"百度翻译错误: {e}", file=sys.stderr)
            return None


class YoudaoTranslator:
    """有道翻译API"""

    def __init__(self):
        self.app_key = CONFIG['youdao'].get('app_key', '').strip()
        self.app_secret = CONFIG['youdao'].get('app_secret', '').strip()
        self.url = 'https://openapi.youdao.com/api'
        self.session = requests.Session()
        self.enabled = bool(self.app_key and self.app_secret)
        self.name = '有道翻译'

    def translate(self, text, target_lang='zh-CHS'):
        if not self.enabled:
            return None

        if not text or not text.strip():
            return ""

        cache_key = f"youdao:{text}:{target_lang}"
        cached = translation_cache.get(cache_key)
        if cached:
            return cached

        try:
            import uuid
            salt = str(uuid.uuid1())
            curtime = str(int(time.time()))

            # 有道签名逻辑
            input_text = text if len(text) <= 20 else text[:10] + str(len(text)) + text[-10:]
            sign_str = f"{self.app_key}{input_text}{salt}{curtime}{self.app_secret}"
            sign = hashlib.sha256(sign_str.encode('utf-8')).hexdigest()

            params = {
                'q': text[:1000],
                'from': 'auto',
                'to': target_lang,
                'appKey': self.app_key,
                'salt': salt,
                'sign': sign,
                'signType': 'v3',
                'curtime': curtime
            }

            response = self.session.post(self.url, data=params, timeout=8)
            response.raise_for_status()

            result = response.json()

            if result.get('translation'):
                translation = '\n'.join(result['translation'])
                translation_cache.put(cache_key, translation)
                return translation

            if result.get('errorCode'):
                print(f"有道API错误: {result}", file=sys.stderr)
                return None

        except Exception as e:
            print(f"有道翻译错误: {e}", file=sys.stderr)
            return None


class MyMemoryTranslator:
    """MyMemory API - 免费备用"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        self.enabled = True
        self.name = 'MyMemory'

    def translate(self, text, target_lang='zh'):
        if not text or not text.strip():
            return ""

        cache_key = f"mymemory:{text}:{target_lang}"
        cached = translation_cache.get(cache_key)
        if cached:
            return cached

        try:
            # MyMemory API
            url = 'https://api.mymemory.translated.net/get'
            params = {
                'q': text[:500],
                'langpair': f"en|zh"
            }

            response = self.session.get(url, params=params, timeout=10)
            response.raise_for_status()

            result = response.json()

            if result.get('responseStatus') == 200:
                translation = result['responseData']['translatedText']
                # 检查是否是有效翻译（不是返回原文）
                if translation and translation.lower() != text.lower():
                    translation_cache.put(cache_key, translation)
                    return translation

            return None

        except Exception as e:
            print(f"MyMemory错误: {e}", file=sys.stderr)
            return None


# ========== 翻译管理器 ==========
class TranslationManager:

    def __init__(self):
        self.engines = {
            'google': GoogleTranslator(),
            'baidu': BaiduTranslator(),
            'youdao': YoudaoTranslator(),
            'mymemory': MyMemoryTranslator()
        }
        self.priority = CONFIG.get('priority', ['google', 'baidu', 'youdao', 'mymemory'])

    def translate(self, text, target_lang='zh'):
        errors = []

        for engine_name in self.priority:
            if engine_name not in self.engines:
                continue

            engine = self.engines[engine_name]

            if hasattr(engine, 'enabled') and not engine.enabled:
                continue

            try:
                result = engine.translate(text, target_lang)
                if result and result.strip() and result.strip() != text.strip():
                    return {
                        'translation': result,
                        'engine': engine_name,
                        'engine_name': getattr(engine, 'name', engine_name)
                    }
            except Exception as e:
                errors.append(f"{engine_name}: {e}")
                continue

        # 所有引擎都失败
        print(f"所有翻译引擎失败: {errors}", file=sys.stderr)
        return None

    def get_status(self):
        status = {}
        for name, engine in self.engines.items():
            info = {'name': getattr(engine, 'name', name)}
            if hasattr(engine, 'enabled'):
                info['enabled'] = engine.enabled
            else:
                info['enabled'] = True
            status[name] = info
        return status


translation_manager = TranslationManager()

# ========== API路由 ==========

@app.route('/')
def index():
    return jsonify({
        'service': '网页翻译API',
        'version': '2.2.0-stable',
        'engines': translation_manager.get_status(),
        'priority': translation_manager.priority
    })


@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy',
        'engines': translation_manager.get_status(),
        'cache_size': len(translation_cache.cache)
    })


@app.route('/engines')
def engines():
    return jsonify({
        'engines': translation_manager.get_status(),
        'priority': translation_manager.priority,
        'recommendations': {
            'google': {'name': 'Google翻译', 'desc': '无需配置，直接使用', 'stable': True},
            'baidu': {'name': '百度翻译', 'desc': '学术词汇准确，需申请API', 'url': 'https://fanyi-api.baidu.com/'},
            'youdao': {'name': '有道翻译', 'desc': '通用翻译好，需申请API', 'url': 'https://ai.youdao.com/'},
            'mymemory': {'name': 'MyMemory', 'desc': '免费备用', 'stable': True}
        }
    })


@app.route('/translate', methods=['POST'])
def translate():
    try:
        if not rate_limiter.is_allowed():
            return jsonify({'success': False, 'error': '请求过于频繁'}), 429

        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({'success': False, 'error': '缺少text参数'}), 400

        text = data['text']
        if not text or not text.strip():
            return jsonify({'success': True, 'translation': '', 'source': text})

        # 长度限制
        if len(text) > 1000:
            text = text[:1000]

        # 执行翻译
        result = translation_manager.translate(text)

        if result is None:
            return jsonify({
                'success': False,
                'error': '所有翻译引擎均不可用。请检查网络连接或申请API密钥。',
                'engines': translation_manager.get_status()
            }), 503

        return jsonify({
            'success': True,
            'translation': result['translation'],
            'source': text,
            'engine': result['engine'],
            'engine_name': result['engine_name']
        })

    except Exception as e:
        print(f"API错误: {e}", file=sys.stderr)
        return jsonify({'success': False, 'error': f'服务器错误: {str(e)}'}), 500


@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    translation_cache.clear()
    gc.collect()
    return jsonify({'success': True, 'message': '缓存已清空'})


# ========== 启动 ==========

if __name__ == '__main__':
    print("=" * 60)
    print("网页翻译API服务 - 稳定版")
    print("=" * 60)
    print(f"服务地址: http://localhost:5000")
    print("")
    print("引擎状态:")
    for name, info in translation_manager.get_status().items():
        status = "✓" if info['enabled'] else "✗"
        print(f"  [{status}] {info['name']}")
    print("")
    print("优先级:", " → ".join(translation_manager.priority))
    print("")
    print("提示:")
    print("  - Google翻译默认启用，无需配置")
    print("  - 如需使用百度/有道，编辑 config.json 填入API密钥")
    print("  - 访问 http://localhost:5000/engines 查看状态")
    print("")
    print("按 Ctrl+C 停止服务")
    print("=" * 60)

    app.run(
        host='127.0.0.1',
        port=5000,
        debug=False,
        threaded=False,
        processes=1
    )
