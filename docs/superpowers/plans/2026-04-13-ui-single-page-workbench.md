# REUI Single-Page Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated single-page frontend shell for `玄武AI智能体股票团队分析系统`, with clear routes, modern workbench styling, and an nginx-based Docker deployment path while keeping current Python behavior intact.

**Architecture:** Add a new `ui/` frontend project using React + Vite + TypeScript and migrate the shell page-by-page. Keep Python services in `app/` as the business backend. Use incremental integration so the old Streamlit experience remains runnable while the new frontend is scaffolded and then wired into Docker with nginx.

**Tech Stack:** Vite, React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Table, ECharts, existing Python backend in `app/`, Docker, nginx.

---

### Task 1: Scaffold the frontend project and route shell

**Files:**
- Create: `ui/package.json`
- Create: `ui/tsconfig.json`
- Create: `ui/vite.config.ts`
- Create: `ui/index.html`
- Create: `ui/src/main.tsx`
- Create: `ui/src/App.tsx`
- Create: `ui/src/routes/index.tsx`
- Create: `ui/src/styles/globals.css`
- Test: `tests/test_reui_layout_docs.py`

- [ ] **Step 1: Write the failing test**

```python
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_reui_project_scaffold_exists():
    assert (PROJECT_ROOT / "ui" / "package.json").exists()
    assert (PROJECT_ROOT / "ui" / "src" / "main.tsx").exists()
    assert (PROJECT_ROOT / "ui" / "src" / "routes" / "index.tsx").exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_reui_project_scaffold_exists`
Expected: FAIL because `ui/` files do not exist yet

- [ ] **Step 3: Write minimal implementation**

```tsx
// ui/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
```

```tsx
// ui/src/routes/index.tsx
import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../App";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
  },
  {
    path: "/main",
    element: <AppShell />,
  },
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_reui_project_scaffold_exists`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/package.json ui/tsconfig.json ui/vite.config.ts ui/index.html ui/src/main.tsx ui/src/App.tsx ui/src/routes/index.tsx ui/src/styles/globals.css tests/test_reui_layout_docs.py
git commit -m "feat: scaffold reui frontend shell"
```

### Task 2: Define the SPA route map and application shell

**Files:**
- Modify: `ui/src/App.tsx`
- Modify: `ui/src/routes/index.tsx`
- Create: `ui/src/components/layout/app-shell.tsx`
- Create: `ui/src/components/layout/app-sidebar.tsx`
- Create: `ui/src/components/layout/app-header.tsx`
- Test: `tests/test_reui_layout_docs.py`

- [ ] **Step 1: Write the failing test**

```python
def test_reui_route_map_is_documented_in_code():
    routes_source = (PROJECT_ROOT / "ui" / "src" / "routes" / "index.tsx").read_text(encoding="utf-8")
    for route in ["/main", "/discover", "/research", "/portfolio", "/live-sim", "/his-replay", "/ai-monitor", "/real-monitor", "/history", "/settings"]:
        assert route in routes_source
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_reui_route_map_is_documented_in_code`
Expected: FAIL because only `/` and `/main` exist

- [ ] **Step 3: Write minimal implementation**

```tsx
// ui/src/routes/index.tsx
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "../App";

const ROUTES = [
  "/main",
  "/discover",
  "/research",
  "/portfolio",
  "/live-sim",
  "/his-replay",
  "/ai-monitor",
  "/real-monitor",
  "/history",
  "/settings",
];

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/main" replace /> },
  ...ROUTES.map((path) => ({ path, element: <AppShell /> })),
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_reui_route_map_is_documented_in_code`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/App.tsx ui/src/routes/index.tsx ui/src/components/layout/app-shell.tsx ui/src/components/layout/app-sidebar.tsx ui/src/components/layout/app-header.tsx tests/test_reui_layout_docs.py
git commit -m "feat: add reui shell and route map"
```

### Task 3: Apply the approved workbench branding and design system

**Files:**
- Modify: `ui/index.html`
- Modify: `ui/src/styles/globals.css`
- Create: `ui/src/components/ui/workbench-card.tsx`
- Create: `ui/src/components/ui/page-header.tsx`
- Test: `tests/test_reui_layout_docs.py`

- [ ] **Step 1: Write the failing test**

```python
def test_reui_brand_name_is_present():
    html = (PROJECT_ROOT / "ui" / "index.html").read_text(encoding="utf-8")
    css = (PROJECT_ROOT / "ui" / "src" / "styles" / "globals.css").read_text(encoding="utf-8")
    assert "玄武AI智能体股票团队分析系统" in html
    assert "--app-bg" in css
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_reui_brand_name_is_present`
Expected: FAIL because the new title/tokens are not present yet

- [ ] **Step 3: Write minimal implementation**

