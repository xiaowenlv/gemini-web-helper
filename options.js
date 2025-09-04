// This is the "brain" for our options page.
// The code is now clean and all user-facing messages are in Chinese.

document.addEventListener('DOMContentLoaded', function() {
  const apiKeyInput = document.getElementById('apiKey');
  const modelSelect = document.getElementById('model');
  const saveButton = document.getElementById('save');
  const testButton = document.getElementById('test');
  const statusDiv = document.getElementById('status');

  function showStatus(message, isError = false) {
    statusDiv.textContent = message;
    statusDiv.className = isError ? 'error' : 'success';
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }

  // Load saved data
  chrome.storage.sync.get(['apiKey', 'model'], function(result) {
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
    if (result.model) {
      modelSelect.value = result.model;
    }
  });

  // Save data listener
  saveButton.addEventListener('click', function() {
    const apiKey = apiKeyInput.value;
    const model = modelSelect.value;
    chrome.storage.sync.set({ apiKey: apiKey, model: model }, function() {
      showStatus('设置已保存！');
    });
  });

  // Test connection listener
  testButton.addEventListener('click', async function() {
    const apiKey = apiKeyInput.value;
    const model = modelSelect.value;

    if (!apiKey) {
      showStatus('请先输入API Key！', true);
      return;
    }

    statusDiv.className = '';
    statusDiv.style.display = 'block';
    statusDiv.textContent = '测试中，请稍候...';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          "contents": [{"parts":[{"text": "Hello"}]}]
        })
      });

      const data = await response.json();

      if (response.ok) {
        showStatus('连接成功！');
      } else {
        showStatus(`连接失败: ${data.error.message}`, true);
      }
    } catch (error) {
      showStatus(`网络错误: ${error.message}`, true);
    }
  });
});