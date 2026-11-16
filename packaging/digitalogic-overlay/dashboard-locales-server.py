#!/usr/bin/env python3
"""Serve a dashboard's Persian display catalog using Grafana's dashboard access checks."""
import argparse
import http.client
import json
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

DASHBOARD_LOCALE = re.compile(r"/_monitoring/dashboard-locales/([a-zA-Z0-9_-]{1,40})\.json")


def handler_for(catalog, backend, virtual_host, forwarded_proto):
    class DashboardLocaleHandler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            # Requests may carry Grafana session credentials.
            return

        def reply(self, status, body=b""):
            self.send_response(status)
            self.send_header("Cache-Control", "private, no-store")
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command == "GET" and body:
                self.wfile.write(body)

        def can_view(self, uid):
            credentials = {header: self.headers[header] for header in ("Cookie", "Authorization")
                           if header in self.headers}
            if not credentials:
                return 401

            connection = http.client.HTTPConnection(backend, timeout=3)
            try:
                connection.request("GET", f"/api/dashboards/uid/{uid}", headers={
                    **credentials,
                    "Host": virtual_host,
                    "X-Forwarded-Proto": forwarded_proto,
                    "Accept": "application/json",
                })
                with connection.getresponse() as response:
                    if response.status == 200 and response.getheader("Content-Type", "").startswith("application/json"):
                        return 200
                    if response.status in (401, 403, 404):
                        return response.status
                    return 502
            except (OSError, http.client.HTTPException, ValueError):
                return 502
            finally:
                connection.close()

        def do_GET(self):
            match = DASHBOARD_LOCALE.fullmatch(self.path.partition("?")[0])
            if not match:
                self.reply(404)
                return

            uid = match[1]
            access = self.can_view(uid)
            if access != 200:
                self.reply(access)
                return
            body = catalog.get(uid)
            if body is None:
                self.reply(404)
                return
            self.reply(200, body)

        do_HEAD = do_GET

    return DashboardLocaleHandler


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    credential = Path(os.environ.get("CREDENTIALS_DIRECTORY", ".")) / "dashboard-catalog"
    parser.add_argument("--catalog", type=Path, default=credential)
    parser.add_argument("--backend", required=True, help="Trusted Grafana backend host and port")
    parser.add_argument("--virtual-host", required=True, help="Grafana virtual host")
    parser.add_argument("--forwarded-proto", choices=("http", "https"), default="https")
    parser.add_argument("--port", type=int, default=33002)
    args = parser.parse_args()
    catalog = {uid: json.dumps(entries, ensure_ascii=False).encode("utf-8")
               for uid, entries in json.loads(args.catalog.read_text()).items()}
    with ThreadingHTTPServer(("127.0.0.1", args.port),
                             handler_for(catalog, args.backend, args.virtual_host, args.forwarded_proto)) as server:
        server.serve_forever()
