from app.db.runtime.legacy_dbapi import translate_legacy_sqlite_sql_for_mysql


def test_translate_pragma_table_info_to_information_schema():
    sql, params = translate_legacy_sqlite_sql_for_mysql("PRAGMA table_info(flow_snapshots)", ())

    assert "information_schema.columns" in sql.lower()
    assert params == ("flow_snapshots",)


def test_translate_insert_or_replace_and_qmark_placeholders():
    sql, params = translate_legacy_sqlite_sql_for_mysql(
        "INSERT OR REPLACE INTO alert_config (config_key, config_value, description, updated_at) VALUES (?, ?, ?, ?)",
        ("key", "value", "desc", "2026-05-07 12:00:00"),
    )

    assert sql.startswith("REPLACE INTO alert_config")
    assert sql.count("%s") == 4
    assert params == ("key", "value", "desc", "2026-05-07 12:00:00")


def test_translate_on_conflict_upsert_to_on_duplicate_key_update():
    sql, _ = translate_legacy_sqlite_sql_for_mysql(
        """
        INSERT INTO system_settings(key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        """,
        ("AI_API_KEY", "secret", "2026-05-07 12:00:00"),
    )

    normalized = " ".join(sql.split())
    assert "ON DUPLICATE KEY UPDATE" in normalized
    assert "value = VALUES(value)" in normalized
    assert "updated_at = VALUES(updated_at)" in normalized


def test_translate_create_table_autoincrement_and_timestamp_defaults():
    sql, _ = translate_legacy_sqlite_sql_for_mysql(
        """
        CREATE TABLE IF NOT EXISTS sample (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
        )
        """,
        (),
    )

    normalized = " ".join(sql.split())
    assert "AUTO_INCREMENT" in normalized
    assert "created_at DATETIME DEFAULT CURRENT_TIMESTAMP" in normalized
    assert "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP" in normalized


def test_translate_sqlite_datetime_modifiers_to_mysql_equivalents():
    sql, params = translate_legacy_sqlite_sql_for_mysql(
        """
        SELECT COUNT(*) FROM real_monitor_notifications
        WHERE stock_id = ? AND type = ?
        AND datetime(triggered_at) > datetime('now', '-' || ? || ' minutes')
        """,
        (1, "entry", 60),
    )

    normalized = " ".join(sql.split())
    assert "DATE_SUB(NOW(), INTERVAL %s MINUTE)" in normalized
    assert "datetime(" not in normalized.lower()
    assert params == (1, "entry", 60)


def test_translate_nested_sqlite_datetime_window_expression():
    sql, params = translate_legacy_sqlite_sql_for_mysql(
        """
        SELECT *
        FROM analysis_records
        WHERE datetime(COALESCE(data_as_of, created_at, analysis_date)) <= datetime(?)
          AND datetime(COALESCE(valid_until, datetime(COALESCE(data_as_of, created_at, analysis_date), '+48 hours'))) >= datetime(?)
          AND datetime(COALESCE(created_at, analysis_date)) >= datetime(?)
        """,
        ("2026-05-07 12:00:00", "2026-05-07 12:00:00", "2026-05-05 12:00:00"),
    )

    normalized = " ".join(sql.split())
    assert "DATE_ADD(COALESCE(data_as_of, created_at, analysis_date), INTERVAL 48 HOUR)" in normalized
    assert "datetime(" not in normalized.lower()
    assert params == (
        "2026-05-07 12:00:00",
        "2026-05-07 12:00:00",
        "2026-05-05 12:00:00",
    )
