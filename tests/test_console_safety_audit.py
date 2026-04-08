from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
EXCLUDED = {
    "console_utils.py",
    "sitecustomize.py",
}


def test_python_files_with_print_use_console_safety():
    risky_files = []

    for path in REPO_ROOT.glob("*.py"):
        if path.name in EXCLUDED:
            continue

        text = path.read_text(encoding="utf-8")
        if "print(" not in text:
            continue

        has_safe_alias = "from console_utils import safe_print as print" in text
        has_global_install = "install_safe_print()" in text
        if not (has_safe_alias or has_global_install):
            risky_files.append(path.name)

    assert risky_files == []
