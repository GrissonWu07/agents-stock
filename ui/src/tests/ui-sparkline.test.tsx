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

    const labels = Array.from(document.querySelectorAll(".sparkline__labels span")).filter((item) => /\d{2}-\d{2}/.test(item.textContent ?? ""));
    expect(labels.length).toBeLessThanOrEqual(4);
  });

  it("renders kline charts across the available panel instead of a fixed centered canvas", () => {
    const points = Array.from({ length: 22 }, (_, index) => {
      const close = 120 + Math.sin(index / 2) * 8;
      return {
        label: `2026-04-${String(index + 1).padStart(2, "0")} 15:00`,
        value: close,
        open: close - 1,
        high: close + 3,
        low: close - 4,
        close,
        volume: 30000 + index * 1000,
      };
    });

    render(<Sparkline points={points} height={340} />);

    const chart = screen.getByRole("img", { name: "K线图" });
    const viewBox = chart.getAttribute("viewBox") ?? "";
    const parts = viewBox.split(/\s+/).map(Number);
    expect(parts).toHaveLength(4);
    expect(parts[2]).toBeGreaterThanOrEqual(780);
    expect(chart).toHaveAttribute("preserveAspectRatio", "none");
    expect(chart.closest(".sparkline--kline")).not.toHaveAttribute("style");
  });
});
