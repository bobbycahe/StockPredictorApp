"""Simple Python scraper to fetch Google News RSS for a company and write JSON to assets/news/<company_slug>.json

Usage:
  python scripts/scrape_news.py "Apple Inc" --count 10

Dependencies:
  pip install requests feedparser

It writes to: assets/news/<slug>.json (creates folder if needed).
"""
import argparse
import json
import os
import re
import sys
import urllib.request
from xml.etree import ElementTree as ET


def slugify(name: str) -> str:
    s = name.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")


def fetch_google_news_rss(query: str, count: int = 10):
    """Fetch Google News RSS using stdlib urllib and parse XML. Returns list of dicts."""
    rss = f"https://news.google.com/rss/search?q={urllib.request.quote(query)}&hl=en-US&gl=US&ceid=US:en"
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


def ensure_folder(path: str):
    os.makedirs(path, exist_ok=True)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("company", help="Company name or query to search")
    p.add_argument("--count", type=int, default=8, help="Number of articles to fetch")
    args = p.parse_args()

    try:
        items = fetch_google_news_rss(args.company, args.count)
    except Exception as e:
        print("Failed to fetch RSS:", e, file=sys.stderr)
        sys.exit(2)

    out_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets", "news")
    ensure_folder(out_dir)
    slug = slugify(args.company)
    out_path = os.path.join(out_dir, f"{slug}.json")
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump({"company": args.company, "fetched": True, "count": len(items), "items": items}, fh, ensure_ascii=False, indent=2)

    print(f"Wrote {len(items)} items to {out_path}")


if __name__ == "__main__":
    main()
