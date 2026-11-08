#!/usr/bin/env python3
"""Tiny static file server with quieter logs.

Why:
- `python -m http.server` is great, but it prints noisy stack traces when the
  browser cancels a request (BrokenPipeError / ConnectionResetError).

Usage:
    python3 serve.py
    python3 serve.py --port 8000 --bind 127.0.0.1   (the defaults)

Then open:
    http://127.0.0.1:8000/

This serves the current working directory.
"""

from __future__ import annotations

import argparse
import contextlib
import http.server
import socket
import socketserver
from typing import Optional


class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    # Keep logs, but drop the stack traces on common disconnects.

    def log_message(self, format: str, *args) -> None:  # noqa: A002 (shadowing built-in)
        # Same as default, but you can comment this out if you prefer silence.
        super().log_message(format, *args)

    def handle(self) -> None:
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            # Client went away mid-response; ignore.
            return

    def finish(self) -> None:
        # Errors can also occur during flush.
        with contextlib.suppress(BrokenPipeError, ConnectionResetError):
            super().finish()


class ThreadingTCPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Serve this folder over HTTP (quiet disconnect handling).")
    parser.add_argument("--bind", default="127.0.0.1", help="Bind address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port (default: 8000)")
    args = parser.parse_args(argv)

    server_address = (args.bind, args.port)

    # Prefer IPv4 bind to avoid surprises on some machines.
    with ThreadingTCPServer(server_address, QuietHTTPRequestHandler) as httpd:
        sa = httpd.socket.getsockname()
        host, port = sa[0], sa[1]
        print(f"Serving on http://{host}:{port}/ (Ctrl+C to stop)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopped.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
