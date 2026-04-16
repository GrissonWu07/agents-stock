import os
import sqlite3
from pathlib import Path
from dotenv import load_dotenv
from app.runtime_paths import default_db_path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# 加载环境变量（override=True 强制覆盖已存在的环境变量）
load_dotenv(dotenv_path=PROJECT_ROOT / ".env", override=True)


def _load_settings_from_db() -> None:
    """从数据库覆盖运行环境配置（数据库优先于 .env）。"""
    db_path = default_db_path("settings.db")
    if not db_path.exists():
        return
    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT key, value FROM system_settings").fetchall()
        conn.close()
        for row in rows:
            key = str(row["key"])
            value = "" if row["value"] is None else str(row["value"])
            os.environ[key] = value
    except Exception:
        # 配置读取失败时保持 .env 兜底行为
        pass


_load_settings_from_db()

# AI API配置（统一使用通用环境变量）
AI_API_KEY = (
    os.getenv("AI_API_KEY", "").strip()
)

AI_API_BASE_URL = (
    os.getenv("AI_API_BASE_URL", "").strip()
    or "https://openrouter.ai/api/v1"
)

def normalize_model_name(model_name: str | None) -> str:
    """统一归一化模型名，兼容 OpenRouter 短名写法。"""
    normalized = (model_name or "").strip()
    if not normalized:
        return normalized

    base_url = (AI_API_BASE_URL or "").lower()
    base_has_openrouter = "openrouter.ai" in base_url

    normalized_lower = normalized.lower()

    if normalized_lower == "deepseek-chat":
        if base_has_openrouter:
            return "deepseek/deepseek-chat"
        return normalized

    if normalized_lower == "deepseek-reasoner":
        if base_has_openrouter:
            return "deepseek/deepseek-reasoner"
        return normalized

    return normalized

# 默认AI模型名称（统一使用OpenRouter模型规范）
DEFAULT_MODEL_NAME = normalize_model_name(os.getenv("DEFAULT_MODEL_NAME", "deepseek/deepseek-v3.2"))
MODEL_REQUEST_TIMEOUT_SECONDS = int(os.getenv("MODEL_REQUEST_TIMEOUT_SECONDS", "30"))
WORKBENCH_ANALYSIS_TIMEOUT_SECONDS = int(os.getenv("WORKBENCH_ANALYSIS_TIMEOUT_SECONDS", "120"))
EXTERNAL_DATA_TASK_TIMEOUT_SECONDS = float(os.getenv("EXTERNAL_DATA_TASK_TIMEOUT_SECONDS", "6"))
RISK_QUERY_DELAY_SECONDS = float(os.getenv("RISK_QUERY_DELAY_SECONDS", "0.2"))

# 多智能体分析的模型输出预算，默认按“够用但不过量”的原则收紧
ANALYSIS_CALL_MAX_TOKENS = int(os.getenv("ANALYSIS_CALL_MAX_TOKENS", "2400"))
TECHNICAL_ANALYSIS_MAX_TOKENS = int(os.getenv("TECHNICAL_ANALYSIS_MAX_TOKENS", "1600"))
FUNDAMENTAL_ANALYSIS_MAX_TOKENS = int(os.getenv("FUNDAMENTAL_ANALYSIS_MAX_TOKENS", "2200"))
FUND_FLOW_ANALYSIS_MAX_TOKENS = int(os.getenv("FUND_FLOW_ANALYSIS_MAX_TOKENS", "2200"))
RISK_ANALYSIS_MAX_TOKENS = int(os.getenv("RISK_ANALYSIS_MAX_TOKENS", "2400"))
MARKET_SENTIMENT_ANALYSIS_MAX_TOKENS = int(os.getenv("MARKET_SENTIMENT_ANALYSIS_MAX_TOKENS", "2200"))
NEWS_ANALYSIS_MAX_TOKENS = int(os.getenv("NEWS_ANALYSIS_MAX_TOKENS", "2200"))
TEAM_DISCUSSION_MAX_TOKENS = int(os.getenv("TEAM_DISCUSSION_MAX_TOKENS", "1200"))

# 其他配置
TUSHARE_TOKEN = os.getenv("TUSHARE_TOKEN", "")

# 股票数据源配置
DEFAULT_PERIOD = "1y"  # 默认获取1年数据
DEFAULT_INTERVAL = "1d"  # 默认日线数据

# MiniQMT量化交易配置
MINIQMT_CONFIG = {
    'enabled': os.getenv("MINIQMT_ENABLED", "false").lower() == "true",
    'account_id': os.getenv("MINIQMT_ACCOUNT_ID", ""),
    'host': os.getenv("MINIQMT_HOST", "127.0.0.1"),
    'port': int(os.getenv("MINIQMT_PORT", "58610")),
}

# TDX 股票数据源配置（使用 pytdx 直连通达信行情服务器）
DEFAULT_TDX_HOSTS_FILE = str(Path(__file__).resolve().parent / "config" / "pytdx_hosts.json")
TDX_CONFIG = {
    'enabled': os.getenv("TDX_ENABLED", "false").lower() == "true",
    'host': os.getenv("TDX_HOST", "").strip() or None,
    'port': int(os.getenv("TDX_PORT", "7709")),
    'timeout': int(os.getenv("TDX_TIMEOUT", "5")),
    'hosts_file': os.getenv("TDX_HOSTS_FILE", DEFAULT_TDX_HOSTS_FILE).strip() or DEFAULT_TDX_HOSTS_FILE,
    'fallback_hosts': [
        item.strip()
        for item in os.getenv("TDX_FALLBACK_HOSTS", "").split(",")
        if item.strip()
    ],
}
