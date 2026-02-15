from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/macro")


class MacroConfigRequest(BaseModel):
    api_key: str


class MacroFetchRequest(BaseModel):
    series_id: str
    start: str = ""
    end: str = ""


class MacroMultipleRequest(BaseModel):
    series_ids: list[str]
    start: str = ""
    end: str = ""


@router.post("/configure")
async def configure_macro(request: MacroConfigRequest):
    """Configure FRED API key."""
    from tmq_core.macro import configure_fred

    configure_fred(request.api_key)
    return {"status": "configured", "provider": "fred"}


@router.get("/series")
async def get_popular_series():
    """Get curated list of popular macro series."""
    from tmq_core.macro import POPULAR_SERIES

    return POPULAR_SERIES


@router.post("/fetch")
async def fetch_series(request: MacroFetchRequest):
    """Fetch a FRED series."""
    from tmq_core.macro import fetch_macro

    try:
        df = fetch_macro(request.series_id, request.start or None, request.end or None)
        return {
            "series_id": request.series_id,
            "data": df.to_dict(orient="records"),
        }
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/fetch_multiple")
async def fetch_multiple(request: MacroMultipleRequest):
    """Fetch multiple FRED series aligned by date."""
    from tmq_core.macro import fetch_macro_multiple

    try:
        df = fetch_macro_multiple(
            request.series_ids, request.start or None, request.end or None
        )
        return {
            "series_ids": request.series_ids,
            "data": df.to_dict(orient="records"),
        }
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/search")
async def search_series(q: str):
    """Search FRED for series."""
    from tmq_core.macro import search_macro

    try:
        return search_macro(q)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
