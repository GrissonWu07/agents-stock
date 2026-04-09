from pathlib import Path


def test_targeted_analysis_modules_do_not_use_forced_sleep():
    files = [
        "C:/Projects/githubs/aiagents-stock/ai_agents.py",
        "C:/Projects/githubs/aiagents-stock/macro_cycle_agents.py",
        "C:/Projects/githubs/aiagents-stock/sector_strategy_agents.py",
        "C:/Projects/githubs/aiagents-stock/longhubang_agents.py",
        "C:/Projects/githubs/aiagents-stock/sector_strategy_engine.py",
    ]

    for file_path in files:
        text = Path(file_path).read_text(encoding="utf-8")
        assert "time.sleep(" not in text, file_path


def test_targeted_streamlit_modules_do_not_block_rerun_with_sleep():
    files = [
        "C:/Projects/githubs/aiagents-stock/app.py",
        "C:/Projects/githubs/aiagents-stock/monitor_manager.py",
        "C:/Projects/githubs/aiagents-stock/portfolio_ui.py",
        "C:/Projects/githubs/aiagents-stock/longhubang_ui.py",
        "C:/Projects/githubs/aiagents-stock/macro_analysis_ui.py",
    ]

    for file_path in files:
        text = Path(file_path).read_text(encoding="utf-8")
        assert "time.sleep(" not in text, file_path
