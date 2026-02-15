from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from tmq_backend.config import get_configured_providers
from tmq_backend.routes.data import router as data_router
from tmq_backend.routes.indicators import router as indicators_router
from tmq_backend.routes.backtest import router as backtest_router
from tmq_backend.routes.chat import router as chat_router
from tmq_backend.routes.macro import router as macro_router
from tmq_backend.routes.settings import router as settings_router

app = FastAPI(title="TMQ Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(data_router)
app.include_router(indicators_router)
app.include_router(backtest_router)
app.include_router(chat_router)
app.include_router(macro_router)
app.include_router(settings_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/config")
def config():
    """Return available AI providers configured via .env."""
    return {"providers": get_configured_providers()}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("tmq_backend.main:app", host="0.0.0.0", port=8000, reload=True)
