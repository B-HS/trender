FROM mcr.microsoft.com/playwright/python:v1.59.0-noble

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON=python3.12 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    CLOAKBROWSER_CACHE_DIR=/var/cache/cloakbrowser

# cron + tini + 한국어/일본어 폰트는 base 이미지에 일부 포함됨. 누락분 보강.
RUN apt-get update \
 && apt-get install -y --no-install-recommends cron tini fonts-noto-cjk \
 && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
 && cp /root/.local/bin/uv /usr/local/bin/uv \
 && cp /root/.local/bin/uvx /usr/local/bin/uvx

WORKDIR /app

COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev || uv sync --no-dev

COPY src ./src
RUN uv sync --no-dev

# CloakBrowser Chromium 워밍업 (실패해도 런타임에 다운로드)
RUN /opt/venv/bin/python -c "from cloakbrowser import launch; b = launch(headless=True); b.close()" \
 || echo "[build] cloakbrowser warmup failed; will download at runtime"

COPY crontab /etc/cron.d/trender
RUN chmod 0644 /etc/cron.d/trender && crontab /etc/cron.d/trender
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["tini", "--", "/entrypoint.sh"]
