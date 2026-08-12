/**
 * Cloudflare Workers AI Studio & OpenAI-Compatible API Gateway
 * Multi-Model Chat, Reasoning, Code Generation, and Image Synthesis
 * 100% Free Tier Optimized with Automatic Fallback
 */

const SUPPORTED_MODELS = {
  // 100% Verified Active Cloudflare Workers AI Free Models
  "llama-3.2-3b": "@cf/meta/llama-3.2-3b-instruct",
  "llama-3.2-1b": "@cf/meta/llama-3.2-1b-instruct",
  "mistral-7b": "@cf/mistral/mistral-7b-instruct-v0.1",
  "deepseek-r1-32b": "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  
  // Image Generation Models
  "flux-1-schnell": "@cf/black-forest-labs/flux-1-schnell",
  "dreamshaper-8": "@cf/lykon/dreamshaper-8-lcm"
};

const DEFAULT_MODEL = "deepseek-r1-32b";
const FALLBACK_MODEL = "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // CORS Preflight
    if (request.method === "OPTIONS") {
      return handleCORS();
    }

    try {
      // 1. Root: Serve Glassmorphic AI Studio Dashboard
      if (pathname === "/" || pathname === "/dashboard") {
        return new Response(renderDashboardHTML(), {
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }

      // 2. OpenAI-Compatible Model List: GET /v1/models
      if (pathname === "/v1/models" && request.method === "GET") {
        const modelsList = Object.keys(SUPPORTED_MODELS).map(id => ({
          id,
          object: "model",
          created: 1700000000,
          owned_by: "cloudflare-workers-ai"
        }));
        return jsonResponse({ object: "list", data: modelsList });
      }

      // 3. OpenAI-Compatible Chat Completions: POST /v1/chat/completions
      if (pathname === "/v1/chat/completions" && request.method === "POST") {
        return handleChatCompletion(request, env);
      }

      // 4. Image Generation Endpoint: POST /v1/images/generations
      if (pathname === "/v1/images/generations" && request.method === "POST") {
        return handleImageGeneration(request, env);
      }

      // 5. Health Check: GET /health
      if (pathname === "/health") {
        return jsonResponse({ status: "healthy", timestamp: new Date().toISOString() });
      }

      return jsonResponse({ error: "Endpoint not found" }, 404);
    } catch (err) {
      return jsonResponse({ error: err.message || "Internal Server Error" }, 500);
    }
  }
};

/**
 * Handle OpenAI-Compatible Chat Completions with Automatic Fallback
 */
async function handleChatCompletion(request, env) {
  if (!env || !env.AI) {
    return jsonResponse({ error: "Cloudflare Workers AI binding [AI] is missing in wrangler.toml" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { messages, model = DEFAULT_MODEL, stream = false, temperature = 0.6, max_tokens } = body;

  if (!messages || !Array.isArray(messages)) {
    return jsonResponse({ error: "Invalid request: 'messages' must be an array" }, 400);
  }

  const cfModelName = SUPPORTED_MODELS[model] || SUPPORTED_MODELS[DEFAULT_MODEL];

  // Options object passed to Cloudflare Workers AI
  const aiOptions = { messages, temperature };
  if (max_tokens) {
    aiOptions.max_tokens = max_tokens;
  }

  // Streaming Response (SSE)
  if (stream) {
    let aiStream;
    try {
      aiStream = await env.AI.run(cfModelName, { ...aiOptions, stream: true });
    } catch (streamErr) {
      // Fallback stream to DeepSeek R1 if primary model fails
      try {
        aiStream = await env.AI.run(FALLBACK_MODEL, { ...aiOptions, stream: true });
      } catch (fallbackErr) {
        return jsonResponse({ error: `Cloudflare AI Streaming Error: ${streamErr.message}` }, 500);
      }
    }

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = aiStream.getReader();
        const created = Math.floor(Date.now() / 1000);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const textChunk = new TextDecoder().decode(value);
          const chunkData = {
            id: `chatcmpl-${Date.now()}`,
            object: "chat.completion.chunk",
            created,
            model: actualModelUsed,
            choices: [
              {
                index: 0,
                delta: { content: textChunk },
                finish_reason: null
              }
            ]
          };
          await writer.write(encoder.encode(`data: ${JSON.stringify(chunkData)}\n\n`));
        }

        await writer.write(encoder.encode("data: [DONE]\n\n"));
        await writer.close();
      } catch (err) {
        await writer.abort(err);
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        ...corsHeaders()
      }
    });
  }

  // Non-streaming Response with Automatic Model Fallback
  let aiResponse;
  let actualModelUsed = model;
  try {
    aiResponse = await env.AI.run(cfModelName, aiOptions);
  } catch (aiErr) {
    try {
      aiResponse = await env.AI.run(FALLBACK_MODEL, aiOptions);
      actualModelUsed = "deepseek-r1-32b (Auto-Fallback)";
    } catch (fallbackErr) {
      return jsonResponse({ error: `Cloudflare AI execution error: ${aiErr.message}` }, 500);
    }
  }

  let responseContent = "";
  if (typeof aiResponse === "string") {
    responseContent = aiResponse;
  } else if (aiResponse && typeof aiResponse === "object") {
    if (aiResponse.response) {
      responseContent = aiResponse.response;
    } else if (aiResponse.description) {
      responseContent = aiResponse.description;
    } else if (Array.isArray(aiResponse) && aiResponse[0]) {
      responseContent = aiResponse[0].response || aiResponse[0].text || JSON.stringify(aiResponse[0]);
    } else {
      responseContent = JSON.stringify(aiResponse);
    }
  } else {
    responseContent = String(aiResponse);
  }

  const formattedResponse = {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: actualModelUsed,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: responseContent
        },
        finish_reason: "stop"
      }
    ],
    usage: {
      prompt_tokens: -1,
      completion_tokens: -1,
      total_tokens: -1
    }
  };

  return jsonResponse(formattedResponse);
}

