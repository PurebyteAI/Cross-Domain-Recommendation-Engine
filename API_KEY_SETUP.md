# 🔑 API Key Setup Guide

## Quick Start: Get Your API Keys

### 1. 🎯 Qloo API Key (Required for Recommendations)

**Option A: Hackathon Participants**
```bash
# 1. Sign up at: https://qloo-hackathon.devpost.com/
# 2. You'll receive your API key within 1 business day
# 3. Use the hackathon API URL: https://hackathon.api.qloo.com
```

**Option B: General/Production Use**
```bash
# 1. Email: support@qloo.com
# 2. Request: "API access for taste recommendation engine"
# 3. You'll receive your API key within 1 business day
# 4. Use production URL: https://api.qloo.com
```

### 2. 🤖 Gemini API Key (Required for AI Explanations)

```bash
# 1. Visit: https://ai.google.dev/
# 2. Click "Get API Key" 
# 3. Sign in with Google account
# 4. Create new project or select existing
# 5. Generate API key
# 6. Copy the key
```

### 3. 🔧 Update Your .env File

Once you have your API keys, update the `.env` file in your project root:

```properties
# Replace these placeholder values with your actual API keys:
QLOO_API_KEY=your_actual_qloo_api_key_here
QLOO_API_URL=https://hackathon.api.qloo.com  # or https://api.qloo.com
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

## 🧪 Testing Your API Keys

### Test Qloo API:
```bash
curl --location 'https://hackathon.api.qloo.com/v2/insights?filter.type=urn:entity:movie&query=inception' \
--header 'X-Api-Key: YOUR_ACTUAL_API_KEY'
```

### Test Gemini API:
```bash
curl -H 'Content-Type: application/json' \
-d '{"contents":[{"parts":[{"text":"Hello, world!"}]}]}' \
-X POST 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_ACTUAL_API_KEY'
```

## 🔍 Expected Results

### ✅ With Valid API Keys:
- Real movie/book/brand recommendations
- Actual cultural insights and tags
- Detailed explanations
- No "fallback" entities

### ❌ With Invalid/Missing API Keys:
- Fallback recommendations with generated IDs
- Generic explanations
- 401/403 authentication errors
- No real cultural insights

## 📞 Getting Help

### Qloo Support:
- Email: support@qloo.com
- Discord: #qloo-hackathon channel
- Documentation: https://docs.qloo.com/

### Gemini Support:
- Documentation: https://ai.google.dev/docs
- Community: https://developers.googleblog.com/

## 🚀 Next Steps

1. **Get API keys** using the instructions above
2. **Update .env file** with real values
3. **Restart your development server**: `npm run dev`
4. **Test recommendations** - you should see real data!

---

💡 **Tip**: Both APIs offer free tiers perfect for development and hackathons!
