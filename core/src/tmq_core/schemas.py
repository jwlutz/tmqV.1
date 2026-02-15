from pydantic import BaseModel


class OHLCVData(BaseModel):
    symbol: str
    interval: str
    data: list[dict]  # [{date, open, high, low, close, volume}, ...]
