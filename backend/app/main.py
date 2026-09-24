"""FastAPI entrypoint for the RSA teaching game."""

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import classical, coin, ibm, rsa, shor

# Without this the only record of anything is uvicorn's access log, which says
# a request arrived and nothing about why it never finished.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)

app = FastAPI(title="RSA Quantum Teaching Game", version="0.1.0")

# Local ports plus any Cloud Run / custom origins. The game normally proxies
# /api through Next rewrites (no browser CORS), but allow direct calls too.
_local = [
    f"http://{host}:{port}"
    for host in ("localhost", "127.0.0.1")
    for port in (7013, 7019)
]
_extra = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_local + _extra,
    allow_origin_regex=r"https://.*\.run\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(classical.router, prefix="/api", tags=["classical"])
app.include_router(coin.router, prefix="/api/coin", tags=["coin"])
app.include_router(rsa.router, prefix="/api/rsa", tags=["rsa"])
app.include_router(shor.router, prefix="/api/shor", tags=["shor"])
app.include_router(ibm.router, prefix="/api/ibm", tags=["ibm"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
