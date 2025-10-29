"""Bulk scraper: given tickers (or a file), resolve company names via Alpha Vantage and fetch Google News RSS for each.

Usage:
  python scripts/scrape_news_all.py --tickers AAPL,MSFT,TSLA --apikey YOUR_ALPHA_VANTAGE_KEY
  python scripts/scrape_news_all.py --file tickers.txt --apikey YOUR_ALPHA_VANTAGE_KEY

Dependencies:
  pip install requests feedparser

Output:
  assets/news/<ticker>.json and assets/news/<company-slug>.json for each resolved company.

This script helps populate local cached news files the app can load during development.
"""
import argparse
import json
import os
import re
import sys
import time
from typing import List
import urllib.request
import urllib.parse
from xml.etree import ElementTree as ET

API_BASE = "https://www.alphavantage.co/query"


def slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def ensure_folder(path: str):
    os.makedirs(path, exist_ok=True)


def fetch_company_name_from_alpha(ticker: str, apikey: str) -> str:
    params = {
        'function': 'SYMBOL_SEARCH',
        'keywords': ticker,
        'apikey': apikey,
    }
    url = API_BASE + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = resp.read()
    j = json.loads(data.decode('utf-8'))
    matches = j.get('bestMatches') or []
    if matches:
        # Prefer exact symbol match
        for m in matches:
            if (m.get('1. symbol') or '').upper() == ticker.upper():
                return m.get('2. name') or ticker
        return matches[0].get('2. name') or ticker
    return ticker


def fetch_google_news_rss(query: str, count: int = 8):
    rss = f"https://news.google.com/rss/search?q={urllib.parse.quote(query)}&hl=en-US&gl=US&ceid=US:en"
    req = urllib.request.Request(rss, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        raw = resp.read()
    root = ET.fromstring(raw)
    channel = root.find('channel')
    entries = []
    if channel is None:
        return entries
    for item in channel.findall('item')[:count]:
        title = item.findtext('title') or ''
        link = item.findtext('link') or ''
        published = item.findtext('pubDate') or item.findtext('published') or ''
        summary = item.findtext('description') or ''
        entries.append({
            'title': title.strip(),
            'link': link.strip(),
            'published': published.strip(),
            'summary': summary.strip(),
        })
    return entries


def process_ticker(ticker: str, apikey: str, out_dir: str, count: int = 8):
    ticker = ticker.strip()
    if not ticker:
        return
    print(f"Processing {ticker}...", file=sys.stderr)
    try:
        company = fetch_company_name_from_alpha(ticker, apikey)
    except Exception as e:
        print(f"Failed to resolve name for {ticker}: {e}", file=sys.stderr)
        company = ticker
    try:
        items = fetch_google_news_rss(company, count)
    except Exception as e:
        print(f"Failed to fetch RSS for {company} ({ticker}): {e}", file=sys.stderr)
        items = []

    payload = {"ticker": ticker, "company": company, "fetched": True, "count": len(items), "items": items}
    # ensure output
    ensure_folder(out_dir)
    # write per-ticker
    tick_path = os.path.join(out_dir, f"{ticker.lower()}.json")
    with open(tick_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"Wrote {len(items)} items to {tick_path}")
    # write per-company slug
    comp_slug = slugify(company)
    comp_path = os.path.join(out_dir, f"{comp_slug}.json")
    with open(comp_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"Wrote {len(items)} items to {comp_path}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tickers", help="Comma-separated tickers (e.g. AAPL,MSFT)")
    p.add_argument("--file", help="File with one ticker per line")
    p.add_argument("--apikey", help="Alpha Vantage API key (required)")
    p.add_argument("--count", type=int, default=8)
    args = p.parse_args()

    apikey = args.apikey or os.environ.get('ALPHA_VANTAGE_API_KEY')
    if not apikey:
        print("Alpha Vantage API key is required via --apikey or ALPHA_VANTAGE_API_KEY env var", file=sys.stderr)
        sys.exit(2)

    tickers: List[str] = []
    if args.tickers:
        tickers = [t.strip() for t in args.tickers.split(',') if t.strip()]
    if args.file:
        with open(args.file, 'r', encoding='utf-8') as fh:
            for line in fh:
                s = line.strip()
                if s:
                    tickers.append(s)

    if not tickers:
        print("No tickers provided.", file=sys.stderr)
        sys.exit(2)

    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "news")
    ensure_folder(out_dir)

    for i, t in enumerate(tickers):
        process_ticker(t, apikey, out_dir, count=args.count)
        # be polite to API
        if i < len(tickers) - 1:
            time.sleep(12)  # Alpha Vantage has rate limits; sleep to avoid hitting limits


if __name__ == "__main__":
    main()
