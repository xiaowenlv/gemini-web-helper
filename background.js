// This is the final, STABLE, non-streaming version of the background script.
// It reliably summarizes both pages and YouTube videos.

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "summarizePage") {
    (async () => {
      try {
        const settings = await chrome.storage.sync.get(['apiKey', 'model']);
        if (!settings.apiKey || !settings.model) {
          throw new Error("API Key or model is not set in options.");
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          throw new Error("Could not find an active tab. Please try on a regular webpage.");
        }

        let summary = "";

        if (tab.url && (tab.url.includes("youtube.com/watch") || tab.url.includes("m.youtube.com/watch"))) {
          summary = await callGeminiAPI(tab.url, settings.apiKey, settings.model, true);
        } else {
          const injectionResults = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => document.body.innerText,
          });

          if (injectionResults && injectionResults[0] && injectionResults[0].result) {
            const pageContent = injectionResults[0].result;
            summary = await callGeminiAPI(pageContent, settings.apiKey, settings.model, false);
          } else {
            throw new Error("Could not retrieve page content from this page.");
          }
        }
        
        sendResponse({ success: true, summary: summary });

      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});

async function callGeminiAPI(content, apiKey, model, isVideo = false) {
  // We are using the standard, reliable :generateContent endpoint.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  let requestBody = {};

  if (isVideo) {
    requestBody = {
      "contents": [{
        "parts": [
          { "text": "请用简体中文，完整、详细地总结这个视频的核心内容。你的总结应该客观、准确，并分点清晰列出关键信息。" },
          { "fileData": {
              "mimeType": "video/youtube",
              "fileUri": content
            }
          }
        ]
      }]
    };
  } else {
    const maxContentLength = 15000;
    const truncatedContent = content.substring(0, maxContentLength);
    const prompt = `请用简洁、易于阅读的简体中文总结以下网页内容。请专注于核心信息，忽略所有无关元素，如导航菜单、广告和页脚。总结应清晰、分点，并保持中立的语气。内容如下：\n\n---\n\n${truncatedContent}`;
    requestBody = {
      "contents": [{"parts":[{"text": prompt}]}]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json();

  if (response.ok) {
    if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts[0]) {
      return data.candidates[0].content.parts[0].text;
    } else {
      if (data.promptFeedback && data.promptFeedback.blockReason) {
        throw new Error(`Request was blocked by the API for safety reasons: ${data.promptFeedback.blockReason}`);
      }
      throw new Error("No valid response returned from API.");
    }
  } else {
    const errorMessage = data.error && data.error.message ? data.error.message : "Unknown API error occurred.";
    throw new Error(`API Error: ${errorMessage}`);
  }
}