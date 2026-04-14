from pathlib import Path
import json


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def test_ui_docs_cover_spa_and_independent_deployment():
    root_readme = (PROJECT_ROOT / "README.md").read_text(encoding="utf-8")
    ui_readme = (PROJECT_ROOT / "ui" / "README.md").read_text(encoding="utf-8")
    spec = (
        PROJECT_ROOT
        / "docs"
        / "superpowers"
        / "specs"
        / "2026-04-13-ui-single-page-workbench-design.md"
    ).read_text(encoding="utf-8")

    for text in [root_readme, ui_readme, spec]:
        assert "玄武AI智能体股票团队分析系统" in text
        assert "单页" in text or "single-page" in text.lower()
        assert "nginx" in text.lower()
        assert "/api/health" in text
        assert "_stcore/health" not in text
        assert "streamlit run app.py" not in text.lower()

    for route in ["/main", "/discover", "/research", "/portfolio", "/live-sim", "/his-replay", "/ai-monitor", "/real-monitor"]:
        assert route in root_readme
        assert route in ui_readme
        assert route in spec


def test_ui_frontend_readme_covers_local_dev_and_docker_modes():
    ui_readme = (PROJECT_ROOT / "ui" / "README.md").read_text(encoding="utf-8")
    assert "npm run dev" in ui_readme
    assert "8503" in ui_readme
    assert "build/Dockerfile.ui" in ui_readme
    assert "build/nginx.conf" in ui_readme
    assert "build/docker-compose.yml" in ui_readme
    assert "/api/health" in ui_readme


def test_ui_docker_layout_files_are_documented():
    compose = (PROJECT_ROOT / "build" / "docker-compose.yml").read_text(encoding="utf-8")
    nginx = (PROJECT_ROOT / "build" / "nginx.conf").read_text(encoding="utf-8")
    dockerfile_ui = (PROJECT_ROOT / "build" / "Dockerfile.ui").read_text(encoding="utf-8")

    assert "frontend:" in compose
    assert "backend:" in compose
    assert "build/Dockerfile.ui" in compose
    assert "8080:80" in compose
    assert "8503:8503" in compose

    assert "try_files $uri /index.html" in nginx
    assert "proxy_pass http://backend:8503" in nginx
    assert "nginx" in dockerfile_ui.lower()
    assert "/ui/dist" in dockerfile_ui


def test_ui_package_scripts_support_local_development():
    package = json.loads((PROJECT_ROOT / "ui" / "package.json").read_text(encoding="utf-8"))
    assert "dev" in package["scripts"]
    assert "build" in package["scripts"]
    assert "preview" in package["scripts"]
