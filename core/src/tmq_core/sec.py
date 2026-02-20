"""
SEC EDGAR API wrapper for fetching and parsing SEC filings.

Key functionality:
- Ticker to CIK lookup
- Fetch filings list (10-K, 10-Q, 8-K, Form 4, etc.)
- Parse Form 4 XML for structured insider transaction data
- Extract 10-K/10-Q sections

Rate limit: SEC EDGAR has a 10 requests/second limit.
User-Agent must include contact email per SEC guidelines.
"""

from __future__ import annotations

import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import datetime
from functools import lru_cache
from typing import Literal

import requests

# SEC requires a User-Agent with contact info
# TODO: Once user auth is added, default to the authenticated user's email
SEC_USER_AGENT = "thats_my_quant/1.0 (madcarterclap909@gmail.com)"
SEC_BASE_URL = "https://data.sec.gov"
SEC_EDGAR_URL = "https://www.sec.gov/cgi-bin/browse-edgar"
SEC_ARCHIVES_URL = "https://www.sec.gov/Archives/edgar/data"

# Rate limiting
_last_request_time = 0.0
_MIN_REQUEST_INTERVAL = 0.1  # 10 requests/sec max


def _rate_limited_get(url: str, headers: dict | None = None) -> requests.Response:
    """Make a rate-limited GET request to SEC."""
    global _last_request_time

    elapsed = time.time() - _last_request_time
    if elapsed < _MIN_REQUEST_INTERVAL:
        time.sleep(_MIN_REQUEST_INTERVAL - elapsed)

    hdrs = {"User-Agent": SEC_USER_AGENT}
    if headers:
        hdrs.update(headers)

    resp = requests.get(url, headers=hdrs, timeout=30)
    _last_request_time = time.time()
    resp.raise_for_status()
    return resp


# ─────────────────────────────────────────────────────────────────────────────
# CIK Lookup
# ─────────────────────────────────────────────────────────────────────────────


@lru_cache(maxsize=1)
def _load_cik_mapping() -> dict[str, str]:
    """Load the SEC's ticker-to-CIK mapping. Cached after first call."""
    url = "https://www.sec.gov/files/company_tickers.json"
    resp = _rate_limited_get(url)
    data = resp.json()

    # Format: {"0": {"cik_str": 320193, "ticker": "AAPL", "title": "Apple Inc."}, ...}
    mapping = {}
    for entry in data.values():
        ticker = entry["ticker"].upper()
        cik = str(entry["cik_str"]).zfill(
            10
        )  # CIK must be 10 digits with leading zeros
        mapping[ticker] = cik

    return mapping


def get_cik(ticker: str) -> str | None:
    """Convert a ticker symbol to SEC CIK (10-digit, zero-padded)."""
    mapping = _load_cik_mapping()
    return mapping.get(ticker.upper())


