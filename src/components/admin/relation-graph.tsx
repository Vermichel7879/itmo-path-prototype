"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import {
  buildRelationGraphModel,
  filterRelationGraphFocusOptions,
  type RelationEntity,
  type RelationEntityKind,
  type RelationGraphAudience,
  type RelationSnapshot,
} from "./relation-map";

const kindLabels: Record<RelationEntityKind, string> = {
  QUESTION: "Question",
  ANSWER: "Answer",
  MODULE: "Module",
  RECOMMENDATION: "Recommendation",
};

const nodeWidth = 240;
const nodeHeight = 86;

function clampScale(value: number) {
  return Math.min(1.8, Math.max(0.05, value));
}

function audienceOptionLabel(entity: RelationEntity) {
  return `${kindLabels[entity.kind]} · ${entity.stableId} · ${entity.label}`;
}

export function RelationGraph({ snapshot }: { snapshot: RelationSnapshot }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [query, setQuery] = useState("");
  const [audience, setAudience] = useState<RelationGraphAudience>("ALL");
  const [scopeKind, setScopeKind] = useState<"QUESTION" | "MODULE">("QUESTION");
  const [focusKey, setFocusKey] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const [hoveredKey, setHoveredKey] = useState("");
  const [viewport, setViewport] = useState({ x: 20, y: 20, scale: 0.6 });
  const allScopeOptions = useMemo(
    () => filterRelationGraphFocusOptions(snapshot, { kind: scopeKind, audience }),
    [snapshot, scopeKind, audience],
  );
  const focusOptions = useMemo(
    () => filterRelationGraphFocusOptions(snapshot, { kind: scopeKind, audience, query }),
    [snapshot, scopeKind, audience, query],
  );
  const focus = allScopeOptions.find((item) => `${item.kind}:${item.stableId}` === focusKey) ?? allScopeOptions[0] ?? null;
  const selectOptions = focus && !focusOptions.some((item) => item.stableId === focus.stableId)
    ? [focus, ...focusOptions]
    : focusOptions;
  const model = useMemo(
    () => focus
      ? buildRelationGraphModel(snapshot, { audience, focus })
      : { nodes: [], edges: [], width: 1, height: 1 },
    [snapshot, audience, focus],
  );
  const nodeByKey = useMemo(
    () => new Map(model.nodes.map((node) => [node.key, node])),
    [model.nodes],
  );
  const selectedNode = nodeByKey.get(selectedKey) ?? null;
  const selectedEdges = selectedNode
    ? model.edges.filter((edge) => edge.source === selectedNode.key || edge.target === selectedNode.key)
    : [];
  const activeNode = nodeByKey.get(hoveredKey || selectedKey) ?? null;
  const chainKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!activeNode) return keys;
    keys.add(activeNode.key);
    if (activeNode.kind === "QUESTION") {
      model.edges.filter((edge) => edge.kind === "QUESTION_ANSWER" && edge.source === activeNode.key).forEach((edge) => keys.add(edge.target));
      model.edges.filter((edge) => edge.kind === "ANSWER_MODULE" && keys.has(edge.source)).forEach((edge) => keys.add(edge.target));
      model.edges.filter((edge) => edge.kind === "MODULE_RECOMMENDATION" && keys.has(edge.source)).forEach((edge) => keys.add(edge.target));
    } else if (activeNode.kind === "ANSWER") {
      model.edges.filter((edge) => edge.kind === "QUESTION_ANSWER" && edge.target === activeNode.key).forEach((edge) => keys.add(edge.source));
      model.edges.filter((edge) => edge.kind === "ANSWER_MODULE" && edge.source === activeNode.key).forEach((edge) => keys.add(edge.target));
      model.edges.filter((edge) => edge.kind === "MODULE_RECOMMENDATION" && keys.has(edge.source)).forEach((edge) => keys.add(edge.target));
    } else if (activeNode.kind === "MODULE") {
      model.edges.filter((edge) => edge.kind === "ANSWER_MODULE" && edge.target === activeNode.key).forEach((edge) => keys.add(edge.source));
      model.edges.filter((edge) => edge.kind === "QUESTION_ANSWER" && keys.has(edge.target)).forEach((edge) => keys.add(edge.source));
      model.edges.filter((edge) => edge.kind === "MODULE_RECOMMENDATION" && edge.source === activeNode.key).forEach((edge) => keys.add(edge.target));
    } else {
      model.edges.filter((edge) => edge.kind === "MODULE_RECOMMENDATION" && edge.target === activeNode.key).forEach((edge) => keys.add(edge.source));
      model.edges.filter((edge) => edge.kind === "ANSWER_MODULE" && keys.has(edge.target)).forEach((edge) => keys.add(edge.source));
      model.edges.filter((edge) => edge.kind === "QUESTION_ANSWER" && keys.has(edge.target)).forEach((edge) => keys.add(edge.source));
    }
    return keys;
  }, [activeNode, model.edges]);
  const chainEdgeKeys = new Set(
    model.edges
      .filter((edge) => chainKeys.has(edge.source) && chainKeys.has(edge.target))
      .map((edge) => edge.key),
  );

  const fitToView = useCallback(() => {
    const element = viewportRef.current;
    if (!element) return;
    const scale = clampScale(Math.min(
      (element.clientWidth - 32) / model.width,
      (element.clientHeight - 32) / model.height,
    ));
    setViewport({
      scale,
      x: (element.clientWidth - model.width * scale) / 2,
      y: (element.clientHeight - model.height * scale) / 2,
    });
  }, [model.height, model.width]);

  useEffect(() => {
    const frame = requestAnimationFrame(fitToView);
    return () => cancelAnimationFrame(frame);
  }, [fitToView]);

  useEffect(() => {
    if (!focus) {
      setSelectedKey("");
      return;
    }
    setSelectedKey(`${focus.kind}:${focus.stableId}`);
  }, [focus]);

  function beginPan(event: ReactPointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest("[data-graph-node]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
  }

  function pan(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setViewport((current) => ({
      ...current,
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    }));
  }

  function endPan(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function zoom(delta: number) {
    setViewport((current) => ({ ...current, scale: clampScale(current.scale + delta) }));
  }

  function wheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault();
    zoom(event.deltaY < 0 ? 0.08 : -0.08);
  }

  return <div className="admin-graph">
    <div className="admin-graph-scope" role="group" aria-label="Способ исследования графа">
      <button type="button" className={scopeKind === "QUESTION" ? "active" : ""} onClick={() => { setScopeKind("QUESTION"); setFocusKey(""); setQuery(""); }}>По вопросу</button>
      <button type="button" className={scopeKind === "MODULE" ? "active" : ""} onClick={() => { setScopeKind("MODULE"); setFocusKey(""); setQuery(""); }}>По модулю</button>
    </div>
    <div className="admin-graph-controls">
      <label>Поиск {scopeKind === "QUESTION" ? "вопроса" : "модуля"}<input type="search" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Stable ID или текст" /></label>
      <label>Аудитория<select value={audience} onChange={(event) => setAudience(event.currentTarget.value as RelationGraphAudience)}><option value="ALL">ALL</option><option value="MASTER">MASTER</option><option value="BACHELOR">BACHELOR</option></select></label>
      <label>{scopeKind === "QUESTION" ? "Выбранный вопрос" : "Выбранный модуль"}<select value={focus ? `${focus.kind}:${focus.stableId}` : ""} onChange={(event) => setFocusKey(event.currentTarget.value)} disabled={selectOptions.length === 0}><option value="" disabled>{selectOptions.length ? "Выберите сущность" : "Ничего не найдено"}</option>{selectOptions.map((item) => <option key={`${item.kind}:${item.stableId}`} value={`${item.kind}:${item.stableId}`}>{audienceOptionLabel(item)}</option>)}</select></label>
      <div className="admin-graph-zoom" aria-label="Масштаб графа">
        <button type="button" onClick={() => zoom(-0.1)} aria-label="Уменьшить">−</button>
        <output>{Math.round(viewport.scale * 100)}%</output>
        <button type="button" onClick={() => zoom(0.1)} aria-label="Увеличить">+</button>
        <button type="button" onClick={fitToView}>Вписать</button>
      </div>
    </div>
    <div className="admin-graph-summary">
      <span>{model.nodes.length} узлов</span><span>{model.edges.length} связей</span>
      <span>Перетаскивайте фон для навигации, колесо — масштаб</span>
    </div>
    <div className="admin-graph-viewport" ref={viewportRef}>
      {model.nodes.length === 0 ? <p className="admin-graph-empty">По заданным фильтрам ничего не найдено.</p> : null}
      <svg
        aria-label="Граф взаимосвязей анкеты"
        onPointerDown={beginPan}
        onPointerMove={pan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={wheel}
      >
        <defs>
          <marker id="admin-graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" /></marker>
        </defs>
        <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
          {model.edges.map((edge) => {
            const source = nodeByKey.get(edge.source);
            const target = nodeByKey.get(edge.target);
            if (!source || !target) return null;
            const startX = source.x + nodeWidth;
            const startY = source.y + nodeHeight / 2;
            const endX = target.x;
            const endY = target.y + nodeHeight / 2;
            const bend = Math.max(45, (endX - startX) / 2);
            const selected = chainEdgeKeys.has(edge.key);
            return <g key={edge.key} className={selected ? "admin-graph-edge is-selected" : "admin-graph-edge"}>
              <path d={`M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`} markerEnd="url(#admin-graph-arrow)" />
              {edge.label ? <>
                <rect className="admin-graph-edge-badge" x={(startX + endX) / 2 - 36} y={(startY + endY) / 2 - 18} width="72" height="20" rx="10" />
                <text x={(startX + endX) / 2} y={(startY + endY) / 2 - 5}>{edge.label}</text>
              </> : null}
            </g>;
          })}
          {model.nodes.map((node) => {
            const selected = node.key === selectedKey;
            const focused = focus ? node.key === `${focus.kind}:${focus.stableId}` : false;
            const related = chainKeys.has(node.key);
            const dimmed = Boolean(activeNode) && !related;
            return <foreignObject key={node.key} x={node.x} y={node.y} width={nodeWidth} height={nodeHeight}>
              <button
                type="button"
                data-graph-node
                className={`admin-graph-node admin-graph-node--${node.kind.toLocaleLowerCase()}${node.active ? "" : " is-inactive"}${selected ? " is-selected" : ""}${focused ? " is-focus" : ""}${related ? " is-related" : ""}${dimmed ? " is-dimmed" : ""}`}
                onMouseEnter={() => setHoveredKey(node.key)}
                onMouseLeave={() => setHoveredKey("")}
                onFocus={() => setHoveredKey(node.key)}
                onBlur={() => setHoveredKey("")}
                onClick={() => setSelectedKey(node.key)}
              >
                <small>{kindLabels[node.kind]}</small>
                <strong>{node.stableId}</strong>
                <span>{node.label}</span>
                <em>{node.audience} · {node.active ? "active" : "inactive"}</em>
              </button>
            </foreignObject>;
          })}
        </g>
      </svg>
    </div>
    {selectedNode ? <aside className="admin-graph-detail" aria-label="Детали выбранной сущности">
      <div><small>{kindLabels[selectedNode.kind]}</small><h2>{selectedNode.stableId}</h2><p>{selectedNode.label}</p></div>
      <dl><div><dt>Аудитория</dt><dd>{selectedNode.audience}</dd></div><div><dt>Состояние</dt><dd>{selectedNode.active ? "active" : "inactive"}</dd></div>{selectedNode.status ? <div><dt>Статус</dt><dd>{selectedNode.status}</dd></div> : null}<div><dt>Связи</dt><dd>{selectedEdges.length}</dd></div></dl>
      <ul>{selectedEdges.map((edge) => {
        const other = nodeByKey.get(edge.source === selectedNode.key ? edge.target : edge.source);
        return other ? <li key={edge.key}><span>{other.stableId} · {other.label}</span>{edge.label ? <b>{edge.label}</b> : null}</li> : null;
      })}</ul>
    </aside> : null}
  </div>;
}
