from __future__ import annotations

from importlib.resources import files
from typing import Any

import yaml

from trender.db.models import Source
from trender.db.repositories import upsert_source
from trender.logging import get_logger

log = get_logger(__name__)


def _load_yaml() -> dict[str, Any]:
    path = files("trender.seeds").joinpath("sources.yaml")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def sync_seeds() -> int:
    data = _load_yaml()
    count = 0
    for kind, entries in data.items():
        for entry in entries:
            src = Source(
                kind=kind,
                value=entry["value"],
                stage=entry.get("stage", "candidate"),
                lang=entry.get("lang"),
            )
            upsert_source(src)
            count += 1
    log.info("seeds.synced", count=count)
    return count
