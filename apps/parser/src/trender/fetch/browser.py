from __future__ import annotations

import asyncio
from typing import Any

from trender.logging import get_logger

log = get_logger(__name__)

_browser: Any | None = None
_lock = asyncio.Lock()


async def _ensure_browser() -> Any:
    global _browser
    if _browser is not None:
        return _browser
    async with _lock:
        if _browser is not None:
            return _browser
        from cloakbrowser import launch_async  # imported lazily to avoid startup cost

        log.info("cloakbrowser.launching")
        _browser = await launch_async(headless=True, humanize=False)
        log.info("cloakbrowser.ready")
        return _browser


async def fetch_html(url: str, *, timeout_ms: int = 30000, wait_until: str = "domcontentloaded") -> str | None:
    browser = await _ensure_browser()
    try:
        context = await browser.new_context(locale="ko-KR")
        page = await context.new_page()
        try:
            await page.goto(url, timeout=timeout_ms, wait_until=wait_until)
            html = await page.content()
            return html
        finally:
            await context.close()
    except Exception as e:
        log.warning("cloakbrowser.fetch_failed", url=url, error=str(e))
        return None


async def shutdown() -> None:
    global _browser
    if _browser is None:
        return
    try:
        await _browser.close()
    except Exception as e:
        log.warning("cloakbrowser.close_failed", error=str(e))
    finally:
        _browser = None
