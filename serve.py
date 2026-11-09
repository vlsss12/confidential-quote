"""Serve the browser UI and its native helper on this device only."""
import json
import subprocess
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1:8765"
BINARY = ROOT / "target/release/confidential-quote"


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def json_reply(self, status, data):
        self.reply(status, json.dumps(data).encode(), "application/json")

    def do_GET(self):
        if self.headers.get("Host") != HOST or self.path != "/":
            self.send_error(404)
            return
        self.reply(200, (ROOT / "web/index.html").read_bytes(), "text/html; charset=utf-8")

    def do_POST(self):
        if self.path != "/quote" or self.headers.get("Host") != HOST:
            self.send_error(404)
            return
        if self.headers.get("Origin") != f"http://{HOST}" or self.headers.get_content_type() != "application/json":
            self.json_reply(403, {"error": "Open the demo from its local address."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 256:
                raise ValueError
            data = json.loads(self.rfile.read(length))
            quantity, tier = data["quantity"], data["tier"]
            if type(quantity) is not int or type(tier) is not int or quantity not in range(1, 4) or tier not in range(4):
                raise ValueError
        except (ValueError, KeyError, TypeError):
            self.json_reply(400, {"error": "Choose a valid quantity and loyalty level."})
            return
        try:
            result = subprocess.run(
                [BINARY, str(quantity), str(tier)], capture_output=True,
                text=True, check=True, timeout=30,
            )
            price = int(result.stdout.strip())
        except (OSError, subprocess.SubprocessError, ValueError):
            self.json_reply(500, {"error": "The local FHE engine could not compute this quote."})
            return
        self.json_reply(200, {"price": price})


if __name__ == "__main__":
    if not BINARY.is_file():
        raise SystemExit("Build the native helper first: cargo build --release --locked")
    print(f"Confidential Quote is running at http://{HOST}", flush=True)
    HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
