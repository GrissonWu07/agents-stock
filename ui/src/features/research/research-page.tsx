import { useEffect, useMemo, useRef, useState } from "react";
import type { ApiClient } from "../../lib/api-client";
import { IconButton } from "../../components/ui/icon-button";
import { PageHeader } from "../../components/ui/page-header";
import { WorkbenchCard } from "../../components/ui/workbench-card";
import { PageEmptyState, PageErrorState, PageLoadingState } from "../../components/ui/page-state";
import { usePageData } from "../../lib/use-page-data";
import { useSelection } from "../../lib/use-selection";

type ResearchPageProps = {
  client?: ApiClient;
};

type ResearchModuleWithInsights = {
  name: string;
  note: string;
  output: string;
  outputDetail: string;
  insights: {
    title: string;
    body: string;
    tone?: "neutral" | "success" | "warning" | "danger" | "accent";
  }[];
  sections: {
    title: string;
    body: string;
  }[];
};

const extractOutputCount = (output: string) => {
  const match = output.match(/(\d+)\s*[只支]?/);
  return match ? Number.parseInt(match[1], 10) : 0;
};

const extractOutputSentiment = (output: string) => {
  const longMatch = output.match(/看多\s*(\d+)\s*\/\s*看空\s*(\d+)/);
  if (longMatch) {
    const bullish = Number.parseInt(longMatch[1], 10);
    const bearish = Number.parseInt(longMatch[2], 10);
    if (!Number.isNaN(bullish) && !Number.isNaN(bearish)) {
      return { bullish, bearish, total: bullish + bearish };
    }
  }
  const bullishMatch = output.match(/看多\s*(\d+)/);
  const bearishMatch = output.match(/看空\s*(\d+)/);
  if (bullishMatch && bearishMatch) {
    const bullish = Number.parseInt(bullishMatch[1], 10);
    const bearish = Number.parseInt(bearishMatch[1], 10);
    return { bullish, bearish, total: bullish + bearish };
  }
  return null;
};

const getOutputScore = (output: string) => {
  const sentiment = extractOutputSentiment(output);
  if (sentiment && sentiment.total > 0) {
    return sentiment.total;
  }
  return extractOutputCount(output);
};

const getOutputTone = (output: string) => {
  if (output.includes("市场判断")) return "warning";
  if (output.includes("股票输出")) return "accent";
  if (output.includes("情报")) return "neutral";
  return "neutral";
};

