import { useEffect, useMemo, useState, type ReactElement } from "react";
import type { ApiClient } from "../../lib/api-client";
import { PageHeader } from "../../components/ui/page-header";
import { SectionEmptyState } from "../../components/ui/section-empty";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../../components/ui/page-state";
import { usePageData } from "../../lib/use-page-data";
import type { ConfigSettingItem } from "../../lib/page-models";

type SettingsPageProps = {
  client?: ApiClient;
};

const VALUE_HINT = "当前值";

type EditableConfigField = ConfigSettingItem & {
  key: string;
  value: string;
};

const parseValue = (item: ConfigSettingItem): string => {
  if (typeof item.value === "string") {
    return item.value;
  }

  if (!item.body) {
    return "";
  }

  const marker = `${VALUE_HINT}:`;
  const markerIndex = item.body.lastIndexOf(marker);
  if (markerIndex < 0) {
    return "";
  }

  return item.body.slice(markerIndex + marker.length).trim();
};

const normalizeField = (item: ConfigSettingItem, index: number): EditableConfigField => ({
  ...item,
  key: item.key?.trim() || `setting-${index}`,
  value: parseValue(item),
});

const toInputType = (field: EditableConfigField): "text" | "password" | "number" => {
  const t = `${field.type ?? "text"}`;
  if (t === "password") return "password";
  if (t === "number") return "number";
  if (t === "boolean") return "text";
  return "text";
};

const toBooleanOptions = (value: string) => {
  const normalized = value.toLowerCase();
  if (normalized === "true") return "true";
  if (normalized === "1") return "true";
  return "false";
};

const renderFieldControl = (
  field: EditableConfigField,
  id: string,
  value: string,
  onChange: (next: string) => void,
): ReactElement => {
  const inputType = toInputType(field);
  const isModelField = field.key === "DEFAULT_MODEL_NAME";
  const hasOptions = field.type === "select" || isModelField;
  const selectOptions = hasOptions && Array.isArray(field.options) ? field.options.slice() : [];
  const selectOptionsWithFallback = hasOptions && selectOptions.length > 0 ? selectOptions : [value];

  if (field.type === "boolean") {
    return (
      <select
        className="input"
        id={id}
        value={toBooleanOptions(value)}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    );
  }

  if (hasOptions) {
    const options = selectOptionsWithFallback;
    return (
      <select
        className="input"
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return <input className="input" id={id} type={inputType} value={value} onChange={(event) => onChange(event.target.value)} />;
};

const renderSection = (
  sectionTitle: string,
  items: EditableConfigField[],
  values: Record<string, string>,
  onChange: (key: string, value: string) => void,
): ReactElement => {
  if (items.length === 0) {
    return <SectionEmptyState title={`${sectionTitle}暂无数据`} description={`当前没有${sectionTitle}配置。`} />;
  }

  return (
    <div className="summary-list">
      {items.map((item) => {
        const fieldValue = values[item.key] ?? "";
        return (
          <div className="summary-item" key={item.key}>
            <div className="summary-item__title">{item.title}</div>
            <div className="summary-item__body">{item.body}</div>
            <div className="field">
              <label className="field__label" htmlFor={`setting-${item.key}`}>
                配置值
              </label>
              <div>
                {renderFieldControl(item, `setting-${item.key}`, fieldValue, (next) => onChange(item.key, next))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export function SettingsPage({ client }: SettingsPageProps) {
  const resource = usePageData("settings", client);
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});

  const dataSources = useMemo(
    () => (resource.data?.dataSources ?? []).map((item, index) => normalizeField(item, index)),
    [resource.data?.dataSources],
  );

  const modelConfig = useMemo(
    () => (resource.data?.modelConfig ?? []).map((item, index) => normalizeField(item, index + (resource.data?.dataSources?.length ?? 0))),
    [resource.data?.dataSources?.length, resource.data?.modelConfig],
  );

  const runtimeParams = useMemo(
    () =>
      (resource.data?.runtimeParams ?? []).map(
        (item, index) => normalizeField(item, index + (resource.data?.dataSources?.length ?? 0) + (resource.data?.modelConfig?.length ?? 0)),
      ),
    [resource.data?.dataSources?.length, resource.data?.modelConfig?.length, resource.data?.runtimeParams],
  );

  useEffect(() => {
    const nextValues = [...dataSources, ...modelConfig, ...runtimeParams].reduce(
      (acc, item) => ({
        ...acc,
        [item.key]: item.value,
      }),
      {} as Record<string, string>,
    );

    setValues((prev) => {
      const changed = JSON.stringify(prev) !== JSON.stringify(nextValues);
      return changed ? nextValues : prev;
    });

    setSavedValues(nextValues);
  }, [dataSources, modelConfig, runtimeParams]);

  const dirty = useMemo(() => {
    const current = values;
    const saved = savedValues;
    const allKeys = new Set([...Object.keys(current), ...Object.keys(saved)]);

    for (const key of allKeys) {
      if ((current[key] ?? "") !== (saved[key] ?? "")) {
        return true;
      }
    }

    return false;
  }, [savedValues, values]);

  if (resource.status === "loading" && !resource.data) {
    return <PageLoadingState title="环境配置加载中" description="正在读取数据源和运行参数。" />;
  }

  if (resource.status === "error" && !resource.data) {
    return (
      <PageErrorState
        title="环境配置加载失败"
        description={resource.error ?? "无法加载环境配置数据，请稍后重试。"}
        actionLabel="重新加载"
        onAction={resource.refresh}
      />
    );
  }

  const snapshot = resource.data;
  if (!snapshot) {
    return <PageEmptyState title="环境配置暂无数据" description="后台尚未返回环境配置信息。" actionLabel="刷新" onAction={resource.refresh} />;
  }

  const submit = () => {
    void resource.runAction(
      "save",
      Object.fromEntries([...dataSources, ...modelConfig, ...runtimeParams].map((item) => [item.key, values[item.key] ?? item.value])),
    );
  };

  const onChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="环境配置"
        description="数据源、模型配置和运行参数统一在这个页面管理。"
      />

      <div className="stack">
        <div className="toolbar">
          <span className="toolbar__spacer" />
          <button className="button button--secondary" type="button" onClick={resource.refresh}>
            刷新配置
          </button>
          <button
            className="button button--primary"
            type="button"
            disabled={!dirty}
            onClick={submit}
          >
            保存配置
          </button>
        </div>

        <div className="section-grid">
          <WorkbenchCard>
            <h2 className="section-card__title">模型配置</h2>
            {renderSection("模型配置", modelConfig, values, onChange)}
          </WorkbenchCard>

          <WorkbenchCard>
            <h2 className="section-card__title">数据源</h2>
            {renderSection("数据源", dataSources, values, onChange)}
          </WorkbenchCard>

          <WorkbenchCard className="section-grid__full">
            <h2 className="section-card__title">运行参数</h2>
            {renderSection("运行参数", runtimeParams, values, onChange)}
          </WorkbenchCard>
        </div>
      </div>
    </div>
  );
}

