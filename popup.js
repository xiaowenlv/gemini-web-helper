// This is the final, STABLE version of the popup script.
// It is designed to work with the non-streaming background script.

document.addEventListener('DOMContentLoaded', function() {
  const statusDiv = document.getElementById('status-message');
  const resultDiv = document.getElementById('result-container');
  
  const copyButton = document.getElementById('copy-button');
  const followUpContainer = document.getElementById('follow-up-container');
  const questionInput = document.getElementById('question-input');
  const sendButton = document.getElementById('send-button');

  let conversationHistory = "";

  statusDiv.textContent = '正在向Gemini请求总结...';
  // This expects ONE single response from the background script.
  chrome.runtime.sendMessage({ action: "summarizePage" }, handleResponse);

  function handleResponse(response) {
    if (chrome.runtime.lastError) {
      statusDiv.textContent = `错误: ${chrome.runtime.lastError.message}`;
      return;
    }
    if (response.success) {
      statusDiv.classList.add('hidden');
      conversationHistory = response.summary;
      resultDiv.textContent = conversationHistory;
      resultDiv.classList.remove('hidden');
      copyButton.classList.remove('hidden');
      followUpContainer.classList.remove('hidden');
    } else {
      statusDiv.textContent = `错误: ${response.error}`;
    }
  }
  
  copyButton.addEventListener('click', function() {
    navigator.clipboard.writeText(resultDiv.textContent).then(() => {
      copyButton.textContent = '✔️';
      setTimeout(() => {
        copyButton.textContent = '📋';
      }, 1000);
    });
  });

  sendButton.addEventListener('click', handleSend);
  questionInput.addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {
      handleSend();
    }
  });

  // This is the simulated conversation logic that we know works.
  function handleSend() {
    const question = questionInput.value.trim();
    if (!question) return;

    const thinkingMessage = '... 正在思考中，请稍候 ...';
    
    conversationHistory += `\n\n> 你的问题: ${question}`;
    conversationHistory += `\n\n${thinkingMessage}`;
    
    resultDiv.textContent = conversationHistory;
    questionInput.value = '';
    resultDiv.scrollTop = resultDiv.scrollHeight; 

    setTimeout(() => {
      const finalResponse = `... (后续对话功能正在开发中!)`;
      conversationHistory = conversationHistory.replace(thinkingMessage, finalResponse);
      resultDiv.textContent = conversationHistory;
      resultDiv.scrollTop = resultDiv.scrollHeight; 
    }, 1500);
  }
});