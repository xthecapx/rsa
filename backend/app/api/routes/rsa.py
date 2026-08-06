"""RSA toy endpoints."""

from fastapi import APIRouter, HTTPException

from app.core import (
    rsa_crack_toy,
    rsa_decrypt,
    rsa_encrypt,
    rsa_keygen,
    rsa_projected_crack_time,
)
from app.models.schemas import (
    RsaCrackRequest,
    RsaDecryptRequest,
    RsaEncryptRequest,
    RsaKeygenRequest,
)

router = APIRouter()


@router.post("/keygen")
def keygen(req: RsaKeygenRequest):
    try:
        return rsa_keygen(req.N)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/encrypt")
def encrypt(req: RsaEncryptRequest):
    try:
        return rsa_encrypt(req.m, req.e, req.N)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/decrypt")
def decrypt(req: RsaDecryptRequest):
    return rsa_decrypt(req.c, req.d, req.N)


@router.post("/crack")
def crack(req: RsaCrackRequest):
    toy = rsa_crack_toy(req.N)
    projection = rsa_projected_crack_time(req.bits)
    return {"toy": toy, "rsa2048_projection": projection}
