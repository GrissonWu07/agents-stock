import { useLocation } from "react-router-dom";
import { APP_ROUTE_LABELS } from "../../routes/manifest";

export function AppHeader() {
  const location = useLocation();
  const title = APP_ROUTE_LABELS[location.pathname] ?? "工作台";

  return (
    <header className="app-header">
      <div>
        <div className="app-header__title">{title}</div>
        <div className="app-header__subtitle">玄武AI智能体股票团队分析系统 · 单页面工作台</div>
      </div>
    </header>
  );
}
