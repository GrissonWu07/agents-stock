import { NavLink } from "react-router-dom";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import type { ActionTile } from "../../lib/page-models";

type NextStepsPanelProps = {
  steps: ActionTile[];
};

export function NextStepsPanel({ steps }: NextStepsPanelProps) {
  return (
    <WorkbenchCard>
      <h2 className="section-card__title">下一步</h2>
      <p className="section-card__description">
        从我的关注继续走到监控、发现、研究或量化验证，不需要再在侧边栏里来回找。
      </p>
      <div className="next-steps">
        {steps.map((step) => (
          <NavLink className="next-steps__item" key={step.label} to={step.href}>
            <div className="summary-item__title">{step.label}</div>
            <div className="summary-item__body">{step.hint}</div>
          </NavLink>
        ))}
      </div>
    </WorkbenchCard>
  );
}

