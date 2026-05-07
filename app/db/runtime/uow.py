from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator

from sqlalchemy.orm import Session, sessionmaker


@dataclass
class DatabaseUnitOfWork:
    session: Session
    readonly: bool = False

    def commit(self) -> None:
        if self.readonly:
            raise RuntimeError("Readonly database unit of work cannot commit.")
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()

    def close(self) -> None:
        self.session.close()


@contextmanager
def session_uow(factory: sessionmaker[Session], *, readonly: bool = False) -> Iterator[DatabaseUnitOfWork]:  # type: ignore[type-arg]
    session = factory()
    uow = DatabaseUnitOfWork(session=session, readonly=readonly)
    try:
        yield uow
        if readonly:
            session.rollback()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
