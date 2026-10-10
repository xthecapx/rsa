FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_CONFIG_FILE=/dev/null \
    PIP_INDEX_URL=https://pypi.org/simple \
    PATH="/opt/venv/bin:$PATH" \
    PORT=7001

FROM base AS dependencies
ARG TARGETARCH
COPY pyproject.toml ./
# Install only declared runtime dependencies. Source edits reuse this layer;
# the download cache survives dependency edits without entering the final image.
RUN --mount=type=cache,id=rsa-backend-pip-${TARGETARCH},target=/root/.cache/pip,sharing=locked \
    python -m venv /opt/venv && \
    python -c 'import tomllib; print("\n".join(tomllib.load(open("pyproject.toml", "rb"))["project"]["dependencies"]))' > /tmp/requirements.txt && \
    pip install --prefer-binary -r /tmp/requirements.txt

FROM dependencies AS development
# Compose keeps pytest/httpx available; Cloud Run never ships this stage.
RUN --mount=type=cache,id=rsa-backend-pip-${TARGETARCH},target=/root/.cache/pip,sharing=locked \
    python -c 'import tomllib; print("\n".join(tomllib.load(open("pyproject.toml", "rb"))["project"]["optional-dependencies"]["dev"]))' > /tmp/requirements-dev.txt && \
    pip install --prefer-binary -r /tmp/requirements-dev.txt
COPY app ./app
COPY tests ./tests
EXPOSE 7001
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

FROM base AS production
COPY --from=dependencies /opt/venv /opt/venv
COPY app ./app
# Cloud Run injects PORT (usually 8080); development retains 7001.
EXPOSE 8080 7001
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