const normalizeText = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, "")
    .replace(/[#*`]/g, "")
    .toLowerCase();

const isCompositeInsight = (item: { title: string; body: string }) => {
  return (
    item.title.includes("综合研判") ||
    /以下是基于/.test(item.body) ||
    /多维度综合研判/.test(item.body) ||
    /首席策略师综合报告/.test(item.body)
  );
};

const hasStructuredText = (output: string) => {
  const trimmed = output.trim();
  if (!trimmed) return false;
  if (/^\s*(看多|看空)\s*\d+\s*\/\s*(看多|看空)\s*\d+\s*$/.test(trimmed)) return false;
  if (/(股票输出|情报|市场判断)/.test(trimmed)) return false;
  if (/^\s*\d+[^\n\r]*$/.test(trimmed)) return false;
  return trimmed.length >= 18 || trimmed.includes("#") || trimmed.includes("**") || trimmed.includes("---") || trimmed.includes("。");
};

const cleanStructuredText = (value: string) =>
  value
    .replace(/^\s*>\s?/gm, "")
    .replace(/^[\-*]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/`/g, "")
    .trim();

const extractStructuredSections = (note: string) => {
  const lines = note.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const validLines = lines.filter((line) => line !== "---" && line !== "***");
  const sections: Array<{ title: string; body: string }> = [];
  let current: { title: string; body: string } | null = null;
  const intro: string[] = [];

  const finalizeSection = () => {
    if (current && current.body.trim()) {
      sections.push({ ...current, body: cleanStructuredText(current.body) });
    }
    current = null;
  };

  validLines.forEach((line) => {
    const headingMatch = line.match(/^#{1,6}\s*(.+)$/);
    if (headingMatch) {
      if (sections.length === 0 && intro.length > 0) {
        sections.push({ title: "市场要点", body: cleanStructuredText(intro.join("\n")) });
        intro.length = 0;
      }
      finalizeSection();
      current = { title: cleanStructuredText(headingMatch[1]), body: "" };
      return;
    }

    if (!current) {
      intro.push(line);
      return;
    }
    current.body = current.body ? `${current.body}\n${line}` : line;
  });

  if (sections.length === 0 && intro.length > 0) {
    sections.push({ title: "市场要点", body: cleanStructuredText(intro.join("\n")) });
  }
  if (current && (current.body || intro.length === 0)) {
    finalizeSection();
  }

  if (sections.length > 0) {
    return sections.filter((section) => section.title && section.body).slice(0, 12);
  }

  return note
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((segment, index) => ({
      title: `${index + 1}）详细内容`,
      body: cleanStructuredText(segment),
    }));
};

const normalizeComparableText = (value: string) =>
  cleanStructuredText(value)
    .replace(/\s+/g, "")
    .replace(/[：:，,。.!！？?；;、“”"'（）()]/g, "")
    .toLowerCase();

const isInsightDuplicateForModule = (moduleName: string, note: string, insight: { title: string; body: string }) => {
  const normalizedModuleName = normalizeComparableText(moduleName);
  const normalizedInsightTitle = normalizeComparableText(insight.title);
  const normalizedInsightBody = normalizeComparableText(insight.body);
  const normalizedNote = normalizeComparableText(note);

  if (!normalizedInsightBody) return normalizedInsightTitle === normalizedModuleName;
  if (normalizedInsightTitle === "") return false;
  if (normalizedInsightTitle === normalizedModuleName) return true;
  if (normalizedInsightBody && normalizedInsightBody.length <= normalizedInsightTitle.length + 4 && normalizedNote.includes(normalizedInsightTitle))
    return true;
  if (normalizedInsightBody.length >= 80 && normalizedNote.includes(normalizedInsightBody.slice(0, 80))) return true;
  return normalizedNote.includes(normalizedInsightBody);
};

const isAggregateInsight = (item: { title: string; body: string }) => {
  const title = normalizeText(item.title);
  return (
    title.includes("市场洞察") ||
    title.includes("市场判断") ||
    title.includes("综合研判") ||
    title.includes("统一研判") ||
    title.includes("总览") ||
    isCompositeInsight(item)
  );
};

const buildModuleAliases = (moduleName: string) => {
  const normalized = normalizeText(moduleName);
  const aliases = new Set<string>([normalized]);
  if (moduleName.includes("智策")) aliases.add(normalizeText("板块"));
  if (moduleName.includes("智瞰")) aliases.add(normalizeText("龙虎"));
  if (moduleName.includes("新闻")) aliases.add(normalizeText("新闻"), normalizeText("交易"));
  if (moduleName.includes("宏观")) aliases.add(normalizeText("宏观"), normalizeText("周期"));
  if (moduleName.includes("周期")) aliases.add(normalizeText("宏观"), normalizeText("周期"));
  return Array.from(aliases).filter(Boolean);
};

const moduleMatchesInsight = (moduleName: string, insight: { title: string; body: string }) => {
  const normName = normalizeText(moduleName);
  const normTitle = normalizeText(insight.title);
  if (normName === normTitle || normTitle.includes(normName) || normName.includes(normTitle)) {
    return true;
  }

  return buildModuleAliases(moduleName).some((alias) => {
    if (!alias) return false;
    return normTitle === alias || normTitle.includes(alias) || alias.includes(normTitle);
  });
};

const resolveModuleOwner = (insight: { title: string; body: string }, moduleNames: string[]) => {
  const title = insight.title;
  if (/行业映射/.test(title)) {
    return moduleNames.find((name) => normalizeText(name).includes("宏观"));
  }
  if (/交易信号/.test(title)) {
    return moduleNames.find((name) => normalizeText(name).includes("新闻"));
  }

  return moduleNames.find((name) => moduleMatchesInsight(name, insight));
};

export function ResearchPage({ client }: ResearchPageProps) {
  const resource = usePageData("research", client);
  const [search, setSearch] = useState("");
  const [batching, setBatching] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [selectedModuleName, setSelectedModuleName] = useState("");
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const snapshot = resource.data;
  const searchTerm = search.trim();
  const normalizedSearch = searchTerm.toLowerCase();
  const sourceRows = snapshot?.outputTable.rows ?? [];
  const filteredRows = useMemo(
    () =>
      sourceRows.filter((row) => {
        const text = [row.id, row.reason ?? "", ...row.cells, ...(row.badges ?? [])].join(" ").toLowerCase();
        return text.includes(normalizedSearch);
      }),
    [normalizedSearch, sourceRows],
  );
  const maxOutputCount = useMemo(() => {
    if (!snapshot) return 1;
    const values = snapshot.modules.map((item) => getOutputScore(item.output));
    const maxValue = Math.max(...values, 0);
    return maxValue > 0 ? maxValue : 1;
  }, [snapshot]);
  const modulesWithInsights = useMemo<ResearchModuleWithInsights[]>(() => {
    if (!snapshot) return [];
    const outputInsights = snapshot.marketView ?? [];
    const moduleNames = snapshot.modules.map((module) => module.name);
    const seenInsight = new Set<string>();
    const insightBuckets = new Map<string, ResearchModuleWithInsights["insights"]>();

    moduleNames.forEach((name) => {
      insightBuckets.set(name, []);
    });

    outputInsights.forEach((insight) => {
      if (isAggregateInsight(insight) || isCompositeInsight(insight)) {
        return;
      }
      const dedupeKey = `${normalizeText(insight.title)}::${normalizeText(insight.body).slice(0, 80)}`;
      if (seenInsight.has(dedupeKey)) {
        return;
      }
      const owner = resolveModuleOwner(insight, moduleNames);
      if (!owner) {
        return;
      }
      seenInsight.add(dedupeKey);
      insightBuckets.get(owner)?.push({ ...insight, tone: insight.tone ?? "neutral" });
    });

    return snapshot.modules
      .map((module) => {
        const sections = extractStructuredSections(module.note);
        const insights = (insightBuckets.get(module.name) ?? []).filter(
          (insight) => !isInsightDuplicateForModule(module.name, module.note, insight),
        );
        return {
          ...module,
          outputDetail: module.output,
          insights,
          sections,
        };
      })
      .sort((left, right) => getOutputScore(right.output) - getOutputScore(left.output));
  }, [snapshot]);
  const selectedModule = useMemo(() => {
    if (!modulesWithInsights.length) return undefined;
    const hit = modulesWithInsights.find((module) => module.name === selectedModuleName);
    return hit ?? modulesWithInsights[0];
  }, [modulesWithInsights, selectedModuleName]);
  const rowIds = useMemo(() => filteredRows.map((row) => row.id), [filteredRows]);
  const selection = useSelection(rowIds);
  const selectedRows = filteredRows.filter((row) => selection.isSelected(row.id));
  const selectedCodes = selectedRows.map((row) => row.id);
  const canBatchWatchlist = selectedCodes.length > 0;
  const selectedPreview = selectedRows.slice(0, 3);
  const selectedPreviewLabel =
    selection.selectedCount > 0
      ? `${selection.selectedCount} 只股票已选中，支持直接批量加入我的关注。`
      : "先勾选股票输出，再统一加入我的关注池。";
  const outputEmptyLabel = normalizedSearch
    ? `未找到匹配“${searchTerm}”的股票输出`
    : snapshot?.outputTable.emptyLabel ?? "暂无股票输出";
  const outputEmptyMessage =
    normalizedSearch && snapshot
      ? "可以尝试输入代码、名称、来源模块或后续动作重新筛选。"
      : snapshot?.outputTable.emptyMessage;

  const derivedMetrics = snapshot
    ? [
        { label: "情报模块", value: String(snapshot.modules.length) },
        { label: "股票输出", value: String(snapshot.outputTable.rows.length) },
        { label: "市场判断", value: String(snapshot.marketView.length) },
        { label: "最近更新", value: snapshot.updatedAt || "--" },
      ]
    : [];

  const handleBatchWatchlist = async () => {
    if (!canBatchWatchlist || batching) return;
    setBatching(true);
    try {
      await resource.runAction("batch-watchlist", { codes: selectedCodes });
      selection.clear();
    } finally {
      setBatching(false);
    }
  };

  const handleSingleWatchlist = (code: string) => {
    void resource.runAction("item-watchlist", { code });
  };

  const handleRunModule = async (moduleName?: string) => {
    if (isRegenerating) return;
    setIsRegenerating(true);
    try {
      if (moduleName) {
        await resource.runAction("run-module", { module: moduleName });
      } else {
        await resource.runAction("run-module");
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selection.someSelected;
    }
  }, [selection.someSelected]);

  if (resource.status === "loading" && !snapshot) {
    return <PageLoadingState title="研究情报加载中" description="正在读取板块、龙虎榜、新闻和宏观判断。" />;
  }

  if (resource.status === "error" && !snapshot) {
    return (
      <PageErrorState
        title="研究情报加载失败"
        description={resource.error ?? "无法加载研究情报数据，请稍后重试。"}
        actionLabel="重新加载"
        onAction={resource.refresh}
      />
    );
  }

  if (!snapshot) {
    return <PageEmptyState title="研究情报暂无数据" description="后台尚未返回研究情报快照。" actionLabel="刷新" onAction={resource.refresh} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Research"
        title="研究情报"
        description="把智策板块、智瞰龙虎、新闻流量、宏观分析和宏观周期统一收在一个聚合页里。有股票输出时再加入我的关注。"
        actions={
          <>
          <button className="button button--secondary" type="button" onClick={() => void handleRunModule()} disabled={isRegenerating}>
            {isRegenerating ? "重新生成中..." : "重新生成"}
          </button>
            <button className="button button--primary" type="button" onClick={() => void handleBatchWatchlist()} disabled={!canBatchWatchlist || batching}>
              批量加入关注池
            </button>
          </>
        }
      />
      <div className="stack">
        <div className="metric-grid">
          {derivedMetrics.map((metric) => (
            <WorkbenchCard className="metric-card" key={metric.label}>
              <div className="metric-card__label">{metric.label}</div>
              <div className="metric-card__value">{metric.value}</div>
            </WorkbenchCard>
          ))}
        </div>

        <WorkbenchCard>
          <h2 className="section-card__title">模块分析</h2>
          <p className="section-card__description">{snapshot.summary.title}</p>
          <div className="research-module-layout">
            <aside className="research-module-list" aria-label="研究情报模块列表">
              {modulesWithInsights.map((module) => {
                const isActive = module.name === selectedModule?.name;
                return (
                  <button
                    key={module.name}
                    className={`research-module-list__item ${isActive ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setSelectedModuleName(module.name)}
                  >
                    <div className="research-module-list__title">{module.name}</div>
                    <div className="research-module-list__output">{module.output}</div>
                  </button>
                );
              })}
            </aside>
            <section className="research-module-detail">
              {selectedModule ? (
                <div className="research-module-card research-module-card--detail">
                  <div className="research-module-card__output">
                    <div className="research-module-card__output-meta">
                      <span>产出可视化</span>
                      <span>{selectedModule.output}</span>
                    </div>
                    <div className="research-module-card__meter-track">
                      {(() => {
                        const sentiment = extractOutputSentiment(selectedModule.output);
                        if (sentiment) {
                          const normalizer = Math.max(maxOutputCount, sentiment.total, 1);
                          const bullishRate = Math.max(4, Math.round((sentiment.bullish / normalizer) * 100));
                          const bearishRate = Math.max(4, Math.round((sentiment.bearish / normalizer) * 100));
                          const neutralRate = Math.max(0, 100 - bullishRate - bearishRate);
                          return (
                            <>
                              <div
                                className="research-module-card__meter-fill research-module-card__meter-fill--accent"
                                style={{ width: `${Math.min(100, bullishRate)}%` }}
                                title={`看多 ${sentiment.bullish}`}
                              />
                              <div
                                className="research-module-card__meter-track-separator"
                                style={{ width: `${neutralRate}px` }}
                              />
                              <div
                                className="research-module-card__meter-fill research-module-card__meter-fill--muted"
                                style={{ width: `${Math.min(100, bearishRate)}%` }}
                                title={`看空 ${sentiment.bearish}`}
                              />
                            </>
                          );
                        }

                        const ratio = Math.max(
                          6,
                          Math.round((extractOutputCount(selectedModule.output) / maxOutputCount) * 100),
                        );
                        return <div className="research-module-card__meter-fill" style={{ width: `${ratio}%` }} />;
                      })()}
                    </div>
                  </div>
                  <div className="research-module-card__divider" />
                  <div className="research-module-card__header">
                    <div>
                      <h3 className="research-module-card__name">{selectedModule.name}</h3>
                      <div className="research-module-card__note">
                        {selectedModule.sections.length > 0 ? "完整研判已展开，下方查看各主题细节。" : selectedModule.note}
                      </div>
                    </div>
                    <span className={`badge badge--${getOutputTone(selectedModule.output)}`}>{selectedModule.output}</span>
                  </div>
                  <div className="research-module-card__divider" />
                  <div className="research-module-card__insight-title">完整详情</div>
                  {selectedModule.sections.length > 0 ? (
                    <div className="research-module-card__insight-list">
                      {selectedModule.sections.map((section, index) => (
                        <div className="research-module-card__insight-item" key={`${section.title}-${index}`}>
                          <div className="research-module-card__insight-item-title">{section.title}</div>
                          <div className="research-module-card__insight-item-body">{section.body}</div>
                        </div>
                      ))}
                    </div>
                  ) : selectedModule.note && hasStructuredText(selectedModule.note) ? (
                    <div className="research-module-card__detail-body">{selectedModule.note}</div>
                  ) : selectedModule.note ? (
                    <p className="research-module-card__empty-note">{selectedModule.note}</p>
                  ) : selectedModule.outputDetail ? (
                    <p className="research-module-card__empty-note">{selectedModule.outputDetail}</p>
                  ) : (
                    <p className="research-module-card__empty-note">该模块暂无结构化细节，持续刷新后会自动补齐。</p>
                  )}
                  {selectedModule.insights.length > 0 ? (
                    <>
                      <div className="research-module-card__divider" />
                      <div className="research-module-card__insight-title">补充洞察</div>
                      <div className="research-module-card__insight-list">
                        {selectedModule.insights.map((insight, index) => (
                          <div className="research-module-card__insight-item" key={`${insight.title}-${index}`}>
                            <div className="research-module-card__insight-item-title">{insight.title}</div>
                            <div className="research-module-card__insight-item-body">{insight.body}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>
          </div>
        </WorkbenchCard>

        <WorkbenchCard>
          <h2 className="section-card__title">研究结论</h2>
          <p className="section-card__description">{snapshot.summary.body}</p>
          <div className="summary-list">
            <div className="summary-item">
              <div className="summary-item__title">结论摘要</div>
              <div className="summary-item__body">{snapshot.summary.title}</div>
            </div>
          </div>
        </WorkbenchCard>

        <WorkbenchCard>
          <div className="toolbar">
            <div>
              <h2 className="section-card__title" style={{ margin: 0 }}>
                股票输出
              </h2>
              <p className="table__caption" style={{ marginBottom: 0 }}>
                只有研究模块明确输出股票时，才会出现加入我的关注的操作。
              </p>
            </div>
            <span className="toolbar__spacer" />
            <label className="field" style={{ minWidth: "260px" }}>
              <span className="field__label">搜索输出</span>
              <input
                className="input"
                placeholder="输入代码、名称、来源或原因"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <span className="badge badge--neutral">输出 {filteredRows.length} 只</span>
            <span className="badge badge--accent">已选 {selection.selectedCount} 只</span>
          </div>
          <div className="toolbar" style={{ marginTop: "10px" }}>
            <IconButton
              icon="↻"
              label={isRegenerating ? "刷新中" : "刷新研究情报"}
              tone="neutral"
              disabled={isRegenerating}
              onClick={() => void handleRunModule(selectedModule?.name)}
            />
            <IconButton
              icon="⭐"
              label="批量加入关注池"
              tone="accent"
              onClick={() => void handleBatchWatchlist()}
              disabled={!canBatchWatchlist || batching}
            />
            <IconButton icon="✕" label="清空选择" tone="neutral" onClick={selection.clear} />
            <span className="toolbar__status">已选 {selection.selectedCount} 只股票</span>
          </div>
          <div className="table-shell">
            <table className="table">
              <thead>
                <tr>
                  <th className="table__checkbox-cell">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label="全选当前研究输出"
                      checked={selection.allSelected}
                      onChange={selection.toggleAll}
                    />
                  </th>
                  {snapshot.outputTable.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  <th className="table__actions-head">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td className="table__empty" colSpan={snapshot.outputTable.columns.length + 2}>
                      <div className="summary-item">
                        <div className="summary-item__title">{outputEmptyLabel}</div>
                        {outputEmptyMessage ? <div className="summary-item__body">{outputEmptyMessage}</div> : null}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id} className={selection.isSelected(row.id) ? "table__row--selected" : undefined}>
                      <td className="table__checkbox-cell">
                        <input
                          type="checkbox"
                          aria-label={`选择 ${row.cells[1] ?? row.id}`}
                          checked={selection.isSelected(row.id)}
                          onChange={() => selection.toggle(row.id)}
                        />
                      </td>
                      {row.cells.map((cell, index) => (
                        <td key={`${row.id}-${index}`} className={index === 0 ? "table__cell-strong" : undefined}>
                          {cell}
                        </td>
                      ))}
                      <td>
                        <div className="table__actions">
                          <button className="button button--secondary" type="button" onClick={() => handleSingleWatchlist(row.id)}>
                            <span aria-hidden="true">{row.actions?.[0]?.icon ?? "⭐"}</span>
                            <span>{row.actions?.[0]?.label ?? "加入关注池"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </WorkbenchCard>

        <WorkbenchCard>
          <h2 className="section-card__title">最近结果摘要</h2>
          <p className="section-card__description">{snapshot.summary.body}</p>
          <div className="summary-list">
            <div className="summary-item">
              <div className="summary-item__title">{snapshot.summary.title}</div>
              <div className="summary-item__body">快照更新时间：{snapshot.updatedAt}</div>
            </div>
          </div>
          <div className="chip-row">
            {snapshot.modules.map((module) => (
              <span className="badge badge--neutral" key={module.name}>
                {module.name} · {module.output}
              </span>
            ))}
          </div>
          <div className="card-divider" />
          <div className="summary-list">
            <div className="summary-item">
              <div className="summary-item__title">当前选择与回写</div>
              <div className="summary-item__body">
                {selectedRows.length > 0 ? selectedPreviewLabel : "研究模块默认展示市场判断，只有明确股票输出时才允许加入我的关注。"}
              </div>
              {selectedPreview.length > 0 ? (
                <div className="chip-row" style={{ marginTop: "10px" }}>
                  {selectedPreview.map((row) => (
                    <span className="badge badge--neutral" key={row.id}>
                      {row.cells[1] ?? row.id} · {row.cells[2] ?? row.source ?? "来源未标注"}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </WorkbenchCard>
      </div>
    </div>
  );
}
