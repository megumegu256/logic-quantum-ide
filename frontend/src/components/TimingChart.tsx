// TimingChart.tsx
// Quantum IDE — SVGタイミングチャート + dnd-kitによる行並び替え

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Play, Trash2, Loader2, SkipForward, RotateCcw, Pause } from 'lucide-react';
import useCircuitStore from '../store/useCircuitStore';
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ============================================================
// レイアウト定数
// ============================================================
const LABEL_W  = 88;
const STEP_W   = 28;
const ROW_H    = 54;
const WAVE_PAD = 10;
const WAVE_H   = ROW_H - WAVE_PAD * 2;
const Y_HIGH   = WAVE_PAD;
const Y_LOW    = WAVE_PAD + WAVE_H;

// ============================================================
// 矩形波ポイント計算
// ============================================================
function buildPolylinePoints(history: number[], rowTop: number): string {
  if (history.length === 0) return '';
  const highY = rowTop + Y_HIGH;
  const lowY  = rowTop + Y_LOW;
  const pts: string[] = [];

  history.forEach((val, i) => {
    const curY = val === 1 ? highY : lowY;
    const xL   = LABEL_W + i * STEP_W;
    const xR   = LABEL_W + (i + 1) * STEP_W;

    if (i === 0) {
      pts.push(`${xL},${curY}`);
    } else {
      const prevY = history[i - 1] === 1 ? highY : lowY;
      if (prevY !== curY) {
        pts.push(`${xL},${prevY}`);
        pts.push(`${xL},${curY}`);
      }
    }
    pts.push(`${xR},${curY}`);
  });

  return pts.join(' ');
}

// ============================================================
// 空状態
// ============================================================
const EmptyState: React.FC = () => (
  <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', opacity:0.3, gap:'8px' }}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <polyline points="0,12 4,12 4,4 8,4 8,12 12,12 12,6 16,6"
        stroke="#5b8df6" strokeWidth="1.5" fill="none" />
    </svg>
    <span style={{ fontSize:'11px', fontFamily:'var(--font-mono)', color:'var(--color-text-muted)' }}>
      ゲートを配置して「▶ チャート生成」を押してください
    </span>
  </div>
);

