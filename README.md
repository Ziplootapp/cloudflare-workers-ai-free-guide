# ⚡ Cloudflare Workers AI Studio & OpenAI-Compatible API Gateway

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Ziplootapp/cloudflare-workers-ai-free-guide)
[![License: MIT](https://img.shields.io/badge/License-MIT-4ade80.svg)](LICENSE)
[![Platform: Cloudflare Workers](https://img.shields.io/badge/Platform-Cloudflare%20Workers%20AI-f97316.svg?logo=cloudflare)](https://workers.cloudflare.com)
[![Models: Llama 3.2 | DeepSeek R1 | Mistral 7B](https://img.shields.io/badge/Models-Llama%203.2%20%7C%20DeepSeek%20R1%20%7C%20Mistral%207B-818cf8.svg)](https://developers.cloudflare.com/workers-ai/)

Deploy a **100% Free, Serverless OpenAI-Compatible AI API Gateway & Multi-Model Chat Studio** on Cloudflare Workers AI with **1 Click**.

---

## 🚀 1-Click Instant Deployment

### Option 1: Web Browser 1-Click Button
Click the button below to automatically clone and deploy this gateway directly to your Cloudflare account:

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/Ziplootapp/cloudflare-workers-ai-free-guide)

---

### Option 2: Windows PowerShell 1-Line Command
Copy and paste this single command into Windows PowerShell to automatically set up dependencies and deploy to Cloudflare in 1 Click:

```powershell
iwr https://raw.githubusercontent.com/Ziplootapp/cloudflare-workers-ai-free-guide/main/deploy_1click.ps1 -OutFile deploy.ps1; .\deploy.ps1
```

---

## 🌟 Supported AI Models (100% Active Catalog)

| Model Name | Endpoint ID | Description |
| :--- | :--- | :--- |
| **Meta Llama 3.2 3B Instruct** | `llama-3.2-3b` | State-of-the-art ultra-fast lightweight reasoning & general tasks |
| **Meta Llama 3.2 1B Instruct** | `llama-3.2-1b` | Instant sub-second response model for high throughput |
| **Mistral 7B Instruct** | `mistral-7b` | High efficiency multilingual chat assistant |
| **DeepSeek R1 Distill 32B** | `deepseek-r1-32b` | Advanced mathematical reasoning & logical synthesis |
| **Flux-1 Schnell** | `flux-1-schnell` | High-fidelity 4-step image synthesis |

---

## 🔌 OpenAI-Compatible API Endpoints (Zero API Key Required)

Your deployed Worker URL acts as a **100% drop-in replacement for OpenAI API**:

- **Base URL**: `https://cloudflare-workers-ai-gateway.sikuroybd.workers.dev/v1`
- **API Key**: `sk-free` *(Any dummy key string works!)*

### 1. Python Code Example
```python
from openai import OpenAI

client = OpenAI(
    base_url="https://cloudflare-workers-ai-gateway.sikuroybd.workers.dev/v1",
    api_key="sk-free"
)

response = client.chat.completions.create(
    model="llama-3.2-3b",
    messages=[
        {"role": "user", "content": "Explain Quantum Computing in 2 sentences."}
    ]
)

print(response.choices[0].message.content)
```

### 2. JavaScript / Node.js Example
```javascript
fetch("https://cloudflare-workers-ai-gateway.sikuroybd.workers.dev/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer sk-free"
  },
  body: JSON.stringify({
    model: "llama-3.2-3b",
    messages: [{ role: "user", content: "Hi! Introduce yourself." }]
  })
})
.then(res => res.json())
.then(data => console.log(data.choices[0].message.content));
```

### 3. cURL Command
```bash
curl https://cloudflare-workers-ai-gateway.sikuroybd.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-free" \
  -d '{
    "model": "deepseek-r1-32b",
    "messages": [{"role": "user", "content": "What is 15 + 25?"}]
  }'
```

---

## 💻 Manual CLI Deployment

If you prefer deploying via terminal:
```bash
# 1. Clone repository
git clone https://github.com/Ziplootapp/cloudflare-workers-ai-free-guide.git
cd cloudflare-workers-ai-free-guide

# 2. Install dependencies
npm install

# 3. Deploy to Cloudflare
npx wrangler deploy
```

---

## 📄 License
Open source under the **MIT License**. Powered by [ziploot.app](https://ziploot.app).
