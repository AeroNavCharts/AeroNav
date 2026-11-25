import csv
import html
import io
import json
import os
import sqlite3
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HOST = os.environ.get("ADSTATS_HOST", "127.0.0.1")
PORT = int(os.environ.get("ADSTATS_PORT", "8787"))
DB_PATH = os.environ.get("ADSTATS_DB", "/var/lib/adstats/stats.db")
STATS_KEY = os.environ.get("STATS_KEY", "")
ADS = {a.strip() for a in os.environ.get("ADSTATS_ADS", "crc").split(",") if a.strip()}
ORIGINS = {o.strip() for o in os.environ.get("ADSTATS_ORIGINS", "https://aeronav.space").split(",") if o.strip()}
EVENTS = {"view", "click"}
RATE_LIMIT = int(os.environ.get("ADSTATS_RATE_LIMIT", "30"))
RATE_WINDOW = 60

db_lock = threading.Lock()
db = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None)
db.execute("PRAGMA journal_mode=WAL")
db.execute(
    "CREATE TABLE IF NOT EXISTS ad_stats (day TEXT NOT NULL, ad TEXT NOT NULL, type TEXT NOT NULL, "
    "count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, ad, type))"
)

rate_lock = threading.Lock()
rate_hits = {}


def allowed(client):
    now = time.monotonic()
    with rate_lock:
        if len(rate_hits) > 50000:
            rate_hits.clear()
        start, count = rate_hits.get(client, (now, 0))
        if now - start > RATE_WINDOW:
            start, count = now, 0
        count += 1
        rate_hits[client] = (start, count)
        return count <= RATE_LIMIT


def record(ad, kind):
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    with db_lock:
        db.execute(
            "INSERT INTO ad_stats (day, ad, type, count) VALUES (?, ?, ?, 1) "
            "ON CONFLICT (day, ad, type) DO UPDATE SET count = count + 1",
            (day, ad, kind),
        )


def daily_rows():
    with db_lock:
        return db.execute(
            "SELECT day, ad, SUM(CASE WHEN type = 'view' THEN count ELSE 0 END), "
            "SUM(CASE WHEN type = 'click' THEN count ELSE 0 END) "
            "FROM ad_stats GROUP BY day, ad ORDER BY day DESC, ad LIMIT 400"
        ).fetchall()


def ctr(views, clicks):
    return f"{clicks / views * 100:.2f}%" if views else "-"


def render_html(rows):
    totals = {}
    for _, ad, views, clicks in rows:
        t = totals.setdefault(ad, [0, 0])
        t[0] += views
        t[1] += clicks

    def row(cells):
        return "<tr>" + "".join(f"<td>{html.escape(str(c))}</td>" for c in cells) + "</tr>"

    total_rows = "".join(row([ad, v, c, ctr(v, c)]) for ad, (v, c) in totals.items())
    day_rows = "".join(row([d, ad, v, c, ctr(v, c)]) for d, ad, v, c in rows)
    return f"""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Ad stats</title>
<style>body{{font:14px system-ui,sans-serif;background:#0f1115;color:#e6e6e6;margin:24px}}table{{border-collapse:collapse;margin-bottom:28px}}th,td{{padding:6px 14px;border:1px solid #2a2e36;text-align:right}}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2){{text-align:left}}th{{background:#181b21}}a{{color:#8ab4ff}}</style></head><body>
<h2>Totals</h2><table><tr><th>Ad</th><th>Views</th><th>Clicks</th><th>CTR</th></tr>{total_rows}</table>
<h2>Daily (UTC)</h2><table><tr><th>Day</th><th>Ad</th><th>Views</th><th>Clicks</th><th>CTR</th></tr>{day_rows}</table>
<a href="?key={html.escape(STATS_KEY)}&amp;format=csv">Download CSV</a></body></html>"""


def render_csv(rows):
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(["day", "ad", "views", "clicks", "ctr"])
    for d, ad, v, c in rows:
        writer.writerow([d, ad, v, c, ctr(v, c)])
    return out.getvalue()


class Handler(BaseHTTPRequestHandler):
    server_version = "adstats"
    sys_version = ""

    def log_message(self, *args):
        pass

    def cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def reply(self, status, body=b"", content_type="text/plain; charset=utf-8", extra=None):
        if isinstance(body, str):
            body = body.encode()
        self.send_response(status)
        self.cors()
        if body:
            self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if body:
            self.wfile.write(body)

    def do_OPTIONS(self):
        self.reply(204, extra={"Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400"})

    def do_POST(self):
        if urlparse(self.path).path != "/api/ad":
            return self.reply(404, "Not found")
        origin = self.headers.get("Origin")
        if origin and origin not in ORIGINS:
            return self.reply(403, "Forbidden")
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 512:
            return self.reply(400, "Bad request")
        client = self.headers.get("CF-Connecting-IP") or self.client_address[0]
        if not allowed(client):
            return self.reply(429, "Too many requests")
        try:
            data = json.loads(self.rfile.read(length))
        except ValueError:
            return self.reply(400, "Bad request")
        if not isinstance(data, dict) or data.get("ad") not in ADS or data.get("type") not in EVENTS:
            return self.reply(400, "Bad request")
        record(data["ad"], data["type"])
        self.reply(204)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/healthz":
            return self.reply(200, "ok")
        if url.path != "/stats":
            return self.reply(404, "Not found")
        query = parse_qs(url.query)
        if not STATS_KEY or query.get("key", [""])[0] != STATS_KEY:
            return self.reply(404, "Not found")
        rows = daily_rows()
        if query.get("format", [""])[0] == "csv":
            return self.reply(200, render_csv(rows), "text/csv; charset=utf-8", {"Content-Disposition": 'attachment; filename="ad-stats.csv"', "Cache-Control": "no-store"})
        self.reply(200, render_html(rows), "text/html; charset=utf-8", {"Cache-Control": "no-store"})


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
