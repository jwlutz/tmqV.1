# tmq-backend Architecture

FastAPI server providing REST API for the frontend and AI chat integration.

## Installation

```bash
cd backend && pip install -e .
```

## Running

```bash
# Via CLI (recommended - loads .env automatically)
tmq

# Manually
uvicorn tmq_backend.main:app --reload --port 8000
```

---

## Directory Structure

```
backend/src/tmq_backend/
├── main.py         # FastAPI app, CORS, routers
├── cli.py          # `tmq` command entry point
├── config.py       # .env loading, API key management
├── routes/
│   ├── data.py         # GET /api/data
│   ├── indicators.py   # GET /api/indicators
│   ├── backtest.py     # POST /api/backtest
│   └── chat.py         # POST /api/chat (SSE)
└── ai/
    ├── engine.py       # LiteLLM + tool calling loop
    ├── tools.py        # Tool schemas for function calling
    ├── prompt.py       # Prompt builder utilities
    └── prompts/        # Provider-specific system prompts
```

---

## Module: main.py

App entry point with CORS and router registration.

```python
app = FastAPI(title="TMQ Backend")

# Allow all origins for local development
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)

# Register route modules
app.include_router(data_router)
app.include_router(indicators_router)
app.include_router(backtest_router)
app.include_router(chat_router)
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check, returns `{"status": "ok"}` |
| `/api/config` | GET | List configured AI providers |

---

## Module: config.py

Environment and API key management.

### .env Loading

On import, searches up to 5 directories for `.env` file:

```python
_load_env_file()  # Called on module import
```

### Provider Configuration

```python
PROVIDER_ENV_VARS = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
    "openrouter": "OPENROUTER_API_KEY",
    "google": "GOOGLE_API_KEY",
    "xai": "XAI_API_KEY",
}
```

### Key Functions

```python
# Check which providers have keys configured
get_configured_providers()  # → {"anthropic": True, "openai": False, ...}

# Get a specific API key
get_api_key("anthropic")  # → "sk-ant-..." or None
```

---

## Module: cli.py

The `tmq` command that runs both backend and frontend.

```bash
tmq  # Starts uvicorn on :8000 and npm dev on :5173
```

Uses subprocess to manage both processes, handles SIGINT gracefully.

---

## Routes

### routes/data.py

```
GET /api/data?symbol=AAPL&interval=1d&start=2024-01-01&end=2024-12-31
```

Returns OHLCV data as JSON array.

### routes/indicators.py

```
GET /api/indicators?symbol=AAPL&indicator=rsi&length=14
```

Returns indicator values as JSON array.

### routes/backtest.py

```
POST /api/backtest
{
  "symbol": "SPY",
  "strategy": "sma_crossover",
  "start": "2020-01-01",
  "end": "2024-12-31",
  "params": {"fast": 10, "slow": 30}
}
```

Returns BacktestResult with metrics, equity_curve, trades.

```
POST /api/backtest/custom
{
  "symbol": "SPY",
  "code": "def generate_signals(df): ...",
  "start": "2020-01-01",
  "end": "2024-12-31"
}
```

Executes custom strategy code in sandbox.

### routes/chat.py

```
POST /api/chat
{
  "messages": [{"role": "user", "content": "..."}],
  "model": "gpt-4o-mini",
  "provider": "openai",  // or provide api_key directly
  "use_openrouter": false
}
```

Returns Server-Sent Events stream:

```
data: {"type": "text", "content": "Let me look up..."}
data: {"type": "tool_call", "name": "tmq_price", "args": {...}}
data: {"type": "tool_result", "name": "tmq_price", "result": "..."}
data: {"type": "text", "content": "Based on the data..."}
data: {"type": "done"}
```

---

## AI Module

### ai/engine.py

The agentic chat loop with tool calling.

#### Flow

1. Build system prompt based on detected provider (OpenAI/Anthropic/Google)
2. Call litellm.completion() with tool schemas
3. Stream text responses to client
4. If tool_call received:
   - Execute via `execute_tool()`
   - Append result to messages
   - Loop back to step 2
5. Max 10 iterations to prevent infinite loops

#### Tool Execution

```python
def execute_tool(name: str, args: dict) -> str:
    if name == "tmq_price":
        df = fetch_ohlcv(...)
        return df.tail(50).to_json(orient="records")
    elif name == "tmq_indicator":
        # ...
```

All tools return JSON strings (success or error).

### ai/tools.py

OpenAI-format tool schemas:

```python
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "tmq_price",
            "description": "Fetch OHLCV price data",
            "parameters": {
                "type": "object",
                "properties": {
                    "symbol": {"type": "string"},
                    "interval": {"type": "string"},
                    "start": {"type": "string"},
                    "end": {"type": "string"},
                },
                "required": ["symbol", "start", "end"],
            },
        },
    },
    # ... more tools
]
```

### ai/prompts/

Provider-specific system prompts:

- `anthropic.txt` — XML-formatted for Claude
- `openai.txt` — Markdown-formatted for GPT
- `google.txt` — Concise format for Gemini

`prompt.py` detects provider from model name and builds appropriate prompt.

---

## Available AI Tools

| Tool | Purpose | Args |
|------|---------|------|
| `tmq_price` | Fetch OHLCV data | symbol, interval, start, end |
| `tmq_indicator` | Compute indicator | symbol, indicator, params |
| `tmq_backtest` | Run template strategy | symbol, strategy, start, end, params |
| `tmq_backtest_custom` | Run custom code | symbol, code, start, end |
| `tmq_strategies` | List available strategies | - |
| `tmq_analyze` | Run custom analysis | symbol, code, start, end |

---

## Adding New Routes

1. Create `routes/myroute.py`:

```python
from fastapi import APIRouter
router = APIRouter(prefix="/api")

@router.get("/myroute")
async def my_endpoint():
    return {"result": "..."}
```

2. Register in `main.py`:

```python
from tmq_backend.routes.myroute import router as myroute_router
app.include_router(myroute_router)
```

## Adding New AI Tools

1. Add schema to `ai/tools.py`:

```python
{
    "type": "function",
    "function": {
        "name": "tmq_mytool",
        "description": "...",
        "parameters": {...},
    },
}
```

2. Add handler in `ai/engine.py`:

```python
elif name == "tmq_mytool":
    # execute and return JSON string
    return json.dumps(result)
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENROUTER_API_KEY` | OpenRouter API key |
| `GOOGLE_API_KEY` | Gemini API key |
| `XAI_API_KEY` | Grok API key |
| `ALPACA_API_KEY` | Alpaca API key |
| `ALPACA_SECRET_KEY` | Alpaca secret |
| `ALPACA_API_ENDPOINT` | Alpaca endpoint (paper/live) |
