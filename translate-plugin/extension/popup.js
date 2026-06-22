// 状态管理
let settings = {
  enabled: true,
  serverUrl: 'http://localhost:5000'
};

// 初始化
async function init() {
  // 加载设置
  const stored = await chrome.storage.local.get(['enabled', 'serverUrl']);
  settings = { ...settings, ...stored };

  // 更新UI
  updateToggleUI();
  document.getElementById('serverUrl').value = settings.serverUrl;

  // 检查服务状态
  checkServerStatus();
}

// 更新开关UI
function updateToggleUI() {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const toggleText = document.getElementById('toggleText');
  const toggleIcon = document.getElementById('toggleIcon');
  const mainToggle = document.getElementById('mainToggle');

  if (settings.enabled) {
    toggleSwitch.classList.add('active');
    toggleText.textContent = '已启用';
    toggleIcon.textContent = '✨';
    mainToggle.classList.remove('disabled');
  } else {
    toggleSwitch.classList.remove('active');
    toggleText.textContent = '已关闭';
    toggleIcon.textContent = '💤';
    mainToggle.classList.add('disabled');
  }
}

// 检查翻译服务状态
async function checkServerStatus() {
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  if (!settings.enabled) {
    statusDot.className = 'status-dot';
    statusText.textContent = '划词翻译已关闭';
    return;
  }

  try {
    const response = await fetch(`${settings.serverUrl}/health`, {
      method: 'GET',
      mode: 'cors'
    });
    if (response.ok) {
      const data = await response.json();
      const enabledEngines = Object.entries(data.engines)
        .filter(([k, v]) => v.enabled)
        .map(([k, v]) => v.name);

      statusDot.className = 'status-dot connected';
      statusText.textContent = `服务正常 | ${enabledEngines.join(', ')}`;
    } else {
      throw new Error('Service unavailable');
    }
  } catch (error) {
    statusDot.className = 'status-dot';
    statusText.textContent = '服务未启动，请运行 server.py';
  }
}

// 主开关点击事件
document.getElementById('mainToggle').addEventListener('click', async () => {
  settings.enabled = !settings.enabled;
  await chrome.storage.local.set({ enabled: settings.enabled });
  updateToggleUI();
  checkServerStatus();

  // 通知内容脚本
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    chrome.tabs.sendMessage(tab.id, {
      action: 'toggleEnabled',
      enabled: settings.enabled
    }).catch(() => {});
  }
});

// 服务器地址变更
document.getElementById('serverUrl').addEventListener('change', async (e) => {
  settings.serverUrl = e.target.value;
  await chrome.storage.local.set({ serverUrl: settings.serverUrl });
  checkServerStatus();
});

init();
