export function toDisplayText(value: unknown, fallback = "-") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : fallback;
  }

  if (value == null) {
    return fallback;
  }

  return String(value);
}

export function toDisplayCount(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return String(fallback);
}

export type QuantTaskLike = {
  status?: unknown;
};

export function summarizeTaskStatuses(tasks: QuantTaskLike[]) {
  return tasks.reduce(
    (acc, task) => {
      const status = typeof task.status === "string" ? task.status : "";
      if (status === "completed") acc.completed += 1;
      if (status === "running") acc.running += 1;
      if (status === "queued") acc.queued += 1;
      if (status === "cancelled") acc.cancelled += 1;
      return acc;
    },
    {
      completed: 0,
      running: 0,
      queued: 0,
      cancelled: 0,
    },
  );
}