```html
<!-- ui/index.html -->
<title>玄武AI智能体股票团队分析系统</title>
```

```css
/* ui/src/styles/globals.css */
:root {
  --app-bg: #f4f7fc;
  --panel-bg: #ffffff;
  --soft-bg: #eef4ff;
  --text-strong: #1f2a44;
  --text-soft: #6c7694;
  --accent: #4f6ef7;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_reui_brand_name_is_present`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/index.html ui/src/styles/globals.css ui/src/components/ui/workbench-card.tsx ui/src/components/ui/page-header.tsx tests/test_reui_layout_docs.py
git commit -m "feat: add reui branding and design tokens"
```

### Task 4: Build the `/main` workbench page around watchlist-first workflow

**Files:**
- Create: `ui/src/features/workbench/workbench-page.tsx`
- Create: `ui/src/features/workbench/watchlist-panel.tsx`
- Create: `ui/src/features/workbench/stock-analysis-panel.tsx`
- Create: `ui/src/features/workbench/next-steps-panel.tsx`
- Modify: `ui/src/App.tsx`
- Test: `tests/test_reui_layout_docs.py`

- [ ] **Step 1: Write the failing test**

```python
def test_main_route_mentions_watchlist_and_stock_analysis():
    source = (PROJECT_ROOT / "ui" / "src" / "features" / "workbench" / "workbench-page.tsx").read_text(encoding="utf-8")
    assert "我的关注" in source
    assert "股票分析" in source
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_main_route_mentions_watchlist_and_stock_analysis`
Expected: FAIL because the workbench page file does not exist yet

- [ ] **Step 3: Write minimal implementation**

```tsx
// ui/src/features/workbench/workbench-page.tsx
export function WorkbenchPage() {
  return (
    <div>
      <section>我的关注</section>
      <section>股票分析</section>
      <section>下一步</section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_main_route_mentions_watchlist_and_stock_analysis`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/features/workbench/workbench-page.tsx ui/src/features/workbench/watchlist-panel.tsx ui/src/features/workbench/stock-analysis-panel.tsx ui/src/features/workbench/next-steps-panel.tsx ui/src/App.tsx tests/test_reui_layout_docs.py
git commit -m "feat: add watchlist-first reui workbench page"
```

### Task 5: Add aggregate pages for discover and research

**Files:**
- Create: `ui/src/features/discover/discover-page.tsx`
- Create: `ui/src/features/research/research-page.tsx`
- Modify: `ui/src/routes/index.tsx`
- Test: `tests/test_reui_layout_docs.py`

- [ ] **Step 1: Write the failing test**

```python
def test_discover_and_research_pages_reference_expected_modules():
    discover = (PROJECT_ROOT / "ui" / "src" / "features" / "discover" / "discover-page.tsx").read_text(encoding="utf-8")
    research = (PROJECT_ROOT / "ui" / "src" / "features" / "research" / "research-page.tsx").read_text(encoding="utf-8")
    assert "主力选股" in discover
    assert "低价擒牛" in discover
    assert "智策板块" in research
    assert "新闻流量" in research
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_discover_and_research_pages_reference_expected_modules`
Expected: FAIL because those files do not exist yet

- [ ] **Step 3: Write minimal implementation**

```tsx
// ui/src/features/discover/discover-page.tsx
export function DiscoverPage() {
  return <div>主力选股 / 低价擒牛 / 小市值 / 净利增长 / 低估值</div>;
}

// ui/src/features/research/research-page.tsx
export function ResearchPage() {
  return <div>智策板块 / 智瞰龙虎 / 新闻流量 / 宏观分析 / 宏观周期</div>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_discover_and_research_pages_reference_expected_modules`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/features/discover/discover-page.tsx ui/src/features/research/research-page.tsx ui/src/routes/index.tsx tests/test_reui_layout_docs.py
git commit -m "feat: add reui discovery and research pages"
```

### Task 6: Add quant and monitor route shells

**Files:**
- Create: `ui/src/features/quant/live-sim-page.tsx`
- Create: `ui/src/features/quant/his-replay-page.tsx`
- Create: `ui/src/features/monitor/ai-monitor-page.tsx`
- Create: `ui/src/features/monitor/real-monitor-page.tsx`
- Create: `ui/src/features/portfolio/portfolio-page.tsx`
- Create: `ui/src/features/history/history-page.tsx`
- Create: `ui/src/features/settings/settings-page.tsx`
- Modify: `ui/src/routes/index.tsx`
- Test: `tests/test_reui_layout_docs.py`

- [ ] **Step 1: Write the failing test**

```python
def test_quant_and_monitor_route_components_exist():
    for path in [
        PROJECT_ROOT / "ui" / "src" / "features" / "quant" / "live-sim-page.tsx",
        PROJECT_ROOT / "ui" / "src" / "features" / "quant" / "his-replay-page.tsx",
        PROJECT_ROOT / "ui" / "src" / "features" / "monitor" / "ai-monitor-page.tsx",
        PROJECT_ROOT / "ui" / "src" / "features" / "monitor" / "real-monitor-page.tsx",
    ]:
        assert path.exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_quant_and_monitor_route_components_exist`
Expected: FAIL because route component files do not exist yet

- [ ] **Step 3: Write minimal implementation**

```tsx
export function LiveSimPage() {
  return <div>量化模拟</div>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_quant_and_monitor_route_components_exist`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/src/features/quant/live-sim-page.tsx ui/src/features/quant/his-replay-page.tsx ui/src/features/monitor/ai-monitor-page.tsx ui/src/features/monitor/real-monitor-page.tsx ui/src/features/portfolio/portfolio-page.tsx ui/src/features/history/history-page.tsx ui/src/features/settings/settings-page.tsx ui/src/routes/index.tsx tests/test_reui_layout_docs.py
git commit -m "feat: add reui quant and monitor route shells"
```

### Task 7: Add frontend build and dev scripts for side-by-side startup

**Files:**
- Modify: `ui/package.json`
- Create: `ui/README.md`
- Modify: `README.md`
- Test: `tests/test_reui_layout_docs.py`

- [ ] **Step 1: Write the failing test**

```python
import json

def test_ui_package_has_dev_and_build_scripts():
    package = json.loads((PROJECT_ROOT / "ui" / "package.json").read_text(encoding="utf-8"))
    assert "dev" in package["scripts"]
    assert "build" in package["scripts"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_ui_package_has_dev_and_build_scripts`
Expected: FAIL because scripts are not fully defined yet

- [ ] **Step 3: Write minimal implementation**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_ui_package_has_dev_and_build_scripts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add ui/package.json ui/README.md README.md tests/test_reui_layout_docs.py
git commit -m "chore: add reui dev and build scripts"
```

### Task 8: Add nginx-based Docker frontend deployment

**Files:**
- Create: `build/nginx.conf`
- Modify: `build/docker-compose.yml`
- Modify: `build/Dockerfile`
- Create: `build/Dockerfile.ui`
- Test: `tests/test_docker_build_layout.py`

- [ ] **Step 1: Write the failing test**

```python
def test_build_directory_contains_nginx_frontend_artifacts():
    assert (PROJECT_ROOT / "build" / "nginx.conf").exists()
    assert (PROJECT_ROOT / "build" / "Dockerfile.ui").exists()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_docker_build_layout.py::test_build_directory_contains_nginx_frontend_artifacts`
Expected: FAIL because frontend Docker assets do not exist yet

- [ ] **Step 3: Write minimal implementation**

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri /index.html;
  }

  location /api/ {
    proxy_pass http://backend:8503/;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest -q -p no:cacheprovider tests/test_docker_build_layout.py::test_build_directory_contains_nginx_frontend_artifacts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add build/nginx.conf build/Dockerfile.ui build/docker-compose.yml build/Dockerfile tests/test_docker_build_layout.py
git commit -m "feat: add nginx deployment for reui frontend"
```

### Task 9: Verify the reui shell end-to-end

**Files:**
- Modify: `tests/test_reui_layout_docs.py`
- Test: `tests/test_reui_layout_docs.py`

- [ ] **Step 1: Write the failing test**

```python
def test_reui_spec_paths_and_branding_are_consistent():
    source = (PROJECT_ROOT / "ui" / "src" / "routes" / "index.tsx").read_text(encoding="utf-8")
    assert "玄武AI智能体股票团队分析系统" in (PROJECT_ROOT / "ui" / "index.html").read_text(encoding="utf-8")
    assert "/main" in source and "/live-sim" in source and "/his-replay" in source
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py::test_reui_spec_paths_and_branding_are_consistent`
Expected: FAIL until all earlier pieces are complete

- [ ] **Step 3: Run the full verification set**

Run: `python -m pytest -q -p no:cacheprovider tests/test_reui_layout_docs.py tests/test_docker_build_layout.py`
Expected: PASS

Run: `python -m compileall app app.py run.py`
Expected: PASS

Run: `python -c "import app; import app.app; print('backend-ok')"`
Expected: `backend-ok`

- [ ] **Step 4: Start both runtimes locally for smoke verification**

Run:

```bash
cd ui && npm install && npm run build
python -m streamlit run app.py --server.port 8501 --server.headless true
```

Expected:
- backend still starts
- frontend build succeeds

- [ ] **Step 5: Commit**

```bash
git add tests/test_reui_layout_docs.py
git commit -m "test: verify reui shell scaffold and deployment"
```
