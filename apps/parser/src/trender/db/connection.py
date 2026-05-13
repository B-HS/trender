from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator
from urllib.parse import urlparse

import mysql.connector
from mysql.connector.pooling import MySQLConnectionPool

from trender.config import get_settings

_pool: MySQLConnectionPool | None = None


def _parse_url(url: str) -> dict[str, Any]:
    parsed = urlparse(url)
    if parsed.scheme not in {"mysql", "mysql+pymysql"}:
        raise ValueError(f"Unsupported DATABASE_URL scheme: {parsed.scheme}")
    if parsed.username is None or parsed.password is None:
        raise ValueError("DATABASE_URL must include user and password")
    if parsed.hostname is None:
        raise ValueError("DATABASE_URL must include host")
    return {
        "user": parsed.username,
        "password": parsed.password,
        "host": parsed.hostname,
        "port": parsed.port or 3306,
        "database": parsed.path.lstrip("/") or "trender",
        "charset": "utf8mb4",
        "use_unicode": True,
        "autocommit": False,
    }


def get_pool() -> MySQLConnectionPool:
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = MySQLConnectionPool(pool_name="trender", pool_size=5, **_parse_url(settings.database_url))
    return _pool


@contextmanager
def cursor(dictionary: bool = True) -> Iterator[Any]:
    conn = get_pool().get_connection()
    cur = conn.cursor(dictionary=dictionary)
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()
