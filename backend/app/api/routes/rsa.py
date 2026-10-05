"""RSA toy endpoints."""

from fastapi import APIRouter, HTTPException

from app.core import (
    rsa_decrypt,
    rsa_encrypt,
    rsa_keygen,
)
from app.models.schemas import (
    RsaCrackRequest,
    RsaDecryptRequest,
    RsaEncryptRequest,
    RsaKeygenRequest,
)

from app.core.game_services import crack_rsa

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
    return crack_rsa(req.N, req.bits)
