from __future__ import annotations

from typing import Literal, TypeAlias


BackendName: TypeAlias = Literal["sqlite", "mysql"]
StoreName: TypeAlias = Literal["primary", "replay"]
AccessMode: TypeAlias = Literal["readonly", "readwrite", "worker_write"]