/**
 * Handle AI Image Generation (Flux / DreamShaper)
 */
async function handleImageGeneration(request, env) {
  if (!env || !env.AI) {
    return jsonResponse({ error: "Cloudflare Workers AI binding [AI] is missing in wrangler.toml" }, 500);
  }

  const body = await request.json();
  const { prompt, model = "flux-1-schnell", num_steps = 4 } = body;

  if (!prompt) {
    return jsonResponse({ error: "Prompt is required" }, 400);
  }

  const cfModelName = SUPPORTED_MODELS[model] || SUPPORTED_MODELS["flux-1-schnell"];
  try {
    const imageStream = await env.AI.run(cfModelName, { prompt, num_steps });
    return new Response(imageStream, {
      headers: {
        "Content-Type": "image/jpeg",
        ...corsHeaders()
      }
    });
  } catch (err) {
    return jsonResponse({ error: `Image generation failed (${model}): ${err.message}` }, 500);
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key"
  };
}

function handleCORS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders()
    }
  });
}

/**
 * Embedded Glassmorphic AI Studio Dashboard HTML
 */
function renderDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloudflare Workers AI Studio • Live Gateway & Chat</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #030712;
      --panel: rgba(17, 24, 39, 0.85);
      --panel-border: rgba(255, 255, 255, 0.08);
      --accent: #f97316;
      --accent-glow: rgba(249, 115, 22, 0.35);
      --primary: #818cf8;
      --cyan: #22d3ee;
      --green: #4ade80;
      --text: #f3f4f6;
      --text-dim: #9ca3af;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      background-image: radial-gradient(circle at 15% 15%, rgba(249, 115, 22, 0.08) 0%, transparent 40%),
                        radial-gradient(circle at 85% 85%, rgba(129, 140, 248, 0.08) 0%, transparent 40%);
      color: var(--text);
      font-family: 'Outfit', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      padding: 16px 24px;
      border-bottom: 1px solid var(--panel-border);
      background: rgba(3, 7, 18, 0.8);
      backdrop-filter: blur(20px);
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-icon {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--accent), #ea580c);
      display: grid;
      place-items: center;
      font-size: 18px;
      box-shadow: 0 0 20px var(--accent-glow);
    }
    .logo-title {
      font-size: 17px;
      font-weight: 800;
      color: #fff;
    }
    .logo-badge {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--green);
      background: rgba(74, 222, 128, 0.1);
      border: 1px solid rgba(74, 222, 128, 0.3);
      padding: 2px 8px;
      border-radius: 100px;
    }
    .main-container {
      display: flex;
      flex: 1;
      max-width: 1400px;
      width: 100%;
      margin: 0 auto;
      padding: 20px;
      gap: 20px;
    }
    .sidebar {
      width: 320px;
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      backdrop-filter: blur(20px);
    }
    .sidebar-section h4 {
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 8px;
    }
    select, input {
      width: 100%;
      padding: 10px 14px;
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      color: #fff;
      font-family: 'Outfit', sans-serif;
      font-size: 13px;
      outline: none;
      transition: all 0.2s;
    }
    select:focus, input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 12px var(--accent-glow);
    }
    .api-badge-card {
      background: rgba(0, 0, 0, 0.3);
      border: 1px dashed rgba(249, 115, 22, 0.4);
      border-radius: 12px;
      padding: 12px;
      font-size: 12px;
    }
    .api-url-code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--cyan);
      background: rgba(34, 211, 238, 0.1);
      padding: 6px 8px;
      border-radius: 6px;
      display: block;
      margin-top: 6px;
      word-break: break-all;
    }
    .chat-container {
      flex: 1;
      background: var(--panel);
      border: 1px solid var(--panel-border);
      border-radius: 20px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      backdrop-filter: blur(20px);
    }
    .chat-messages {
      flex: 1;
      padding: 24px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 480px;
    }
    .msg {
      max-width: 80%;
      padding: 14px 18px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.6;
    }
    .msg-user {
      align-self: flex-end;
      background: linear-gradient(135deg, var(--accent), #ea580c);
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    .msg-ai {
      align-self: flex-start;
      background: rgba(31, 41, 55, 0.7);
      border: 1px solid var(--panel-border);
      color: var(--text);
      border-bottom-left-radius: 4px;
    }
    .chat-input-box {
      padding: 16px 20px;
      background: rgba(3, 7, 18, 0.7);
      border-top: 1px solid var(--panel-border);
      display: flex;
      gap: 12px;
    }
    .chat-input-box input {
      flex: 1;
      font-size: 14px;
      padding: 12px 18px;
      border-radius: 100px;
    }
    .send-btn {
      background: linear-gradient(135deg, var(--accent), #ea580c);
      color: #fff;
      border: none;
      padding: 0 24px;
      border-radius: 100px;
      font-family: 'Outfit', sans-serif;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
      box-shadow: 0 0 20px var(--accent-glow);
      transition: transform 0.2s;
    }
    .send-btn:hover { transform: scale(1.04); }
    footer {
      text-align: center;
      padding: 12px;
      font-size: 12px;
      color: var(--text-dim);
      border-top: 1px solid var(--panel-border);
    }
    @media(max-width: 860px) {
      .main-container { flex-direction: column; }
      .sidebar { width: 100%; }
    }
  </style>
</head>
<body>
  <header>
    <div class="logo-box">
      <div class="logo-icon">⚡</div>
      <div class="logo-title">Cloudflare Workers AI Studio</div>
      <span class="logo-badge">● Native AI Binding</span>
    </div>
    <a href="https://ziploot.app" target="_blank" style="color: var(--text-dim); font-size: 12px; text-decoration: none;">
      Powered by <strong style="color: #fff;">ziploot.app</strong> ➔
    </a>
  </header>

  <div class="main-container">
    <aside class="sidebar">
      <div class="sidebar-section">
        <h4>Select AI Model</h4>
        <select id="modelSelect">
          <option value="deepseek-r1-32b" selected>🧠 DeepSeek R1 Distill 32B (Top Reasoning)</option>
          <option value="llama-3.1-8b">⚡ Llama 3.1 8B Instruct (Ultra Fast)</option>
          <option value="llama-3-8b">🦙 Llama 3 8B Instruct</option>
          <option value="mistral-7b">🌪️ Mistral 7B Instruct v0.2</option>
          <option value="gemma-7b">💎 Google Gemma 7B IT</option>
          <option value="qwen-1.5-7b">🌐 Qwen 1.5 7B Chat</option>
          <option value="phi-2">⚡ Microsoft Phi-2</option>
        </select>
      </div>

      <div class="sidebar-section">
        <h4>OpenAI Compatibility</h4>
        <div class="api-badge-card">
          <span style="color: var(--text-dim);">API Base URL:</span>
          <code class="api-url-code" id="apiEndpointUrl">/v1/chat/completions</code>
          <p style="margin-top: 8px; font-size: 11px; color: var(--text-dim);">
            Connect directly to LibreChat, NextChat, Cursor, or OpenWebUI.
          </p>
        </div>
      </div>

      <div class="sidebar-section">
        <h4>System Prompt</h4>
        <input type="text" id="systemPrompt" value="You are a helpful, brilliant AI assistant." />
      </div>
    </aside>

    <main class="chat-container">
      <div class="chat-messages" id="chatMessages">
        <div class="msg msg-ai">
          👋 Welcome to your <strong>Cloudflare Workers AI Studio</strong>! Select any model on the left and ask me anything.
        </div>
      </div>

      <div class="chat-input-box">
        <input type="text" id="userInput" placeholder="Type your message here..." onkeydown="if(event.key==='Enter') sendMessage()" />
        <button class="send-btn" onclick="sendMessage()" id="sendBtn">Send ➔</button>
      </div>
    </main>
  </div>

  <footer>
    Cloudflare Workers AI Gateway • 100% Free Tier Optimized &amp; Auto-Fallback Protected
  </footer>

  <script>
    document.getElementById('apiEndpointUrl').textContent = (window.location.protocol === 'file:' ? 'https://cloudflare-workers-ai-gateway.sikuroybd.workers.dev' : window.location.origin) + '/v1/chat/completions';

    async function sendMessage() {
      const input = document.getElementById('userInput');
      const text = input.value.trim();
      if (!text) return;

      const modelSelect = document.getElementById('modelSelect');
      const model = modelSelect ? modelSelect.value : 'deepseek-r1-32b';
      const systemPromptEl = document.getElementById('systemPrompt');
      const systemPrompt = systemPromptEl ? systemPromptEl.value : 'You are a helpful assistant.';
      const targetWorkerEl = document.getElementById('targetWorkerUrl');
      const targetWorker = targetWorkerEl ? targetWorkerEl.value.trim() : '';
      const chatBox = document.getElementById('chatMessages');

      // Append User message cleanly via DOM
      const userDiv = document.createElement('div');
      userDiv.className = 'msg msg-user';
      userDiv.textContent = text;
      chatBox.appendChild(userDiv);

      input.value = '';
      chatBox.scrollTop = chatBox.scrollHeight;

      // Temporary AI typing bubble
      const aiMsgId = 'msg-' + Date.now();
      const aiDiv = document.createElement('div');
      aiDiv.className = 'msg msg-ai';
      aiDiv.id = aiMsgId;
      aiDiv.innerHTML = '⚡ Thinking with <strong>' + escapeHTML(model) + '</strong>...';
      chatBox.appendChild(aiDiv);

      chatBox.scrollTop = chatBox.scrollHeight;

      let apiEndpoint = '/v1/chat/completions';
      if (targetWorker) {
        let cleanUrl = targetWorker;
        if (cleanUrl.endsWith('/')) { cleanUrl = cleanUrl.slice(0, -1); }
        apiEndpoint = cleanUrl + '/v1/chat/completions';
      } else if (!window.location.hostname.includes('workers.dev')) {
        apiEndpoint = 'https://cloudflare-workers-ai-gateway.sikuroybd.workers.dev/v1/chat/completions';
      }

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: text }
            ]
          })
        });

        const rawText = await response.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          const aiMsgDiv = document.getElementById(aiMsgId);
          aiMsgDiv.innerHTML = '<span style="color:#ef4444;">❌ Server Error (' + response.status + '): ' + escapeHTML(rawText.slice(0, 200)) + '</span>';
          return;
        }

        const aiMsgDiv = document.getElementById(aiMsgId);
        if (data.choices && data.choices[0] && data.choices[0].message) {
          var modelBadge = '<div style="font-size: 11px; font-weight: 700; color: #818cf8; margin-bottom: 8px; font-family: monospace; letter-spacing: 0.5px;">⚡ Model: ' + escapeHTML(data.model || model) + '</div>';
          aiMsgDiv.innerHTML = modelBadge + formatMarkdown(data.choices[0].message.content);
        } else if (data.error) {
          const errStr = typeof data.error === 'object' ? (data.error.message || JSON.stringify(data.error)) : data.error;
          aiMsgDiv.innerHTML = '<span style="color:#ef4444;">❌ ' + escapeHTML(errStr) + '</span>';
        } else {
          aiMsgDiv.innerHTML = formatMarkdown(JSON.stringify(data));
        }
      } catch (err) {
        const aiMsgDiv = document.getElementById(aiMsgId);
        if (aiMsgDiv) {
          aiMsgDiv.innerHTML = '<span style="color:#ef4444;">❌ Connection Failed: ' + escapeHTML(err.message) + '</span>';
        }
      }
      chatBox.scrollTop = chatBox.scrollHeight;
    }

    function escapeHTML(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatMarkdown(str) {
      if (!str) return '';
      var html = escapeHTML(str);
      var thinkRegex = new RegExp('&lt;think&gt;([' + String.fromCharCode(92) + 's' + String.fromCharCode(92) + 'S]*?)&lt;' + String.fromCharCode(92) + '/think&gt;', 'gi');
      html = html.replace(thinkRegex, function(match, p1) {
        return '<details style="background: rgba(2, 6, 23, 0.7); border-left: 3px solid #c084fc; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px; font-size: 12.5px; color: #cbd5e1;"><summary style="cursor: pointer; font-weight: 700; color: #c084fc;">💭 AI Reasoning Chain (Click to expand)</summary><div style="margin-top: 10px; white-space: pre-wrap; font-family: monospace; line-height: 1.5; color: #94a3b8;">' + p1.trim() + '</div></details>';
      });
      return html.split(String.fromCharCode(10)).join('<br/>');
    }

    window.addEventListener('DOMContentLoaded', function() {
      var btn = document.getElementById('sendBtn');
      var inp = document.getElementById('userInput');
      if (btn) btn.addEventListener('click', sendMessage);
      if (inp) {
        inp.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') sendMessage();
        });
      }
    });
  </script>
</body>
</html>`;
}
