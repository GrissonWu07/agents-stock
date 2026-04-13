from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def test_docker_files_live_under_build_directory():
    assert (PROJECT_ROOT / "build" / "Dockerfile").exists()
    assert (PROJECT_ROOT / "build" / "Dockerfile国内源版").exists()
    assert (PROJECT_ROOT / "build" / "docker-compose.yml").exists()
    assert (PROJECT_ROOT / "build" / ".dockerignore").exists()

    assert not (PROJECT_ROOT / "Dockerfile").exists()
    assert not (PROJECT_ROOT / "Dockerfile国内源版").exists()
    assert not (PROJECT_ROOT / "docker-compose.yml").exists()


def test_root_dockerignore_is_compatibility_shim():
    dockerignore = (PROJECT_ROOT / ".dockerignore").read_text(encoding="utf-8")
    assert "Docker compatibility shim" in dockerignore
    assert "build/.dockerignore" in dockerignore
