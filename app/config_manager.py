"""
配置管理模块
统一从 SQLite 持久化读取/保存系统配置。

兼容约定：
- 保留 read_env / write_env 方法名，避免影响既有调用方。
- .env 仅用于首次初始化导入默认值，后续以数据库为准。
"""

from __future__ import annotations

import importlib
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

from app.console_utils import safe_print as print
from app.runtime_paths import default_db_path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ENV_FILE = PROJECT_ROOT / ".env"
DEFAULT_SETTINGS_DB = default_db_path("settings.db")


class ConfigManager:
    """配置管理器（SQLite 持久化）"""

    def __init__(self, env_file: str = str(DEFAULT_ENV_FILE), db_file: str = str(DEFAULT_SETTINGS_DB)):
        env_path = Path(env_file)
        db_path = Path(db_file)
        self.env_file = env_path if env_path.is_absolute() else Path(env_file).resolve()
        self.db_file = db_path if db_path.is_absolute() else Path(db_file).resolve()
        self.db_file.parent.mkdir(parents=True, exist_ok=True)

        self.default_config = {
            "AI_API_KEY": {
                "value": "",
                "description": "AI API密钥（OpenRouter/OpenAI兼容）",
                "required": True,
                "type": "password",
            },
            "AI_API_BASE_URL": {
                "value": "https://openrouter.ai/api/v1",
                "description": "AI API地址（OpenAI兼容）",
                "required": False,
                "type": "text",
            },
            "DEFAULT_MODEL_NAME": {
                "value": "deepseek/deepseek-v3.2",
                "description": "默认模型名称（支持OpenAI兼容模型）",
                "required": False,
                "type": "select",
            },
            "TUSHARE_TOKEN": {
                "value": "",
                "description": "Tushare数据接口Token（可选）",
                "required": False,
                "type": "password",
            },
            "MINIQMT_ENABLED": {
                "value": "false",
                "description": "启用MiniQMT量化交易",
                "required": False,
                "type": "boolean",
            },
            "MINIQMT_ACCOUNT_ID": {
                "value": "",
                "description": "MiniQMT账户ID",
                "required": False,
                "type": "text",
            },
            "MINIQMT_HOST": {
                "value": "127.0.0.1",
                "description": "MiniQMT服务器地址",
                "required": False,
                "type": "text",
            },
            "MINIQMT_PORT": {
                "value": "58610",
                "description": "MiniQMT服务器端口",
                "required": False,
                "type": "text",
            },
            "EMAIL_ENABLED": {
                "value": "false",
                "description": "启用邮件通知",
                "required": False,
                "type": "boolean",
            },
            "SMTP_SERVER": {
                "value": "",
                "description": "SMTP服务器地址",
                "required": False,
                "type": "text",
            },
            "SMTP_PORT": {
                "value": "587",
                "description": "SMTP服务器端口",
                "required": False,
                "type": "text",
            },
            "EMAIL_FROM": {
                "value": "",
                "description": "发件人邮箱",
                "required": False,
                "type": "text",
            },
            "EMAIL_PASSWORD": {
                "value": "",
                "description": "邮箱授权码",
                "required": False,
                "type": "password",
            },
            "EMAIL_TO": {
                "value": "",
                "description": "收件人邮箱",
                "required": False,
                "type": "text",
            },
            "WEBHOOK_ENABLED": {
                "value": "false",
                "description": "启用Webhook通知",
                "required": False,
                "type": "boolean",
            },
            "WEBHOOK_TYPE": {
                "value": "dingtalk",
                "description": "Webhook类型（dingtalk/feishu）",
                "required": False,
                "type": "select",
                "options": ["dingtalk", "feishu"],
            },
            "WEBHOOK_URL": {
                "value": "",
                "description": "Webhook地址",
                "required": False,
                "type": "text",
            },
            "WEBHOOK_KEYWORD": {
                "value": "aiagents通知",
                "description": "Webhook自定义关键词（钉钉安全验证）",
                "required": False,
                "type": "text",
            },
        }

        self._init_db()
        self._bootstrap_from_env_once()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_file))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS system_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def _parse_env_file(self) -> Dict[str, str]:
        values: Dict[str, str] = {}
        if not self.env_file.exists():
            return values
        try:
            with open(self.env_file, "r", encoding="utf-8") as file:
                for raw in file:
                    line = raw.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    key = key.strip()
                    value = value.strip()
                    if value.startswith('"') and value.endswith('"'):
                        value = value[1:-1]
                    elif value.startswith("'") and value.endswith("'"):
                        value = value[1:-1]
                    values[key] = value
        except Exception as exc:
            print(f"读取.env文件失败: {exc}")
        return values

    @staticmethod
    def _normalize_model_name(model_name: str | None, base_url: str | None) -> str:
        normalized = (model_name or "").strip()
        if not normalized:
            return ""
        base = (base_url or "").lower()
        if "openrouter.ai" in base:
            if normalized.lower() == "deepseek-chat":
                return "deepseek/deepseek-chat"
            if normalized.lower() == "deepseek-reasoner":
                return "deepseek/deepseek-reasoner"
        return normalized

    def _upsert_many(self, values: Dict[str, str]) -> None:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with self._connect() as conn:
            for key, value in values.items():
                conn.execute(
                    """
                    INSERT INTO system_settings(key, value, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        updated_at = excluded.updated_at
                    """,
                    (key, str(value), now),
                )
            conn.commit()

    def _read_db_values(self) -> Dict[str, str]:
        with self._connect() as conn:
            rows = conn.execute("SELECT key, value FROM system_settings").fetchall()
        return {str(row["key"]): str(row["value"]) for row in rows}

    def _bootstrap_from_env_once(self) -> None:
        with self._connect() as conn:
            row = conn.execute("SELECT COUNT(1) AS c FROM system_settings").fetchone()
            count = int(row["c"]) if row else 0
        if count > 0:
            return

        env_values = self._parse_env_file()
        seed: Dict[str, str] = {}
        for key, meta in self.default_config.items():
            seed[key] = str(env_values.get(key, meta["value"]))

        seed["DEFAULT_MODEL_NAME"] = self._normalize_model_name(
            seed.get("DEFAULT_MODEL_NAME"),
            seed.get("AI_API_BASE_URL"),
        ) or "deepseek/deepseek-v3.2"
        self._upsert_many(seed)

    def read_env(self) -> Dict[str, str]:
        """读取配置（兼容旧方法名，实际来源为数据库）。"""
        config = self._read_db_values()
        for key, meta in self.default_config.items():
            if key not in config:
                config[key] = str(meta["value"])
        config["DEFAULT_MODEL_NAME"] = self._normalize_model_name(
            config.get("DEFAULT_MODEL_NAME"),
            config.get("AI_API_BASE_URL"),
        ) or "deepseek/deepseek-v3.2"
        return config

    def write_env(self, config: Dict[str, str]) -> bool:
        """保存配置（兼容旧方法名，实际写入数据库）。"""
        try:
            current = self.read_env()
            merged = {key: current.get(key, str(meta["value"])) for key, meta in self.default_config.items()}
            for key, value in config.items():
                if key in merged:
                    merged[key] = "" if value is None else str(value)

            merged["DEFAULT_MODEL_NAME"] = self._normalize_model_name(
                merged.get("DEFAULT_MODEL_NAME"),
                merged.get("AI_API_BASE_URL"),
            ) or "deepseek/deepseek-v3.2"
            self._upsert_many(merged)
            return True
        except Exception as exc:
            print(f"保存配置失败: {exc}")
            return False

    def get_config_info(self) -> Dict[str, Dict[str, Any]]:
        """获取配置信息（包含描述、类型等）。"""
        current_values = self.read_env()
        config_info: Dict[str, Dict[str, Any]] = {}
        for key, info in self.default_config.items():
            config_info[key] = {
                "value": current_values.get(key, info["value"]),
                "description": info["description"],
                "required": info["required"],
                "type": info["type"],
            }
            if "options" in info:
                config_info[key]["options"] = info["options"]

        model_cfg = config_info.get("DEFAULT_MODEL_NAME")
        if model_cfg is not None:
            model_cfg["type"] = "select"
            try:
                from app import model_config

                model_cfg["options"] = list(model_config.model_options.keys())
            except Exception as exc:
                print(f"加载模型选项失败: {exc}")
                fallback = [model_cfg.get("value") or "deepseek/deepseek-v3.2", "deepseek/deepseek-reasoner"]
                model_cfg["options"] = list(dict.fromkeys([str(item) for item in fallback if item]))
        return config_info

    def validate_config(self, config: Dict[str, str]) -> tuple[bool, str]:
        """验证配置。"""
        for key, info in self.default_config.items():
            if info["required"] and not config.get(key):
                return False, f"必填项 {info['description']} 不能为空"

        api_key = config.get("AI_API_KEY", "")
        if api_key and len(api_key) < 20:
            return False, "AI API Key格式不正确（长度太短）"
        return True, "配置验证通过"

    def reload_config(self):
        """将数据库配置回写到运行时环境并热重载 app.config。"""
        values = self.read_env()
        for key, value in values.items():
            os.environ[key] = "" if value is None else str(value)
        try:
            import app.config as app_config

            importlib.reload(app_config)
        except Exception:
            pass


# 全局配置管理器实例
config_manager = ConfigManager()