def get_company_info(ticker: str) -> dict | None:
    """Get basic company info from SEC including CIK and name."""
    cik = get_cik(ticker)
    if not cik:
        return None

    url = f"{SEC_BASE_URL}/submissions/CIK{cik}.json"
    resp = _rate_limited_get(url)
    data = resp.json()

    return {
        "cik": cik,
        "name": data.get("name"),
        "ticker": ticker.upper(),
        "sic": data.get("sic"),
        "sic_description": data.get("sicDescription"),
        "fiscal_year_end": data.get("fiscalYearEnd"),
        "state": data.get("stateOfIncorporation"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Filings List
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class Filing:
    """Represents an SEC filing."""

    accession_number: str
    form_type: str
    filing_date: str
    description: str
    primary_document: str
    cik: str
    ticker: str

    @property
    def sec_url(self) -> str:
        """URL to view filing on SEC website."""
        acc_no_dashes = self.accession_number.replace("-", "")
        return f"{SEC_ARCHIVES_URL}/{self.cik.lstrip('0')}/{acc_no_dashes}/{self.primary_document}"

    @property
    def index_url(self) -> str:
        """URL to the filing index page."""
        acc_no_dashes = self.accession_number.replace("-", "")
        return f"{SEC_ARCHIVES_URL}/{self.cik.lstrip('0')}/{acc_no_dashes}"


# Popular form types for filtering
POPULAR_FORM_TYPES = [
    "10-K",
    "10-Q",
    "8-K",
    "4",
    "3",
    "5",
    "10-K/A",
    "10-Q/A",
    "8-K/A",
    "13F-HR",
    "13F-NT",
    "SC 13G",
    "SC 13G/A",
    "SC 13D",
    "SC 13D/A",
    "DEF 14A",
    "DEFA14A",
    "S-1",
    "S-3",
    "S-8",
    "144",
]


def fetch_filings(
    ticker: str,
    form_types: list[str] | None = None,
    limit: int = 50,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[Filing]:
    """
    Fetch recent SEC filings for a company.

    Args:
        ticker: Stock ticker symbol
        form_types: List of form types to filter (e.g., ["10-K", "8-K", "4"])
        limit: Maximum number of filings to return
        start_date: Filter filings after this date (YYYY-MM-DD)
        end_date: Filter filings before this date (YYYY-MM-DD)

    Returns:
        List of Filing objects, most recent first
    """
    cik = get_cik(ticker)
    if not cik:
        raise ValueError(f"Unknown ticker: {ticker}")

    url = f"{SEC_BASE_URL}/submissions/CIK{cik}.json"
    resp = _rate_limited_get(url)
    data = resp.json()

    recent = data.get("filings", {}).get("recent", {})
    if not recent:
        return []

    filings = []
    accession_numbers = recent.get("accessionNumber", [])
    forms = recent.get("form", [])
    filing_dates = recent.get("filingDate", [])
    primary_docs = recent.get("primaryDocument", [])
    descriptions = recent.get("primaryDocDescription", [])

    for i in range(len(accession_numbers)):
        form = forms[i] if i < len(forms) else ""
        filing_date = filing_dates[i] if i < len(filing_dates) else ""

        # Filter by form type
        if form_types and form not in form_types:
            continue

        # Filter by date range
        if start_date and filing_date < start_date:
            continue
        if end_date and filing_date > end_date:
            continue

        filing = Filing(
            accession_number=accession_numbers[i],
            form_type=form,
            filing_date=filing_date,
            description=descriptions[i] if i < len(descriptions) else "",
            primary_document=primary_docs[i] if i < len(primary_docs) else "",
            cik=cik,
            ticker=ticker.upper(),
        )
        filings.append(filing)

        if len(filings) >= limit:
            break

    return filings


# ─────────────────────────────────────────────────────────────────────────────
# Form 4 Parser (Insider Transactions)
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class InsiderTransaction:
    """A single transaction from Form 4."""

    security_title: str
    transaction_date: str
    transaction_code: str  # A=Award, M=Conversion, P=Purchase, S=Sale, etc.
    shares: float
    price_per_share: float | None
    acquired_disposed: Literal["A", "D"]  # A=Acquired, D=Disposed
    shares_owned_after: float
    direct_indirect: Literal["D", "I"]  # D=Direct, I=Indirect
    nature_of_ownership: str | None = None  # e.g., "By spouse"


@dataclass
class Form4Filing:
    """Parsed Form 4 filing with structured data."""

    accession_number: str
    filing_date: str

    # Issuer info
    issuer_cik: str
    issuer_name: str
    issuer_ticker: str

    # Reporting person (insider)
    reporter_cik: str
    reporter_name: str
    is_director: bool = False
    is_officer: bool = False
    is_ten_percent_owner: bool = False
    is_other: bool = False
    officer_title: str | None = None

    # Transactions
    non_derivative_transactions: list[InsiderTransaction] = field(default_factory=list)
    derivative_transactions: list[InsiderTransaction] = field(default_factory=list)

    # Holdings (non-transaction)
    non_derivative_holdings: list[dict] = field(default_factory=list)
    derivative_holdings: list[dict] = field(default_factory=list)


# Transaction code meanings
TRANSACTION_CODES = {
    "A": "Grant/Award",
    "C": "Conversion",
    "D": "Sale back to issuer",
    "E": "Expiration",
    "F": "Tax payment",
    "G": "Gift",
    "H": "Expiration (short)",
    "I": "Discretionary",
    "J": "Other",
    "K": "Equity swap",
    "L": "Small acquisition",
    "M": "Conversion/Exercise",
    "O": "Out-of-the-money",
    "P": "Open market purchase",
    "S": "Open market sale",
    "U": "Tender",
    "V": "Transaction reported",
    "W": "Acquisition by will",
    "X": "Exercise",
    "Z": "Deposit",
}


def _safe_float(text: str | None) -> float | None:
    """Safely convert text to float."""
    if text is None:
        return None
    try:
        return float(text.strip())
    except (ValueError, AttributeError):
        return None


def _get_text(element: ET.Element | None, path: str) -> str | None:
    """Get text from XML element by path."""
    if element is None:
        return None
    el = element.find(path)
    return el.text.strip() if el is not None and el.text else None


def parse_form4(
    xml_content: str, accession_number: str, filing_date: str
) -> Form4Filing:
    """
    Parse Form 4 XML into structured data.

    Args:
        xml_content: Raw XML content of the Form 4
        accession_number: SEC accession number
        filing_date: Filing date (YYYY-MM-DD)

    Returns:
        Form4Filing with parsed transaction data
    """
    # Handle namespace - Form 4 XML uses a namespace
    xml_content = re.sub(r'xmlns="[^"]+"', "", xml_content)
    root = ET.fromstring(xml_content)

    # Issuer info
    issuer = root.find(".//issuer")
    issuer_cik = _get_text(issuer, "issuerCik") or ""
    issuer_name = _get_text(issuer, "issuerName") or ""
    issuer_ticker = _get_text(issuer, "issuerTradingSymbol") or ""

    # Reporter info
    reporter = root.find(".//reportingOwner")
    reporter_id = reporter.find("reportingOwnerId") if reporter else None
    reporter_cik = _get_text(reporter_id, "rptOwnerCik") or ""
    reporter_name = _get_text(reporter_id, "rptOwnerName") or ""

    # Relationship
    relationship = reporter.find("reportingOwnerRelationship") if reporter else None
    is_director = (
        _get_text(relationship, "isDirector") == "1" if relationship else False
    )
    is_officer = _get_text(relationship, "isOfficer") == "1" if relationship else False
    is_ten_percent = (
        _get_text(relationship, "isTenPercentOwner") == "1" if relationship else False
    )
    is_other = _get_text(relationship, "isOther") == "1" if relationship else False
    officer_title = _get_text(relationship, "officerTitle") if relationship else None

    filing = Form4Filing(
        accession_number=accession_number,
        filing_date=filing_date,
        issuer_cik=issuer_cik,
        issuer_name=issuer_name,
        issuer_ticker=issuer_ticker,
        reporter_cik=reporter_cik,
        reporter_name=reporter_name,
        is_director=is_director,
        is_officer=is_officer,
        is_ten_percent_owner=is_ten_percent,
        is_other=is_other,
        officer_title=officer_title,
    )

    # Non-derivative transactions
    for txn in root.findall(".//nonDerivativeTransaction"):
        security = _get_text(txn, ".//securityTitle/value")
        txn_date = _get_text(txn, ".//transactionDate/value")
        txn_code = _get_text(txn, ".//transactionCoding/transactionCode")
        shares = _safe_float(
            _get_text(txn, ".//transactionAmounts/transactionShares/value")
        )
        price = _safe_float(
            _get_text(txn, ".//transactionAmounts/transactionPricePerShare/value")
        )
        acq_disp = _get_text(
            txn, ".//transactionAmounts/transactionAcquiredDisposedCode/value"
        )
        shares_after = _safe_float(
            _get_text(
                txn, ".//postTransactionAmounts/sharesOwnedFollowingTransaction/value"
            )
        )
        ownership = _get_text(txn, ".//ownershipNature/directOrIndirectOwnership/value")
        nature = _get_text(txn, ".//ownershipNature/natureOfOwnership/value")

        if shares is not None:
            filing.non_derivative_transactions.append(
                InsiderTransaction(
                    security_title=security or "Common Stock",
                    transaction_date=txn_date or filing_date,
                    transaction_code=txn_code or "?",
                    shares=shares,
                    price_per_share=price,
                    acquired_disposed=acq_disp if acq_disp in ("A", "D") else "A",
                    shares_owned_after=shares_after or 0,
                    direct_indirect=ownership if ownership in ("D", "I") else "D",
                    nature_of_ownership=nature,
                )
            )

    # Derivative transactions (options, RSUs, etc.)
    for txn in root.findall(".//derivativeTransaction"):
        security = _get_text(txn, ".//securityTitle/value")
        txn_date = _get_text(txn, ".//transactionDate/value")
        txn_code = _get_text(txn, ".//transactionCoding/transactionCode")
        shares = _safe_float(
            _get_text(txn, ".//transactionAmounts/transactionShares/value")
        )
        price = _safe_float(
            _get_text(txn, ".//transactionAmounts/transactionPricePerShare/value")
        )
        acq_disp = _get_text(
            txn, ".//transactionAmounts/transactionAcquiredDisposedCode/value"
        )
        shares_after = _safe_float(
            _get_text(
                txn, ".//postTransactionAmounts/sharesOwnedFollowingTransaction/value"
            )
        )
        ownership = _get_text(txn, ".//ownershipNature/directOrIndirectOwnership/value")
        nature = _get_text(txn, ".//ownershipNature/natureOfOwnership/value")

        if shares is not None:
            filing.derivative_transactions.append(
                InsiderTransaction(
                    security_title=security or "Derivative",
                    transaction_date=txn_date or filing_date,
                    transaction_code=txn_code or "?",
                    shares=shares,
                    price_per_share=price,
                    acquired_disposed=acq_disp if acq_disp in ("A", "D") else "A",
                    shares_owned_after=shares_after or 0,
                    direct_indirect=ownership if ownership in ("D", "I") else "D",
                    nature_of_ownership=nature,
                )
            )

    return filing


def fetch_form4(filing: Filing) -> Form4Filing:
    """
    Fetch and parse a Form 4 filing.

    Args:
        filing: Filing object (must be form type "4", "4/A", "3", or "5")

    Returns:
        Parsed Form4Filing
    """
    if filing.form_type not in ("4", "4/A", "3", "5", "3/A", "5/A"):
        raise ValueError(f"Expected insider form (3/4/5), got {filing.form_type}")

    # Form 4 primary document is usually .xml
    acc_no_dashes = filing.accession_number.replace("-", "")
    cik_stripped = filing.cik.lstrip("0")

    # Try to find the XML file - it's usually the primary doc or named *-form4.xml
    base_url = f"{SEC_ARCHIVES_URL}/{cik_stripped}/{acc_no_dashes}"

    # The primary_document may contain an XSLT prefix like "xslF345X05/filename.xml"
    # We need to strip that and get just the filename
    primary_doc = filing.primary_document
    if "/" in primary_doc:
        primary_doc = primary_doc.split("/")[-1]  # Get just the filename

    # First try the primary document (without XSLT prefix)
    xml_url = None
    if primary_doc.endswith(".xml"):
        xml_url = f"{base_url}/{primary_doc}"

    xml_content = None
    if xml_url:
        try:
            resp = _rate_limited_get(xml_url)
            xml_content = resp.text
        except requests.HTTPError:
            xml_content = None

    if not xml_content:
        # Fallback: fetch index and find XML file
        index_url = f"{base_url}/index.json"
        resp = _rate_limited_get(index_url)
        index_data = resp.json()

        xml_file = None
        for item in index_data.get("directory", {}).get("item", []):
            name = item.get("name", "")
            if name.endswith(".xml") and "form4" in name.lower():
                xml_file = name
                break
            if name.endswith(".xml"):
                xml_file = name

        if not xml_file:
            raise ValueError(f"Could not find Form 4 XML for {filing.accession_number}")

        xml_url = f"{base_url}/{xml_file}"
        resp = _rate_limited_get(xml_url)
        xml_content = resp.text

    return parse_form4(xml_content, filing.accession_number, filing.filing_date)


def fetch_insider_transactions(
    ticker: str,
    limit: int = 20,
    start_date: str | None = None,
    end_date: str | None = None,
) -> list[Form4Filing]:
    """
    Convenience function to fetch and parse recent Form 4 filings.

    Args:
        ticker: Stock ticker symbol
        limit: Maximum number of Form 4s to fetch
        start_date: Filter filings after this date
        end_date: Filter filings before this date

    Returns:
        List of parsed Form4Filing objects
    """
    filings = fetch_filings(
        ticker=ticker,
        form_types=["4", "4/A"],
        limit=limit,
        start_date=start_date,
        end_date=end_date,
    )

    parsed = []
    for filing in filings:
        try:
            form4 = fetch_form4(filing)
            parsed.append(form4)
        except Exception as e:
            # Log but continue with other filings
            print(f"Warning: Could not parse Form 4 {filing.accession_number}: {e}")

    return parsed


# ─────────────────────────────────────────────────────────────────────────────
# Filing Content Fetching
# ─────────────────────────────────────────────────────────────────────────────


def fetch_filing_content(filing: Filing, max_chars: int = 100000) -> str:
    """
    Fetch the raw content of a filing.

    Args:
        filing: Filing object
        max_chars: Maximum characters to return (for large filings)

    Returns:
        Text content of the filing (HTML stripped for readability)
    """
    url = filing.sec_url
    resp = _rate_limited_get(url)
    content = resp.text

    # Basic HTML tag stripping for text extraction
    # Remove script and style elements
    content = re.sub(
        r"<script[^>]*>.*?</script>", "", content, flags=re.DOTALL | re.IGNORECASE
    )
    content = re.sub(
        r"<style[^>]*>.*?</style>", "", content, flags=re.DOTALL | re.IGNORECASE
    )

    # Remove HTML tags
    content = re.sub(r"<[^>]+>", " ", content)

    # Clean up whitespace
    content = re.sub(r"\s+", " ", content)
    content = re.sub(r"\n\s*\n", "\n\n", content)

    # Decode HTML entities
    import html

    content = html.unescape(content)

    if len(content) > max_chars:
        content = (
            content[:max_chars] + f"\n\n[Content truncated at {max_chars} characters]"
        )

    return content.strip()


# ─────────────────────────────────────────────────────────────────────────────
# Utility: Filing to Dict (for JSON serialization)
# ─────────────────────────────────────────────────────────────────────────────


def filing_to_dict(filing: Filing) -> dict:
    """Convert Filing to JSON-serializable dict."""
    return {
        "accession_number": filing.accession_number,
        "form_type": filing.form_type,
        "filing_date": filing.filing_date,
        "description": filing.description,
        "ticker": filing.ticker,
        "sec_url": filing.sec_url,
    }


def form4_to_dict(form4: Form4Filing) -> dict:
    """Convert Form4Filing to JSON-serializable dict."""
    return {
        "accession_number": form4.accession_number,
        "filing_date": form4.filing_date,
        "issuer": {
            "cik": form4.issuer_cik,
            "name": form4.issuer_name,
            "ticker": form4.issuer_ticker,
        },
        "reporter": {
            "cik": form4.reporter_cik,
            "name": form4.reporter_name,
            "is_director": form4.is_director,
            "is_officer": form4.is_officer,
            "is_ten_percent_owner": form4.is_ten_percent_owner,
            "officer_title": form4.officer_title,
        },
        "transactions": [
            {
                "security": t.security_title,
                "date": t.transaction_date,
                "code": t.transaction_code,
                "code_meaning": TRANSACTION_CODES.get(t.transaction_code, "Unknown"),
                "shares": t.shares,
                "price": t.price_per_share,
                "acquired": t.acquired_disposed == "A",
                "shares_after": t.shares_owned_after,
                "direct": t.direct_indirect == "D",
                "ownership_nature": t.nature_of_ownership,
            }
            for t in form4.non_derivative_transactions + form4.derivative_transactions
        ],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Market-Wide SEC Scan (Daily Index) - O(1) complexity
# ─────────────────────────────────────────────────────────────────────────────

SEC_DAILY_INDEX_URL = "https://www.sec.gov/cgi-bin/browse-edgar"


@dataclass
class InsiderScanResult:
    """Result from market-wide insider scan."""

    ticker: str
    company_name: str
    cik: str
    filing_date: str
    accession_number: str
    reporter_name: str
    transaction_type: str  # "purchase", "sale", "grant", etc.
    net_shares: float
    total_value: float | None  # shares * price if available


def _fetch_recent_form4_filings(days_back: int = 7) -> list[dict]:
    """
    Fetch recent Form 4 filings using SEC's current filings feed.

    This uses the SEC's "getcurrent" action which returns recent filings
    across all companies in a parseable format.

    Args:
        days_back: How many days of filings to retrieve

    Returns:
        List of dicts with cik, accession_number, filing_date, company_name
    """
    from datetime import timedelta

    # SEC daily index files are organized by date
    # We'll parse the master index for recent days
    # Format: https://www.sec.gov/Archives/edgar/daily-index/YYYY/QTR/

    filings = []
    end_date = datetime.now()

    # Load CIK mapping for ticker resolution
    cik_mapping = _load_cik_mapping()
    cik_to_ticker = {v: k for k, v in cik_mapping.items()}

    for day_offset in range(min(days_back, 30)):  # Max 30 days
        date = end_date - timedelta(days=day_offset)

        # Skip weekends (no filings)
        if date.weekday() >= 5:
            continue

        # Calculate quarter
        quarter = (date.month - 1) // 3 + 1
        year = date.year

        # Daily index URL - the master.idx file contains all filings for that day
        # But individual daily files are at: /Archives/edgar/daily-index/YYYY/QTRn/master.YYYYMMDD.idx
        date_str = date.strftime("%Y%m%d")
        idx_url = f"https://www.sec.gov/Archives/edgar/daily-index/{year}/QTR{quarter}/master.{date_str}.idx"

        try:
            resp = _rate_limited_get(idx_url)
            content = resp.text

            # Parse the index file (pipe-delimited after header)
            # Format: CIK|Company Name|Form Type|Date Filed|Filename
            lines = content.strip().split("\n")

            # Skip header lines (first ~11 lines)
            data_started = False
            for line in lines:
                if line.startswith("----"):
                    data_started = True
                    continue
                if not data_started:
                    continue

                parts = line.split("|")
                if len(parts) < 5:
                    continue

                cik, company, form_type, date_filed, filename = parts[:5]

                # Only Form 4s
                if form_type.strip() != "4":
                    continue

                # Extract accession number from filename
                # Format: edgar/data/CIK/ACCESSION/filename.txt
                # OR: edgar/data/CIK/ACCESSION.txt (in some cases)
                path_parts = filename.strip().split("/")
                if len(path_parts) >= 4:
                    accession = path_parts[3]
                    # Remove .txt suffix if present
                    if accession.endswith(".txt"):
                        accession = accession[:-4]
                elif len(path_parts) >= 3:
                    # Sometimes format is shorter
                    accession = path_parts[2]
                    if accession.endswith(".txt"):
                        accession = accession[:-4]
                else:
                    continue

                cik_padded = cik.strip().zfill(10)
                ticker = cik_to_ticker.get(cik_padded, "")

                filings.append(
                    {
                        "cik": cik_padded,
                        "company_name": company.strip(),
                        "ticker": ticker,
                        "filing_date": date_filed.strip(),
                        "accession_number": accession,
                    }
                )

        except requests.HTTPError as e:
            # Index file doesn't exist for this date (holiday, etc.)
            if e.response.status_code == 404:
                continue
            # Other errors - log and continue
            continue
        except Exception:
            # Skip this day and continue
            continue

    return filings


def scan_recent_form4s(
    days_back: int = 7,
    transaction_filter: str | None = "purchase",
    min_insiders: int = 1,
) -> dict:
    """
    Scan ALL Form 4 filings market-wide for insider activity.

    This uses SEC daily index files to efficiently retrieve all recent
    Form 4s in O(days) requests, then parses them to extract transactions.

    Args:
        days_back: How many days to look back (max 30)
        transaction_filter: Filter for transaction type:
            - "purchase": Open market buys (code P)
            - "sale": Open market sales (code S)
            - "all": All transactions
        min_insiders: Minimum unique insiders per ticker to include

    Returns:
        Dict with:
            - tickers: List of tickers with insider activity
            - details: Dict of ticker -> list of transactions
            - summary: Aggregated stats per ticker
            - scan_info: Metadata about the scan
            - total_results: Total number of matching transactions
    """
    from datetime import timedelta

    end_date = datetime.now()
    start_date = end_date - timedelta(days=min(days_back, 30))

    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    results = {
        "tickers": [],
        "details": {},
        "summary": {},
        "scan_info": {
            "start_date": start_str,
            "end_date": end_str,
            "transaction_filter": transaction_filter,
            "min_insiders": min_insiders,
        },
        "total_results": 0,
    }

    try:
        # Get all recent Form 4 filings from daily index
        all_filings = _fetch_recent_form4_filings(days_back)

        if not all_filings:
            results["error"] = "No Form 4 filings found in date range"
            return results

        # Group filings by ticker
        ticker_filings: dict[str, list[dict]] = {}
        for filing in all_filings:
            ticker = filing.get("ticker", "")
            if not ticker:
                continue
            if ticker not in ticker_filings:
                ticker_filings[ticker] = []
            ticker_filings[ticker].append(filing)

        # Parse Form 4s and extract transactions
        # Limit the number of filings we parse to avoid rate limiting
        max_parse = 100  # Max Form 4s to parse
        parsed_count = 0

        for ticker, filings_list in ticker_filings.items():
            if parsed_count >= max_parse:
                break

            ticker_results = []

            for filing_info in filings_list[:3]:  # Max 3 per ticker
                if parsed_count >= max_parse:
                    break

                try:
                    # Fetch the full filing to get primary document
                    full_filings = fetch_filings(ticker, form_types=["4"], limit=20)
                    matching = [
                        f
                        for f in full_filings
                        if f.accession_number == filing_info["accession_number"]
                    ]

                    if not matching:
                        continue

                    form4 = fetch_form4(matching[0])
                    parsed_count += 1

                    # Extract transactions
                    for txn in form4.non_derivative_transactions:
                        # Filter by transaction type
                        if (
                            transaction_filter == "purchase"
                            and txn.transaction_code != "P"
                        ):
                            continue
                        if transaction_filter == "sale" and txn.transaction_code != "S":
                            continue

                        total_value = None
                        if txn.price_per_share is not None:
                            total_value = txn.shares * txn.price_per_share

                        result = InsiderScanResult(
                            ticker=ticker,
                            company_name=form4.issuer_name,
                            cik=form4.issuer_cik,
                            filing_date=form4.filing_date,
                            accession_number=form4.accession_number,
                            reporter_name=form4.reporter_name,
                            transaction_type=txn.transaction_code,
                            net_shares=txn.shares
                            if txn.acquired_disposed == "A"
                            else -txn.shares,
                            total_value=total_value,
                        )
                        ticker_results.append(result)

                except Exception:
                    # Skip unparseable filings
                    continue

            # Apply min_insiders filter
            unique_reporters = len(set(r.reporter_name for r in ticker_results))
            if unique_reporters >= min_insiders and ticker_results:
                results["tickers"].append(ticker)
                results["details"][ticker] = [
                    {
                        "reporter": r.reporter_name,
                        "date": r.filing_date,
                        "type": r.transaction_type,
                        "shares": r.net_shares,
                        "value": r.total_value,
                    }
                    for r in ticker_results
                ]
                results["summary"][ticker] = {
                    "unique_insiders": unique_reporters,
                    "total_transactions": len(ticker_results),
                    "net_shares": sum(r.net_shares for r in ticker_results),
                    "total_value": sum(r.total_value or 0 for r in ticker_results),
                }
                results["total_results"] += len(ticker_results)

    except Exception as e:
        results["error"] = f"SEC scan error: {str(e)}"

    return results


def find_cluster_buying(
    days_back: int = 7,
    min_insiders: int = 3,
) -> list[dict]:
    """
    Find stocks with cluster insider buying (multiple insiders buying).

    This is a convenience wrapper around scan_recent_form4s that filters
    for stocks where multiple different insiders are purchasing.

    Args:
        days_back: How many days to look back
        min_insiders: Minimum number of unique insiders buying the same stock

    Returns:
        List of dicts with ticker, company, insiders, and transaction details
    """
    scan = scan_recent_form4s(
        days_back=days_back,
        transaction_filter="purchase",
        min_insiders=min_insiders,
    )

    # Sort by number of unique insiders (descending)
    cluster_stocks = []
    for ticker in scan["tickers"]:
        summary = scan["summary"].get(ticker, {})
        cluster_stocks.append(
            {
                "ticker": ticker,
                "unique_insiders": summary.get("unique_insiders", 0),
                "total_transactions": summary.get("total_transactions", 0),
                "net_shares_bought": summary.get("net_shares", 0),
                "total_value": summary.get("total_value", 0),
                "details": scan["details"].get(ticker, []),
            }
        )

    # Sort by unique insiders, then by total value
    cluster_stocks.sort(
        key=lambda x: (x["unique_insiders"], x["total_value"] or 0), reverse=True
    )

    return cluster_stocks
