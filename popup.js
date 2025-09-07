// 这是最终的、实现了独立复制按钮的V3.6版本popup脚本

document.addEventListener('DOMContentLoaded', function() {
  // --- 获取所有需要的元素 ---
  const statusDiv = document.getElementById('status-message');
  const chatContainer = document.getElementById('chat-container');
  const followUpContainer = document.getElementById('follow-up-container');
  const questionInput = document.getElementById('question-input');
  const sendButton = document.getElementById('send-button');
  const footer = document.getElementById('footer');
  const settingsLink = document.getElementById('settings-link');
  // [删除] const copyButton = ... 已经不再需要

  // 存储聊天消息的数组
  let messages = [];

  // --- 升级后的、更安全的渲染函数 ---
  function renderChat() {
    chatContainer.innerHTML = ''; // 每次渲染都清空
    messages.forEach(msg => {
      const messageElement = document.createElement('div');
      messageElement.classList.add('message');
      messageElement.classList.add(msg.role === 'user' ? 'user-message' : 'model-message');
      
      if (msg.role === 'model') {
        // 使用marked.js将Markdown解析为HTML
        const dirtyHtml = marked.parse(msg.content);
        const cleanFragment = new DOMParser().parseFromString(dirtyHtml, 'text/html').body;
        while (cleanFragment.firstChild) {
          messageElement.appendChild(cleanFragment.firstChild);
        }

        // --- [新增] 为每条AI消息创建并添加独立的复制按钮 ---
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.title = '复制此条消息';
        copyBtn.innerHTML = '📋';

        copyBtn.addEventListener('click', function() {
          // 点击时，复制这条消息的原始内容 (msg.content)
          navigator.clipboard.writeText(msg.content).then(() => {
            copyBtn.innerHTML = '✔️'; // 成功后显示对勾
            setTimeout(() => {
              copyBtn.innerHTML = '📋'; // 1.5秒后恢复图标
            }, 1500);
          });
        });

        messageElement.appendChild(copyBtn); // 将按钮添加到消息元素中
        // --- 新增逻辑结束 ---

      } else {
        // 用户消息只显示纯文本
        messageElement.textContent = msg.content;
      }
      chatContainer.appendChild(messageElement);
    });
    // 自动滚动到底部
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // --- 初始总结请求 ---
  statusDiv.textContent = '正在向Gemini请求总结...';
  chrome.runtime.sendMessage({ action: "summarizePage" }, (response) => {
    if (chrome.runtime.lastError) {
      statusDiv.textContent = `错误: ${chrome.runtime.lastError.message}`;
      return;
    }
    if (response.success) {
      statusDiv.classList.add('hidden');
      messages.push({ role: 'model', content: response.summary });
      renderChat();
      // --- 成功后显示UI元素 ---
      followUpContainer.classList.remove('hidden');
      footer.classList.remove('hidden');
      // [删除] copyButton.classList.remove('hidden') 已经不再需要
    } else {
      statusDiv.textContent = `错误: ${response.error}`;
    }
  });

  // --- 所有事件监听器 ---
  settingsLink.addEventListener('click', function() {
    chrome.runtime.openOptionsPage();
  });

  // [删除] 旧的全局复制按钮的整个事件监听器已被移除

  sendButton.addEventListener('click', handleSend);
  questionInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') { handleSend(); }
  });

  function handleSend() {
    const question = questionInput.value.trim();
    if (!question) return;

    messages.push({ role: 'user', content: question });
    messages.push({ role: 'model', content: '...' });
    renderChat();
    questionInput.value = '';

    const apiHistory = messages.slice(0, -1).map(msg => ({
      role: msg.role,
      parts: [{ "text": msg.content }]
    }));

    chrome.runtime.sendMessage({ action: "askFollowUp", history: apiHistory }, (response) => {
      messages.pop();
      if (response.success) {
        messages.push({ role: 'model', content: response.answer });
      } else {
        messages.push({ role: 'model', content: `抱歉，出错了: ${response.error}` });
      }
      renderChat();
    });
  }
});