// ============================================================
// コントロールバー（Run / Clear + Steps 入力）
// ============================================================
const ControlBar: React.FC<{
  steps: number;
  onStepsChange: (v: number) => void;
  onRun: () => void;
  onStep: () => void;
  onPlayToggle: () => void;
  isPlaying: boolean;
  onReset: () => void;
  onClear: () => void;
  isSimulating: boolean;
  hasNodes: boolean;
  clockStep: number;
}> = ({ steps, onStepsChange, onRun, onStep, onPlayToggle, isPlaying, onReset, onClear, isSimulating, hasNodes, clockStep }) => {
  const btnBase: React.CSSProperties = {
    display:'flex', alignItems:'center', gap:'5px',
    padding:'3px 10px', height:'26px',
    fontSize:'11px', fontWeight:600,
    borderRadius:'6px', border:'1px solid',
    cursor: hasNodes && !isSimulating ? 'pointer' : 'not-allowed',
    opacity: hasNodes && !isSimulating ? 1 : 0.45,
    transition:'all 0.15s', whiteSpace:'nowrap',
  };

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'0 10px', height:'36px', flexShrink:0,
      borderBottom:'1px solid var(--color-border)', backgroundColor:'var(--color-bg-console)' }}>

      <label style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'10px', color:'var(--color-text-muted)', fontFamily:'var(--font-mono)', whiteSpace:'nowrap' }}>
        ステップ数:
        <input type="number" value={steps} min={1} max={64}
          onChange={(e) => onStepsChange(Math.max(1, Math.min(64, parseInt(e.target.value,10)||10)))}
          style={{ width:'42px', padding:'2px 5px', fontSize:'11px', fontFamily:'var(--font-mono)', fontWeight:600,
            color:'#7eb3fa', backgroundColor:'rgba(91,141,246,0.12)', border:'1px solid rgba(91,141,246,0.35)',
            borderRadius:'4px', outline:'none', textAlign:'center' }} />
      </label>

      <span style={{ fontSize:'10px', fontFamily:'var(--font-mono)', color:'var(--color-text-muted)', whiteSpace:'nowrap' }}>
        T={clockStep}
      </span>

      <button onClick={() => hasNodes && !isSimulating && onRun()} disabled={!hasNodes || isSimulating}
        style={{ ...btnBase, color:'#22d3a0', backgroundColor:'rgba(34,211,160,0.10)', borderColor:'rgba(34,211,160,0.4)' }}
        onMouseEnter={e => { if(hasNodes&&!isSimulating)(e.currentTarget as HTMLElement).style.backgroundColor='rgba(34,211,160,0.22)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor='rgba(34,211,160,0.10)'; }}
        title="現在の回路を指定ステップ分シミュレート">
        {isSimulating ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : <Play size={12} />}
        {isSimulating ? '計算中...' : '▶ 生成'}
      </button>

      <button onClick={() => hasNodes && !isSimulating && onStep()} disabled={!hasNodes || isSimulating || isPlaying}
        style={{ ...btnBase, color:'#7eb3fa', backgroundColor:'rgba(91,141,246,0.10)', borderColor:'rgba(91,141,246,0.35)' }}
        onMouseEnter={e => { if(hasNodes&&!isSimulating&&!isPlaying)(e.currentTarget as HTMLElement).style.backgroundColor='rgba(91,141,246,0.22)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor='rgba(91,141,246,0.10)'; }}
        title="タイミングチャートを1ステップ分だけ進める">
        <SkipForward size={12} />⏭ +1
      </button>

      <button onClick={() => hasNodes && onPlayToggle()} disabled={!hasNodes}
        style={{ ...btnBase, color: isPlaying ? '#f87171' : '#a855f7', backgroundColor: isPlaying ? 'rgba(248,113,113,0.10)' : 'rgba(168,85,247,0.10)', borderColor: isPlaying ? 'rgba(248,113,113,0.4)' : 'rgba(168,85,247,0.4)' }}
        onMouseEnter={e => { if(hasNodes)(e.currentTarget as HTMLElement).style.backgroundColor=isPlaying ? 'rgba(248,113,113,0.22)' : 'rgba(168,85,247,0.22)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor=isPlaying ? 'rgba(248,113,113,0.10)' : 'rgba(168,85,247,0.10)'; }}
        title="1ステップ実行を自動的に繰り返す">
        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
        {isPlaying ? '停止' : '▶ 連続実行'}
      </button>

      <button onClick={onReset}
        style={{ ...btnBase, color:'#fb923c', backgroundColor:'rgba(251,146,60,0.08)', borderColor:'rgba(251,146,60,0.35)', opacity:1, cursor:'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor='rgba(251,146,60,0.20)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor='rgba(251,146,60,0.08)'; }}
        title="波形とクロックをすべてリセット">
        <RotateCcw size={12} />リセット
      </button>

      <button onClick={onClear}
        style={{ ...btnBase, color:'#f87171', backgroundColor:'rgba(248,113,113,0.08)', borderColor:'rgba(248,113,113,0.35)', opacity:1, cursor:'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor='rgba(248,113,113,0.20)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor='rgba(248,113,113,0.08)'; }}
        title="タイミングチャートの表示のみクリア">
        <Trash2 size={12} />クリア
      </button>
    </div>
  );
};

// ============================================================
// ソート可能な行コンポーネント (dnd-kit)
// ============================================================
const SortableChartRow = ({ 
  nodeId, 
  history, 
  svgWidth, 
  gridXs, 
  labelMap, 
  gateTypeMap 
}: { 
  nodeId: string, 
  history: number[], 
  svgWidth: number, 
  gridXs: number[], 
  labelMap: Record<string, string>, 
  gateTypeMap: Record<string, string> 
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: nodeId });
  
  const QUANTUM_GATES = new Set(['H','X','Y','Z','S','T','CX','CCX','Measure']);
  const midY      = ROW_H / 2;
  const label     = labelMap[nodeId] ?? nodeId.slice(0, 8);
  const isQuantum = QUANTUM_GATES.has(gateTypeMap[nodeId] ?? '');
  const waveColor  = isQuantum ? '#a855f7' : '#22d3a0';
  const labelColor = isQuantum ? '#c084fc' : '#5eead4';
  const lastVal    = history[history.length - 1] ?? 0;
  
  const isBus = gateTypeMap[nodeId] === 'SevenSeg';

  // 個別の行の高さでのポリライン（rowTop = 0）
  const polyPts    = !isBus ? buildPolylinePoints(history, 0) : '';

  const renderBus = () => {
    if (history.length === 0 || !isBus) return null;
    const elements = [];
    let currentVal = history[0];
    let startIdx = 0;

    const addBusElement = (val: number, start: number, end: number) => {
      const x1 = LABEL_W + start * STEP_W;
      const x2 = LABEL_W + end * STEP_W;
      const hexStr = val.toString(16).toUpperCase();
      const padL = start === 0 ? 0 : 4;
      const padR = end === history.length ? 0 : 4;
      
      const ptsStr = `
        ${x1+padL},${Y_HIGH} 
        ${x2-padR},${Y_HIGH} 
        ${end === history.length ? `${x2},${Y_HIGH} ${x2},${Y_LOW}` : `${x2},${midY}`} 
        ${x2-padR},${Y_LOW} 
        ${x1+padL},${Y_LOW} 
        ${start === 0 ? `${x1},${Y_LOW} ${x1},${Y_HIGH}` : `${x1},${midY}`}
      `;

      elements.push(
        <g key={`bus-${start}`}>
          <polygon points={ptsStr} fill={waveColor} fillOpacity="0.1" stroke={waveColor} strokeWidth="1.5" />
          <text x={(x1+x2)/2} y={midY+1} fontSize="11" fontWeight="700" fill={labelColor} textAnchor="middle" dominantBaseline="middle" style={{ userSelect:'none' }}>
            {hexStr}
          </text>
        </g>
      );
    };

    for (let i = 1; i <= history.length; i++) {
      if (i === history.length || history[i] !== currentVal) {
        addBusElement(currentVal, startIdx, i);
        if (i < history.length) {
          currentVal = history[i];
          startIdx = i;
        }
      }
    }
    return elements;
  };

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: 'relative' as const,
    cursor: isDragging ? 'grabbing' : 'grab',
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <svg width={svgWidth} height={ROW_H} style={{ display: 'block', fontFamily: 'var(--font-mono)' }}>
        {/* 垂直グリッド線 */}
        {gridXs.map((x, i) => (
          <line key={`g${i}`} x1={x} y1={0} x2={x} y2={ROW_H} stroke="#1e2235" strokeWidth="1" />
        ))}

        <g>
          {/* 行区切り */}
          <line x1={0} y1={ROW_H-1} x2={svgWidth} y2={ROW_H-1} stroke="#1a1d2e" strokeWidth="1" />

          {/* ラベル背景 */}
          <rect x={0} y={0} width={LABEL_W-8} height={ROW_H-1} fill="var(--color-bg-panel)" />

          {/* ラベルテキスト */}
          <text x={8} y={midY+1} fontSize="11" fontWeight="600"
            fill={labelColor} dominantBaseline="middle" style={{ userSelect:'none' }}>
            {label.length > 7 ? label.slice(0,7)+'…' : label}
          </text>

          {/* High/Low インジケーター (Busの場合は円を非表示にしてもよいが一旦色だけ変える) */}
          <circle cx={LABEL_W-12} cy={midY} r={4}
            fill={isBus ? waveColor : (lastVal===1 ? waveColor : '#3a3f6e')}
            style={{ filter: (isBus || lastVal===1) ? `drop-shadow(0 0 4px ${waveColor})` : 'none', transition:'fill 0.2s' }} />

          {/* High 基準点線 */}
          {!isBus && <line x1={LABEL_W} y1={Y_HIGH} x2={svgWidth} y2={Y_HIGH}
            stroke="#1e2235" strokeWidth="1" strokeDasharray="4,4" />}

          {/* バス描画 */}
          {isBus && renderBus()}

          {/* 波形ポリライン (非Bus時のみ) */}
          {!isBus && polyPts && (
            <polyline points={polyPts} fill="none"
              stroke={waveColor} strokeWidth="2" strokeLinejoin="miter"
              style={{ filter:`drop-shadow(0 0 3px ${waveColor}60)` }} />
          )}

          {/* 波形塗りつぶし (非Bus時のみ) */}
          {!isBus && polyPts && history.length > 0 && (() => {
            const fillPts = polyPts + ` ${LABEL_W + history.length * STEP_W},${Y_LOW} ${LABEL_W},${Y_LOW}`;
            return <polygon points={fillPts} fill={waveColor} fillOpacity="0.06" />;
          })()}

          {/* ステップ値テキスト（最新16ステップ） - バス時は非表示 */}
          {!isBus && history.slice(-16).map((val, relIdx) => {
            const absIdx = history.length - Math.min(16, history.length) + relIdx;
            const cx = LABEL_W + absIdx * STEP_W + STEP_W / 2;
            const cy = val===1 ? Y_HIGH-5 : Y_LOW+12;
            return (
              <text key={`v${absIdx}`} x={cx} y={cy}
                fontSize="8" fill={waveColor} fillOpacity="0.55"
                textAnchor="middle" dominantBaseline="middle"
                style={{ userSelect:'none' }}>
                {val}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

// ============================================================
// タイミングチャート本体
// ============================================================
const TimingChart: React.FC = () => {
  const simulationResults = useCircuitStore((s) => s.simulationResults);
  const nodes             = useCircuitStore((s) => s.nodes);
  const isSimulating      = useCircuitStore((s) => s.isSimulating);
  const clockStep         = useCircuitStore((s) => s.clockStep);
  const runSimulation     = useCircuitStore((s) => s.runSimulation);
  const stepSimulate      = useCircuitStore((s) => s.stepSimulate);
  const resetSimulation   = useCircuitStore((s) => s.resetSimulation);
  const clearResults      = useCircuitStore((s) => s.clearResults);

  const [steps, setSteps] = useState(16);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    if (isPlaying) {
      intervalId = setInterval(async () => {
        if (!useCircuitStore.getState().isSimulating) {
          await useCircuitStore.getState().stepSimulate();
        }
      }, 200);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isPlaying]);

  const labelMap = useMemo(() => {
    const m: Record<string, string> = {};
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    safeNodes.forEach((n) => { m[n.id] = (n.data.params?.label as string) || n.data.label || n.data.gateType; });
    return m;
  }, [nodes]);

  const gateTypeMap = useMemo(() => {
    const m: Record<string, string> = {};
    const safeNodes = Array.isArray(nodes) ? nodes : [];
    safeNodes.forEach((n) => { m[n.id] = n.data.gateType; });
    return m;
  }, [nodes]);

  const timingData = simulationResults?.timingData ?? {};
  
  const chartRowOrder = useCircuitStore((s) => s.chartRowOrder);
  const setChartRowOrder = useCircuitStore((s) => s.setChartRowOrder);

  useEffect(() => {
    const currentKeys = Object.keys(timingData);
    if (currentKeys.length > 0) {
      const newOrder = [...chartRowOrder];
      currentKeys.forEach(k => { if (!newOrder.includes(k)) newOrder.push(k); });
      const filtered = newOrder.filter(k => currentKeys.includes(k));
      if (filtered.length !== chartRowOrder.length || filtered.some((k, i) => k !== chartRowOrder[i])) {
        setChartRowOrder(filtered);
      }
    }
  }, [timingData, chartRowOrder, setChartRowOrder]);

  const entries = useMemo(() => {
    const raw = Object.entries(timingData).filter(([, h]) => h.length > 0);
    return raw.sort((a, b) => {
      const idxA = chartRowOrder.indexOf(a[0]);
      const idxB = chartRowOrder.indexOf(b[0]);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  }, [timingData, chartRowOrder]);

  const maxSteps   = Math.max(...entries.map(([, h]) => h.length), 1);
  const svgWidth   = LABEL_W + maxSteps * STEP_W + 16;
  const gridXs     = Array.from({ length: maxSteps + 1 }, (_, i) => LABEL_W + i * STEP_W);

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = chartRowOrder.indexOf(String(active.id));
      const newIndex = chartRowOrder.indexOf(String(over.id));
      setChartRowOrder(arrayMove(chartRowOrder, oldIndex, newIndex));
    }
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
      <ControlBar
        steps={steps}
        onStepsChange={setSteps}
        onRun={() => runSimulation(steps)}
        onStep={() => stepSimulate()}
        onPlayToggle={() => setIsPlaying(!isPlaying)}
        isPlaying={isPlaying}
        onReset={() => { setIsPlaying(false); resetSimulation(); }}
        onClear={clearResults}
        isSimulating={isSimulating}
        hasNodes={(Array.isArray(nodes) ? nodes : []).length > 0}
        clockStep={clockStep}
      />

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ flex:1, overflowX:'auto', overflowY:'auto' }}>
          <div style={{ position: 'relative', width: svgWidth, display: 'flex', flexDirection: 'column' }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={chartRowOrder} strategy={verticalListSortingStrategy}>
                {entries.map(([nodeId, history]) => (
                  <SortableChartRow
                    key={nodeId}
                    nodeId={nodeId}
                    history={history}
                    svgWidth={svgWidth}
                    gridXs={gridXs}
                    labelMap={labelMap}
                    gateTypeMap={gateTypeMap}
                  />
                ))}
              </SortableContext>
            </DndContext>
            
            {/* 時間軸ラベル（末尾に追加） */}
            <svg width={svgWidth} height={20} style={{ display: 'block', fontFamily: 'var(--font-mono)' }}>
              {gridXs.filter((_, i) => i % 4 === 0).map((x, i) => (
                <text key={`t${i}`} x={x} y={14} fontSize="8" fill="#475569" textAnchor="middle" style={{ userSelect:'none' }}>
                  {i * 4}
                </text>
              ))}
            </svg>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default TimingChart;
