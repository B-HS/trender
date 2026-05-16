from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

SourceKind = Literal["keyword", "web"]
SourceStage = Literal["candidate", "active", "demoted"]
Lang = Literal["ko", "ja", "en"]
ReportKind = Literal["daily", "weekly"]


class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class Source(_Base):
    id: int | None = None
    kind: SourceKind
    value: str
    stage: SourceStage = "candidate"
    lang: Lang | None = None
    promoted_at: datetime | None = None
    last_used_at: datetime | None = None
    created_at: datetime | None = None


class Article(_Base):
    id: int | None = None
    source_id: int
    url: str
    lang: Lang
    title_original: str
    content_original: str | None = None
    published_at: datetime | None = None
    fetched_at: datetime | None = None
    keywords_extracted_at: datetime | None = None


class KeywordExtracted(_Base):
    id: int | None = None
    article_id: int
    keyword: str
    score: int = 1


class Report(_Base):
    id: int | None = None
    kind: ReportKind
    lang: Lang
    period_start: date
    period_end: date
    title: str
    markdown: str
    created_at: datetime | None = None


class ReportItem(_Base):
    id: int | None = None
    report_id: int
    article_id: int
    rank: int


class SourceStat(_Base):
    id: int | None = None
    source_id: int
    date: date
    hit_count: int = 0
    adoption_count: int = 0


class FetchedItem(_Base):
    source_id: int
    url: str
    lang: Lang
    title_original: str
    content_original: str | None = None
    published_at: datetime | None = None
