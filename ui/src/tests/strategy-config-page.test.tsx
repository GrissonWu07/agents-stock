import { describe, expect, it } from "vitest";
import { buildUnifiedEditableConfig } from "../features/settings/strategy-config-page";

const getPolicy = (config: Record<string, unknown>, path: string[]) => {
  let value: unknown = config;
  for (const key of path) {
    value = (value as Record<string, unknown>)[key];
  }
  return value as Record<string, unknown>;
};

describe("StrategyConfigPage config normalization", () => {
  it("keeps built-in profile stock feedback policy ahead of candidate defaults", () => {
    const config = buildUnifiedEditableConfig({
      base: {
        context: {
          stock_execution_feedback_policy: {
            loss_reentry_size_multiplier: 0.5,
            repeated_stop_size_multiplier: 0.35,
          },
        },
      },
      profiles: {
        candidate: {
          context: {},
        },
        position: {
          context: {},
        },
      },
    });

    expect(getPolicy(config, ["base", "context", "stock_execution_feedback_policy"])).toMatchObject({
      loss_reentry_size_multiplier: 0.5,
      repeated_stop_size_multiplier: 0.35,
    });
    expect(getPolicy(config, ["profiles", "candidate", "context", "stock_execution_feedback_policy"])).toMatchObject({
      loss_reentry_size_multiplier: 0.5,
      repeated_stop_size_multiplier: 0.35,
    });
    expect(getPolicy(config, ["profiles", "position", "context", "stock_execution_feedback_policy"])).toMatchObject({
      loss_reentry_size_multiplier: 0.5,
      repeated_stop_size_multiplier: 0.35,
    });
  });
});
