// 划词翻译插件 - 浮动卡片版
(function() {
  'use strict';

  // 配置
  const CONFIG = {
    SERVER_URL: 'http://localhost:5000',
    CACHE_SIZE: 100,
    SELECTION_DELAY: 300,
    MIN_TEXT_LENGTH: 1
  };

  // 状态
  let isEnabled = true;
  let currentCard = null;
  let selectionTimer = null;
  let translationCache = new Map();
  let isLoading = false;

  // 加载设置
  chrome.storage.local.get(['enabled', 'serverUrl'], (result) => {
    if (result.enabled !== undefined) {
      isEnabled = result.enabled;
    }
    if (result.serverUrl) {
      CONFIG.SERVER_URL = result.serverUrl;
    }
  });

  // 判断是否是单词（纯字母，无空格和标点）
  function isWord(text) {
    return /^[a-zA-Z]+$/.test(text.trim()) && text.trim().length > 0;
  }

  // 判断是否是短语（2-5个单词）
  function isPhrase(text) {
    const words = text.trim().split(/\s+/);
    return words.length >= 2 && words.length <= 5 && /^[a-zA-Z\s]+$/.test(text.trim());
  }

  // 获取选中文本
  function getSelectedText() {
    const selection = window.getSelection();
    return selection ? selection.toString().trim() : '';
  }

  // 清除选区
  function clearSelection() {
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }

  // 创建卡片HTML - 单词模式
  function createWordCardHTML(data) {
    const phonetic = data.phonetic || '';
    const meanings = data.meanings || [];
    const examples = data.examples || [];

    let meaningsHTML = meanings.map(m => `
      <div class="tr-meaning">
        <span class="tr-pos">${m.pos}</span>
        <span class="tr-def">${m.def}</span>
      </div>
    `).join('');

    let examplesHTML = examples.length > 0 ? `
      <div class="tr-examples">
        <div class="tr-section-title">例句</div>
        ${examples.map(e => `
          <div class="tr-example">
            <div class="tr-en">${e.en}</div>
            <div class="tr-cn">${e.cn}</div>
          </div>
        `).join('')}
      </div>
    ` : '';

    return `
      <div class="tr-card-header">
        <div class="tr-word-title">
          <span class="tr-word">${data.word}</span>
          ${phonetic ? `<span class="tr-phonetic">${phonetic}</span>` : ''}
        </div>
        <button class="tr-close-btn" title="关闭">×</button>
      </div>
      <div class="tr-card-body">
        <div class="tr-meanings">
          ${meaningsHTML}
        </div>
        ${examplesHTML}
      </div>
      <div class="tr-card-footer">
        <span class="tr-engine">${data.engine || '翻译引擎'}</span>
      </div>
    `;
  }

  // 创建卡片HTML - 句子/短语模式
  function createSentenceCardHTML(data) {
    return `
      <div class="tr-card-header">
        <div class="tr-sentence-title">翻译结果</div>
        <button class="tr-close-btn" title="关闭">×</button>
      </div>
      <div class="tr-card-body">
        <div class="tr-source-text">${data.source}</div>
        <div class="tr-divider"></div>
        <div class="tr-translation">${data.translation}</div>
      </div>
      <div class="tr-card-footer">
        <span class="tr-engine">${data.engine || '翻译引擎'}</span>
      </div>
    `;
  }

  // 创建加载状态HTML
  function createLoadingHTML(text) {
    const isWordMode = isWord(text);
    return `
      <div class="tr-card-header">
        <div class="tr-word-title">
          <span class="tr-word">${text.substring(0, 30)}${text.length > 30 ? '...' : ''}</span>
        </div>
        <button class="tr-close-btn" title="关闭">×</button>
      </div>
      <div class="tr-card-body tr-loading-body">
        <div class="tr-loading">
          <div class="tr-spinner"></div>
          <span>${isWordMode ? '查询单词中...' : '翻译中...'}</span>
        </div>
      </div>
    `;
  }

  // 创建翻译卡片
  function createTranslationCard(x, y, text) {
    // 移除旧卡片
    removeCard();

    const card = document.createElement('div');
    card.id = 'tr-translation-card';
    card.className = 'tr-translation-card';
    card.innerHTML = createLoadingHTML(text);

    // 计算位置
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const cardWidth = 320;
    const cardHeight = 200;

    let left = x + 15;
    let top = y + 15;

    // 边界检查
    if (left + cardWidth > viewportWidth - 20) {
      left = x - cardWidth - 10;
    }
    if (top + cardHeight > viewportHeight - 20) {
      top = y - cardHeight - 10;
    }
    if (left < 20) left = 20;
    if (top < 20) top = 20;

    card.style.left = `${left}px`;
    card.style.top = `${top}px`;

    document.body.appendChild(card);
    currentCard = card;

    // 绑定关闭按钮
    const closeBtn = card.querySelector('.tr-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCard();
      });
    }

    // 点击卡片外部关闭
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 100);

    return card;
  }

  // 点击外部关闭
  function handleOutsideClick(e) {
    if (currentCard && !currentCard.contains(e.target)) {
      removeCard();
    }
  }

  // 移除卡片
  function removeCard() {
    if (currentCard) {
      currentCard.remove();
      currentCard = null;
    }
    document.removeEventListener('click', handleOutsideClick);
  }

  // 更新卡片内容
  function updateCardContent(data, mode) {
    if (!currentCard) return;

    if (mode === 'word') {
      currentCard.innerHTML = createWordCardHTML(data);
    } else {
      currentCard.innerHTML = createSentenceCardHTML(data);
    }

    // 重新绑定关闭按钮
    const closeBtn = currentCard.querySelector('.tr-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeCard();
      });
    }
  }

  // 调用翻译API
  async function translateText(text) {
    // 检查缓存
    if (translationCache.has(text)) {
      return translationCache.get(text);
    }

    try {
      const response = await fetch(`${CONFIG.SERVER_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '翻译失败');
      }

      // 存入缓存
      if (translationCache.size >= CONFIG.CACHE_SIZE) {
        const firstKey = translationCache.keys().next().value;
        translationCache.delete(firstKey);
      }
      translationCache.set(text, data);

      return data;
    } catch (error) {
      console.error('翻译错误:', error);
      return {
        success: false,
        error: error.message,
        translation: '翻译服务暂时不可用'
      };
    }
  }

  // 解析单词释义（模拟词典数据）
  function parseWordDetails(text, translation, engine) {
    // 这里简化处理，实际可以接入词典API
    // 根据翻译结果猜测词性和释义

    const meanings = [];
    const lines = translation.split(/[,;；]/).filter(l => l.trim());

    // 简单分配词性（实际应使用词典API）
    lines.forEach((line, index) => {
      let pos = '';
      if (index === 0) {
        // 第一个释义猜测词性
        const word = text.toLowerCase();
        // 简单规则判断
        if (/tion$|ment$|ness$|ity$|er$|or$|ism$/.test(word)) pos = 'n.';
        else if (/ly$/.test(word)) pos = 'adv.';
        else if (/ful$|ous$|ive$|able$|ible$|al$|ic$/.test(word)) pos = 'adj.';
        else if (/ate$|ify$|ize$|ise$|en$/.test(word)) pos = 'v.';
        else pos = '';
      }
      meanings.push({
        pos: pos,
        def: line.trim()
      });
    });

    return {
      word: text,
      phonetic: '', // 实际应获取音标
      meanings: meanings,
      examples: [], // 实际应获取例句
      engine: engine
    };
  }

  // 处理选中文本
  async function handleSelection(e) {
    // 检查是否启用
    if (!isEnabled) {
      return;
    }

    const text = getSelectedText();

    if (!text || text.length < CONFIG.MIN_TEXT_LENGTH) {
      return;
    }

    // 只处理包含英文的文本
    if (!/[a-zA-Z]/.test(text)) {
      return;
    }

    isLoading = true;

    // 创建卡片（加载状态）
    createTranslationCard(e.clientX, e.clientY, text);

    // 调用翻译
    const result = await translateText(text);

    if (!currentCard) {
      isLoading = false;
      return;
    }

    if (result.success) {
      const isWordMode = isWord(text);

      if (isWordMode) {
        // 单词模式 - 显示详细释义
        const wordData = parseWordDetails(text, result.translation, result.engine_name || result.engine);
        updateCardContent(wordData, 'word');
      } else {
        // 句子/短语模式
        updateCardContent({
          source: text,
          translation: result.translation,
          engine: result.engine_name || result.engine
        }, 'sentence');
      }
    } else {
      // 错误状态
      currentCard.innerHTML = `
        <div class="tr-card-header">
          <div class="tr-word-title">
            <span class="tr-word">翻译失败</span>
          </div>
          <button class="tr-close-btn" title="关闭">×</button>
        </div>
        <div class="tr-card-body">
          <div class="tr-error">${result.error || '请检查翻译服务是否运行'}</div>
        </div>
      `;

      const closeBtn = currentCard.querySelector('.tr-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeCard();
        });
      }
    }

    isLoading = false;
  }

  // 防抖函数
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  // 监听选中文本
  const debouncedHandleSelection = debounce(handleSelection, CONFIG.SELECTION_DELAY);

  document.addEventListener('mouseup', (e) => {
    // 忽略右键
    if (e.button !== 0) return;

    // 忽略点击在卡片上的情况
    if (e.target.closest('#tr-translation-card')) return;

    // 延迟处理，等待选区完成
    setTimeout(() => {
      const text = getSelectedText();
      if (text && text.length >= CONFIG.MIN_TEXT_LENGTH && /[a-zA-Z]/.test(text)) {
        debouncedHandleSelection(e);
      }
    }, 50);
  });

  // 监听键盘选择
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Meta') {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        debouncedHandleSelection({
          clientX: rect.left + rect.width / 2,
          clientY: rect.bottom + 10
        });
      }
    }
  });

  // 监听来自popup的消息（清理用）
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'toggleEnabled') {
      isEnabled = request.enabled;
      if (!isEnabled && currentCard) {
        removeCard();
      }
    }
    if (request.action === 'clearTranslation') {
      removeCard();
    }
  });

  // 添加样式
  const style = document.createElement('style');
  style.textContent = `
    /* 翻译卡片 */
    .tr-translation-card {
      position: fixed;
      width: 320px;
      max-height: 400px;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.1);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      overflow: hidden;
      animation: tr-fade-in 0.2s ease;
      border: 1px solid rgba(0, 0, 0, 0.08);
    }

    @keyframes tr-fade-in {
      from {
        opacity: 0;
        transform: translateY(-10px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    /* 卡片头部 */
    .tr-card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .tr-word-title {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }

    .tr-word {
      font-size: 18px;
      font-weight: 600;
      color: white;
    }

    .tr-phonetic {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.85);
      font-family: 'Segoe UI', 'Arial', sans-serif;
    }

    .tr-sentence-title {
      font-size: 14px;
      font-weight: 500;
      color: white;
    }

    .tr-close-btn {
      width: 24px;
      height: 24px;
      border: none;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      padding: 0;
      margin-left: 8px;
    }

    .tr-close-btn:hover {
      background: rgba(255, 255, 255, 0.35);
    }

    /* 卡片主体 */
    .tr-card-body {
      padding: 16px;
      max-height: 300px;
      overflow-y: auto;
    }

    .tr-card-body::-webkit-scrollbar {
      width: 6px;
    }

    .tr-card-body::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }

    .tr-card-body::-webkit-scrollbar-thumb {
      background: #ccc;
      border-radius: 3px;
    }

    /* 单词释义 */
    .tr-meanings {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .tr-meaning {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .tr-pos {
      color: #667eea;
      font-weight: 500;
      font-size: 13px;
      min-width: 35px;
      flex-shrink: 0;
    }

    .tr-def {
      color: #333;
      flex: 1;
    }

    /* 例句 */
    .tr-examples {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #eee;
    }

    .tr-section-title {
      font-size: 12px;
      color: #999;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .tr-example {
      margin-bottom: 10px;
    }

    .tr-en {
      color: #333;
      font-size: 13px;
      margin-bottom: 3px;
    }

    .tr-cn {
      color: #666;
      font-size: 12px;
    }

    /* 句子翻译 */
    .tr-source-text {
      color: #666;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 12px;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 8px;
      border-left: 3px solid #667eea;
    }

    .tr-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, #ddd, transparent);
      margin: 12px 0;
    }

    .tr-translation {
      color: #333;
      font-size: 15px;
      line-height: 1.6;
      font-weight: 500;
    }

    /* 加载状态 */
    .tr-loading-body {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100px;
    }

    .tr-loading {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #666;
    }

    .tr-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #e0e0e0;
      border-top-color: #667eea;
      border-radius: 50%;
      animation: tr-spin 0.8s linear infinite;
    }

    @keyframes tr-spin {
      to { transform: rotate(360deg); }
    }

    /* 错误状态 */
    .tr-error {
      color: #e74c3c;
      text-align: center;
      padding: 20px;
    }

    /* 卡片底部 */
    .tr-card-footer {
      padding: 10px 16px;
      background: #f8f9fa;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: flex-end;
    }

    .tr-engine {
      font-size: 11px;
      color: #999;
    }
  `;
  document.head.appendChild(style);

  console.log('划词翻译插件已加载');
})();
