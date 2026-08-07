"""Application settings from environment variables."""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, List, Optional, Tuple
from urllib.parse import quote

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


def parse_batch_ids(value: str | List[Tuple[str, str]]) -> List[Tuple[str, str]]:
    """Parse `m3=id1,m4=id2` or bare ids into (label, batch_id) pairs."""
    if isinstance(value, list):
        return value
    if not value or not str(value).strip():
        return []
    pairs: List[Tuple[str, str]] = []
    for part in str(value).split(","):
        part = part.strip()
        if not part:
            continue
        if "=" in part:
            label, batch_id = part.split("=", 1)
            label, batch_id = label.strip(), batch_id.strip()
            if batch_id:
                pairs.append((label or batch_id, batch_id))
        else:
            pairs.append((part, part))
    return pairs


class Settings(BaseSettings):
    """Stateless configuration for the talk app."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ibm_quantum_channel: Optional[str] = None
    ibm_quantum_token: Optional[str] = None
    ibm_quantum_instance: Optional[str] = None

    # CRN for console deep-links (IBM Quantum Platform instance).
    ibm_catalog_instance: Optional[str] = None

    # NoDecode: env value is `m3=uuid,m4=uuid`, not JSON. Without this,
    # pydantic-settings json.loads the list type and 500s on /api/ibm/*.
    ibm_batch_ids: Annotated[List[Tuple[str, str]], NoDecode] = Field(
        default_factory=list
    )
    ibm_console_base: str = "https://quantum.cloud.ibm.com"
    # Batch / session: /instances/{crn_encoded}/sessions/{id}
    ibm_session_path_template: str = "/instances/{crn_encoded}/sessions/{id}"
    # Individual job fallback when no CRN: /workloads/{id}
    ibm_job_path_template: str = "/instances/{crn_encoded}/jobs/{id}"
    ibm_workload_path_template: str = "/workloads/{id}"

    @field_validator("ibm_batch_ids", mode="before")
    @classmethod
    def _parse_batches(cls, v):
        return parse_batch_ids(v)

    @property
    def crn_encoded(self) -> Optional[str]:
        crn = (self.ibm_catalog_instance or "").strip()
        if not crn:
            return None
        return quote(crn, safe="")

    def session_url(self, batch_id: str) -> str:
        """Console URL for a Batch / session (m3–m8)."""
        base = self.ibm_console_base.rstrip("/")
        crn = self.crn_encoded
        if crn:
            path = self.ibm_session_path_template.format(
                crn_encoded=crn, id=batch_id
            )
            return f"{base}{path}"
        path = self.ibm_workload_path_template.replace("{id}", batch_id)
        return f"{base}{path}"

    def job_url(self, job_id: str) -> str:
        """Console URL for an individual Sampler job."""
        base = self.ibm_console_base.rstrip("/")
        crn = self.crn_encoded
        if crn:
            path = self.ibm_job_path_template.format(crn_encoded=crn, id=job_id)
            return f"{base}{path}"
        path = self.ibm_workload_path_template.replace("{id}", job_id)
        return f"{base}{path}"

    def workload_url(self, workload_id: str) -> str:
        """Backward-compatible alias — prefer session_url for batches."""
        return self.session_url(workload_id)


@lru_cache
def get_settings() -> Settings:
    return Settings()
