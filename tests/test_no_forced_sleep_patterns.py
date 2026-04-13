from pathlib import Path


def test_targeted_analysis_modules_do_not_use_forced_sleep():
    files = [
        "C:/Projects/githubs/aiagents-stock/app/ai_agents.py",
        "C:/Projects/githubs/aiagents-stock/app/macro_cycle_agents.py",
        "C:/Projects/githubs/aiagents-stock/app/sector_strategy_agents.py",
        "C:/Projects/githubs/aiagents-stock/app/longhubang_agents.py",
        "C:/Projects/githubs/aiagents-stock/app/sector_strategy_engine.py",
    ]

    for file_path in files:
        text = Path(file_path).read_text(encoding="utf-8")
        assert "time.sleep(" not in text, file_path


def test_targeted_streamlit_modules_do_not_block_rerun_with_sleep():
    files = [
        "C:/Projects/githubs/aiagents-stock/app/app.py",
        "C:/Projects/githubs/aiagents-stock/app/monitor_manager.py",
        "C:/Projects/githubs/aiagents-stock/app/portfolio_ui.py",
        "C:/Projects/githubs/aiagents-stock/app/longhubang_ui.py",
        "C:/Projects/githubs/aiagents-stock/app/macro_analysis_ui.py",
    ]

    for file_path in files:
        text = Path(file_path).read_text(encoding="utf-8")
        assert "time.sleep(" not in text, file_path
