// This is the absolute final, V3.2 background script.
// It combines:
// 1. The TRUE conversation logic.
// 2. The ROBUST response handling.
// 3. The ULTIMATE fileData method for YouTube videos that YOU discovered.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarizePage") {
    handleSummarizeRequest(request, sendResponse);
  } else if (request.action === "askFollowUp") {
    handleFollowUpRequest(request, sendResponse);
  }
  return true;
});

async function handleSummarizeRequest(request, sendResponse) {
  try {
    const settings = await chrome.storage.sync.get(['apiKey', 'model']);
    if (!settings.apiKey || !settings.model) {
      throw new Error("API Key or model is not set in options.");
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) {
      throw new Error("Could not find an active tab. Please try on a regular webpage.");
    }
    let contentToSummarize = "";
    if (tab.url && (tab.url.includes("youtube.com/watch") || tab.url.includes("m.youtube.com/watch"))) {
      contentToSummarize = tab.url;
    } else {
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.body.innerText,
      });
      if (injectionResults && injectionResults[0] && injectionResults[0].result) {
        contentToSummarize = injectionResults[0].result;
      } else {
        throw new Error("Could not retrieve page content from this page.");
      }
    }
    const summary = await callGeminiAPI(settings.apiKey, settings.model, contentToSummarize, (tab.url && tab.url.includes("youtube.com")));
    sendResponse({ success: true, summary: summary });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleFollowUpRequest(request, sendResponse) {
  try {
    const settings = await chrome.storage.sync.get(['apiKey', 'model']);
    if (!settings.apiKey || !settings.model) {
      throw new Error("API Key or model is not set in options.");
    }
    const answer = await callGeminiAPI(settings.apiKey, settings.model, null, false, request.history);
    sendResponse({ success: true, answer: answer });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// THIS IS THE FINAL, CORRECT VERSION OF THE CORE FUNCTION
async function callGeminiAPI(apiKey, model, content, isVideo = false, history = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  let requestBody = {};

  if (history) {
    // Logic for follow-up conversation
    requestBody = { "contents": history };
  } else if (isVideo) {
    // THE ONE TRUE WAY for YouTube videos, using fileData
    requestBody = { "contents": [{"role": "user", "parts": [
      { "text": "你的任务是作为一名专业的视频内容分析师。请用简体中文，完整、详细地总结这个视频的核心内容、关键观点和主要流程。你的总结应该客观、准确，并分点清晰列出关键信息。" },
      { "fileData": {
          "mimeType": "video/youtube",
          "fileUri": content
        }
      }
    ]}]};
  } else {
    // Logic for initial text summary
    const maxContentLength = 15000;
    const truncatedContent = content.substring(0, maxContentLength);
    requestBody = { "contents": [{"role": "user", "parts": [
      { "text": `请用简洁、易于阅读的简体中文总结以下网页内容。请专注于核心信息，忽略所有无关元素，如导航菜单、广告和页脚。总结应清晰、分点，并保持中立的语气。内容如下：\n\n---\n\n${truncatedContent}` }
    ]}]};
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  // Robust response handling logic
  if (!response.ok) {
    try {
      const errorData = await response.json();
      const errorMessage = errorData.error && errorData.error.message ? errorData.error.message : "Unknown API error occurred.";
      throw new Error(`API Error: ${errorMessage}`);
    } catch (e) {
      throw new Error(`API Error: Received status ${response.status} but failed to parse error response.`);
    }
  }

  const responseText = await response.text();
  if (!responseText) {
    throw new Error("API returned an empty response. This may happen if the task is too long or times out.");
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch(e) {
    throw new Error("Failed to parse a non-empty API response as JSON.");
  }
  
  if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0]) {
    return data.candidates[0].content.parts[0].text;
  } else {
    if (data.promptFeedback && data.promptFeedback.blockReason) {
      throw new Error(`Request was blocked by the API for safety reasons: ${data.promptFeedback.blockReason}`);
    }
    throw new Error("No valid response content returned from API.");
  }
}