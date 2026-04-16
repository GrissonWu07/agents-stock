import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sparkline } from "../components/ui/sparkline";

describe("sparkline", () => {
  it("uses a wider internal viewBox for dense series and limits visible labels", () => {
    const points = Array.from({ length: 40 }, (_, index) => ({
      label: `2026-04-${String((index % 30) + 1).padStart(2, "0")}`,
      value: 100 + ((index % 7) - 3) * 5 + index,
    }));

    render(<Sparkline points={points} />);

    const chart = screen.getByRole("img", { name: "曲线" });
    const viewBox = chart.getAttribute("viewBox") ?? "";
    const parts = viewBox.split(/\s+/).map(Number);
    expect(parts).toHaveLength(4);
    expect(parts[2]).toBeGreaterThan(100);

    const labels = screen.getAllByText(/\d{2}-\d{2}/);
    expect(labels.length).toBeLessThanOrEqual(4);
  });
});
