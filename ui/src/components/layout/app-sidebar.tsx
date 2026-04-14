import { NavLink } from "react-router-dom";
import { APP_ROUTE_ITEMS } from "../../routes/manifest";

const groups = Array.from(new Set(APP_ROUTE_ITEMS.map((item) => item.group))).map((group) => ({
  title: group,
  items: APP_ROUTE_ITEMS.filter((item) => item.group === group).map((item) => ({
    to: item.path,
    label: item.label,
  })),
}));

export function AppSidebar() {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__brand-title">玄武AI智能体股票团队分析系统</div>
        <div className="app-sidebar__brand-note">单页面工作台入口，统一承接发现、研究、关注与量化流程。</div>
      </div>
      {groups.map((group) => (
        <section className="app-sidebar__group" key={group.title}>
          <div className="app-sidebar__group-title">{group.title}</div>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `app-sidebar__item${isActive ? " app-sidebar__item--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </section>
      ))}
    </aside>
  );
}
