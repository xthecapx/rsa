"""FastAPI entrypoint for the RSA teaching game."""

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import classical, ibm, rsa, shor

# Without this the only record of anything is uvicorn's access log, which says
# a request arrived and nothing about why it never finished.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)

app = FastAPI(title="RSA Quantum Teaching Game", version="0.1.0")

# Secondary fallback for local non-Docker runs; Docker uses Next.js rewrite
# proxy. 3000 is the frontend, 3001 the game, 3002 the game run outside Docker.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://{host}:{port}"
        for host in ("localhost", "127.0.0.1")
        for port in (3000, 3001, 3002)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(classical.router, prefix="/api", tags=["classical"])
app.include_router(rsa.router, prefix="/api/rsa", tags=["rsa"])
app.include_router(shor.router, prefix="/api/shor", tags=["shor"])
app.include_router(ibm.router, prefix="/api/ibm", tags=["ibm"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
