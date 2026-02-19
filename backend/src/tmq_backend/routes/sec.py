"""SEC EDGAR API routes for fetching company filings and insider transactions."""

from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from tmq_core.sec import (
    get_cik,
    get_company_info,
    fetch_filings,
    fetch_form4,
    fetch_insider_transactions,
    fetch_filing_content,
    filing_to_dict,
    form4_to_dict,
    POPULAR_FORM_TYPES,
    Filing,
)

router = APIRouter(prefix="/api/sec")


@router.get("/form-types")
def get_form_types() -> list[str]:
    """Get list of popular SEC form types."""
    return POPULAR_FORM_TYPES


@router.get("/company")
def company_info(ticker: str = Query(..., description="Stock ticker symbol")) -> dict:
    """Get company info including CIK from SEC."""
    info = get_company_info(ticker)
    if not info:
        raise HTTPException(status_code=404, detail=f"Company not found: {ticker}")
    return info


@router.get("/filings")
def get_filings(
    ticker: str = Query(..., description="Stock ticker symbol"),
    form_types: str = Query(None, description="Comma-separated form types (e.g., '10-K,10-Q,8-K,4')"),
    limit: int = Query(50, ge=1, le=200),
    start_date: str = Query(None, description="Start date YYYY-MM-DD"),
    end_date: str = Query(None, description="End date YYYY-MM-DD"),
) -> dict:
    """
    Fetch SEC filings for a company.

    Returns list of filings with metadata (no content).
    """
    types_list = form_types.split(",") if form_types else None

    try:
        filings = fetch_filings(
            ticker=ticker,
            form_types=types_list,
            limit=limit,
            start_date=start_date,
            end_date=end_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching filings: {e}")

    return {
        "ticker": ticker.upper(),
        "count": len(filings),
        "filings": [filing_to_dict(f) for f in filings],
    }


@router.get("/filing/{accession_number}")
def get_filing_detail(
    accession_number: str,
    ticker: str = Query(..., description="Stock ticker symbol"),
) -> dict:
    """
    Get details of a specific filing.

    For Form 4, returns parsed insider transaction data.
    For other forms, returns content preview.
    """
    try:
        # First, get the filing from the list to determine form type
        filings = fetch_filings(ticker=ticker, limit=200)
        filing = next((f for f in filings if f.accession_number == accession_number), None)

        if not filing:
            raise HTTPException(status_code=404, detail=f"Filing not found: {accession_number}")

        if filing.form_type in ("4", "4/A", "3", "5"):
            # Parse Form 4/3/5 for structured data (insider forms)
            try:
                form4 = fetch_form4(filing)
                return {
                    "filing": filing_to_dict(filing),
                    "form_type": filing.form_type,
                    "parsed": form4_to_dict(form4),
                }
            except Exception as e:
                # Fall back to content preview if parsing fails
                print(f"Warning: Could not parse {filing.form_type}: {e}")
                content = fetch_filing_content(filing, max_chars=50000)
                return {
                    "filing": filing_to_dict(filing),
                    "form_type": filing.form_type,
                    "content_preview": content[:10000] if len(content) > 10000 else content,
                    "parse_error": str(e),
                }
        else:
            # Return content preview for other forms
            content = fetch_filing_content(filing, max_chars=50000)
            return {
                "filing": filing_to_dict(filing),
                "form_type": filing.form_type,
                "content_preview": content[:10000] if len(content) > 10000 else content,
                "content_truncated": len(content) > 10000,
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching filing: {e}")


@router.get("/insider-transactions")
def get_insider_transactions(
    ticker: str = Query(..., description="Stock ticker symbol"),
    limit: int = Query(20, ge=1, le=100),
    start_date: str = Query(None, description="Start date YYYY-MM-DD"),
    end_date: str = Query(None, description="End date YYYY-MM-DD"),
) -> dict:
    """
    Fetch and parse recent insider transactions (Form 4) for a company.

    Returns structured transaction data including:
    - Reporter name and relationship (officer, director, etc.)
    - Transaction details (shares, price, buy/sell)
    - Holdings after transaction
    """
    try:
        form4s = fetch_insider_transactions(
            ticker=ticker,
            limit=limit,
            start_date=start_date,
            end_date=end_date,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching insider transactions: {e}")

    return {
        "ticker": ticker.upper(),
        "count": len(form4s),
        "transactions": [form4_to_dict(f) for f in form4s],
    }


class FilingContentRequest(BaseModel):
    ticker: str
    accession_number: str
    max_chars: int = 50000


@router.post("/filing-content")
def get_filing_content(req: FilingContentRequest) -> dict:
    """
    Fetch the text content of a filing (for AI consumption).

    HTML is stripped and content is truncated to max_chars.
    """
    try:
        filings = fetch_filings(ticker=req.ticker, limit=200)
        filing = next((f for f in filings if f.accession_number == req.accession_number), None)

        if not filing:
            raise HTTPException(status_code=404, detail=f"Filing not found: {req.accession_number}")

        content = fetch_filing_content(filing, max_chars=req.max_chars)

        return {
            "filing": filing_to_dict(filing),
            "content": content,
            "char_count": len(content),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching filing content: {e}")
