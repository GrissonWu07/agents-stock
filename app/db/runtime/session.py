from __future__ import annotations

from sqlalchemy.orm import Session, sessionmaker


def build_session_factory(*, bind) -> sessionmaker[Session]:  # type: ignore[type-arg]
    return sessionmaker(bind=bind, future=True, expire_on_commit=False)
