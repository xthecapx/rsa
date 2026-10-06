"""Local UI preview of the packaged game/services; Qollab/Pyodide is tested separately.

Run with backend/.venv Python, after npm run build:qollab. This development-only
HTTP bridge is never included in the uploaded folder.
"""
import argparse
import json
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "dist/qollab"
sys.path.insert(0, str(ROOT))
from quantum.services import dispatch_json, describe

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--backend", choices=["ideal", "ibm-marrakesh"], default="ideal")
parser.add_argument("--port", type=int, default=7027)
args = parser.parse_args()
if args.backend == "ibm-marrakesh":
    from qiskit_ibm_runtime.fake_provider import FakeMarrakesh
    backend = FakeMarrakesh()
else:
    from qiskit_aer import AerSimulator
    backend = AerSimulator(method="stabilizer")
    # Shor is non-Clifford. Aer automatically selects a suitable method.
    backend.set_options(method="automatic")
lock = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/":
            html = (ROOT / "index.html").read_text()
            info = describe(backend)
            # Preview loads regular ESM; the real bootstrap is Qollab-aware and
            # imports Python. This page intentionally tests only browser UI.
            html += '<link rel="stylesheet" href="/main.css"><script type="module">'
            html += "import './assets.js'; import {mountGame} from './game.js'; import {batches,recorded} from './recorded.js';"
            html += "const request=async(path,init)=>{if(path.startsWith('/api/ibm/')){const data=path==='/api/ibm/batches'?{batches}:path==='/api/ibm/cached'?recorded.m8:recorded[path.slice('/api/ibm/batch/'.length)];return new Response(JSON.stringify(data),{status:data?200:404})}return fetch(path,init)};"
            html += "mountGame({request,backend:" + json.dumps(info["backend"]) + ",kind:" + json.dumps(info["kind"]) + "});"
            html += "document.getElementById('quantum-runtime-status').textContent='Local bundle preview (native Python bridge; not Pyodide)';</script>"
            data = html.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode()
        with lock:
            result = json.loads(dispatch_json(backend, self.path, body))
        data = json.dumps(result["data"]).encode()
        self.send_response(result["status"])
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


print(f"Bundle preview: http://localhost:{args.port} ({args.backend}); this is not a Qollab runtime test.", flush=True)
ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
