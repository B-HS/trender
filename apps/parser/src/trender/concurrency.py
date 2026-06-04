from __future__ import annotations

import asyncio
from typing import Awaitable, Callable, Sequence, TypeVar

T = TypeVar("T")

DEFAULT_CONCURRENCY = 3


async def run_concurrent(items: Sequence[T], worker: Callable[[T], Awaitable[bool]], *, limit: int = DEFAULT_CONCURRENCY) -> int:
    """worker(item)->bool 를 최대 limit 개씩 동시에 실행하고 True 개수를 센다.

    Ollama 클라우드 플랜의 동시 모델 한도(기본 3)에 맞춘 fan-out 헬퍼.
    """
    sem = asyncio.Semaphore(limit)

    async def _guarded(item: T) -> object:
        async with sem:
            return await worker(item)

    results = await asyncio.gather(*(_guarded(it) for it in items), return_exceptions=True)
    return sum(1 for r in results if r is True)
