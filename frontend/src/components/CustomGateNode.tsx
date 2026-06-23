// CustomGateNode.tsx
// Quantum IDE — 単一カスタムノード（全ゲート共通）
//
// Phase 修正点:
//   - Switch: クリックで params.value (0/1) をトグル → updateNodeData
//   - Clock: <input type="number"> で params.pulseInterval を編集可能
//   - isGhost モード: NodeToolbar に 承認/破棄 ボタン

import React, { useCallback } from 'react';
import {
  Handle,
  Position,
  NodeToolbar,
  type NodeProps,
} from 'reactflow';
import {
  GitMerge, Layers, FlipHorizontal, ShieldOff, Shuffle,
  ToggleLeft, ToggleRight, Lightbulb, Clock, Hash,
  Atom, RefreshCw, RefreshCcw, Zap, Timer, Sigma,
  Link, Link2, Gauge,
  CheckCircle2, XCircle,
} from 'lucide-react';

import useCircuitStore from '../store/useCircuitStore';
import type { GateNodeData, GateType } from '../store/useCircuitStore';

// ============================================================
// ゲート設定辞書
// ============================================================
interface GateConfig {
  icon: React.ReactNode;
  label: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  glowColor: string;
  category: 'logic' | 'quantum';
}

const ICON = 18;

const GATE_CONFIG: Record<GateType, GateConfig> = {
  AND:      { icon: <GitMerge   size={ICON}/>, label:'AND',    borderColor:'#5b8df6', bgColor:'rgba(91,141,246,0.10)',  textColor:'#7eb3fa', glowColor:'rgba(91,141,246,0.25)',  category:'logic'   },
  OR:       { icon: <Layers     size={ICON}/>, label:'OR',     borderColor:'#38bdf8', bgColor:'rgba(56,189,248,0.10)',  textColor:'#7dd3fc', glowColor:'rgba(56,189,248,0.25)',  category:'logic'   },
  NOT:      { icon: <FlipHorizontal size={ICON}/>, label:'NOT',borderColor:'#f87171', bgColor:'rgba(248,113,113,0.10)',textColor:'#fca5a5', glowColor:'rgba(248,113,113,0.25)', category:'logic'   },
  NAND:     { icon: <ShieldOff  size={ICON}/>, label:'NAND',   borderColor:'#fb923c', bgColor:'rgba(251,146,60,0.10)',  textColor:'#fdba74', glowColor:'rgba(251,146,60,0.25)',  category:'logic'   },
  NOR:      { icon: <ShieldOff  size={ICON}/>, label:'NOR',    borderColor:'#eab308', bgColor:'rgba(234,179,8,0.10)',   textColor:'#fde047', glowColor:'rgba(234,179,8,0.25)',   category:'logic'   },
  XOR:      { icon: <Shuffle    size={ICON}/>, label:'XOR',    borderColor:'#34d399', bgColor:'rgba(52,211,153,0.10)',  textColor:'#6ee7b7', glowColor:'rgba(52,211,153,0.25)',  category:'logic'   },
  Switch:   { icon: <ToggleLeft size={ICON}/>, label:'SW',     borderColor:'#22d3a0', bgColor:'rgba(34,211,160,0.10)',  textColor:'#5eead4', glowColor:'rgba(34,211,160,0.25)',  category:'logic'   },
  LED:      { icon: <Lightbulb  size={ICON}/>, label:'LED',    borderColor:'#facc15', bgColor:'rgba(250,204,21,0.10)',  textColor:'#fde68a', glowColor:'rgba(250,204,21,0.30)',  category:'logic'   },
  Clock:    { icon: <Clock      size={ICON}/>, label:'CLK',    borderColor:'#f59e0b', bgColor:'rgba(245,158,11,0.10)',  textColor:'#fcd34d', glowColor:'rgba(245,158,11,0.30)',  category:'logic'   },
  SevenSeg: { icon: <Hash       size={ICON}/>, label:'7-SEG',  borderColor:'#e879f9', bgColor:'rgba(232,121,249,0.10)',textColor:'#f0abfc', glowColor:'rgba(232,121,249,0.25)', category:'logic'   },
  H:        { icon: <Atom       size={ICON}/>, label:'H',      borderColor:'#a855f7', bgColor:'rgba(168,85,247,0.12)',  textColor:'#c084fc', glowColor:'rgba(168,85,247,0.30)',  category:'quantum' },
  X:        { icon: <RefreshCw  size={ICON}/>, label:'X',      borderColor:'#818cf8', bgColor:'rgba(129,140,248,0.12)',textColor:'#a5b4fc', glowColor:'rgba(129,140,248,0.30)', category:'quantum' },
  Y:        { icon: <RefreshCcw size={ICON}/>, label:'Y',      borderColor:'#6366f1', bgColor:'rgba(99,102,241,0.12)', textColor:'#818cf8', glowColor:'rgba(99,102,241,0.30)',  category:'quantum' },
  Z:        { icon: <Zap        size={ICON}/>, label:'Z',      borderColor:'#7c3aed', bgColor:'rgba(124,58,237,0.12)', textColor:'#a78bfa', glowColor:'rgba(124,58,237,0.30)',  category:'quantum' },
  S:        { icon: <Sigma      size={ICON}/>, label:'S',      borderColor:'#9333ea', bgColor:'rgba(147,51,234,0.12)', textColor:'#c084fc', glowColor:'rgba(147,51,234,0.30)',  category:'quantum' },
  T:        { icon: <Timer      size={ICON}/>, label:'T',      borderColor:'#c026d3', bgColor:'rgba(192,38,211,0.12)', textColor:'#e879f9', glowColor:'rgba(192,38,211,0.30)',  category:'quantum' },
  CX:       { icon: <Link       size={ICON}/>, label:'CX',     borderColor:'#7c3aed', bgColor:'rgba(124,58,237,0.12)', textColor:'#a78bfa', glowColor:'rgba(124,58,237,0.30)',  category:'quantum' },
  CCX:      { icon: <Link2      size={ICON}/>, label:'CCX',    borderColor:'#6d28d9', bgColor:'rgba(109,40,217,0.12)', textColor:'#8b5cf6', glowColor:'rgba(109,40,217,0.30)',  category:'quantum' },
  Measure:  { icon: <Gauge      size={ICON}/>, label:'M',      borderColor:'#db2777', bgColor:'rgba(219,39,119,0.12)', textColor:'#f472b6', glowColor:'rgba(219,39,119,0.30)',  category:'quantum' },
  CustomIC: { icon: <Layers     size={ICON}/>, label:'IC',     borderColor:'#10b981', bgColor:'rgba(16,185,129,0.10)', textColor:'#34d399', glowColor:'rgba(16,185,129,0.25)',  category:'logic'   },
  Junction: { icon: <div style={{width:'10px',height:'10px',borderRadius:'50%',backgroundColor:'#60a5fa',display:'inline-block'}}/>, label:'JNC', borderColor:'#60a5fa', bgColor:'rgba(96,165,250,0.12)', textColor:'#93c5fd', glowColor:'rgba(96,165,250,0.4)', category:'logic' },
};

// Handle 等間隔配置の計算
const calcHandleTop = (index: number, total: number): string =>
  `${((index + 1) / (total + 1)) * 100}%`;

// 7-Segment 値のセグメント対応表 (A=0x01, B=0x02, ..., G=0x40)
const SEGMENTS: Record<number, number> = {
  0: 0x3F, 1: 0x06, 2: 0x5B, 3: 0x4F, 4: 0x66, 5: 0x6D, 6: 0x7D, 7: 0x07,
  8: 0x7F, 9: 0x6F, 10: 0x77, 11: 0x7C, 12: 0x39, 13: 0x5E, 14: 0x79, 15: 0x71
};

// ============================================================
// CustomGateNode
// ============================================================
const CustomGateNode: React.FC<NodeProps<GateNodeData>> = ({ id, data, selected }) => {
  const updateNodeData   = useCircuitStore((s) => s.updateNodeData);
  const acceptGhostNode  = useCircuitStore((s) => s.acceptGhostNode);
  const discardGhostNode = useCircuitStore((s) => s.discardGhostNode);
  const toggleSwitch     = useCircuitStore((s) => s.toggleSwitch);
  const simulationResults= useCircuitStore((s) => s.simulationResults);
  const storeEdges       = useCircuitStore((s) => s.edges);
  const config = GATE_CONFIG[data.gateType] ?? GATE_CONFIG['AND'];
  const isGhost = data.isGhost === true;

  // ---- LED: 入力エッジの edgeStates で発光状態を判定 ----
  const isLedOn = data.gateType === 'LED' &&
    storeEdges.some((e) => e.target === id && (simulationResults?.edgeStates[e.id] ?? 0) === 1);

  // ---- SevenSeg: 入力エッジの edgeStates で値を判定 ----
  const sevenSegValue = React.useMemo(() => {
    if (data.gateType !== 'SevenSeg') return 0;
    let val = 0;
    storeEdges.forEach((e) => {
      if (e.target === id && e.targetHandle) {
        const state = simulationResults?.edgeStates[e.id] ?? 0;
        if (state === 1) {
          const idxStr = e.targetHandle.split('-')[1];
          const idx = parseInt(idxStr, 10);
          if (!isNaN(idx) && idx >= 0 && idx < 4) {
            val |= (1 << idx);
          }
        }
      }
    });
    return val;
  }, [data.gateType, id, storeEdges, simulationResults]);

  // ---- Switch: ON/OFF トグル ----
  const switchValue = Number(data.params?.value ?? 1);
  const isOn = switchValue === 1;

  const handleSwitchToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSwitch(id);
  }, [id, toggleSwitch]);

  // ---- Clock: pulseInterval 変更 ----
  const pulseInterval = Number(data.params?.pulseInterval ?? 2);

  const handleIntervalChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
    updateNodeData(id, { params: { ...(data.params ?? {}), pulseInterval: val } });
  }, [id, data.params, updateNodeData]);

  // ---- ゴースト NodeToolbar ----
  const handleApprove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    acceptGhostNode(id);
  }, [id, acceptGhostNode]);

  const handleDiscard = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    discardGhostNode(id);
  }, [id, discardGhostNode]);


  const ghostToolbar = isGhost ? (
    <NodeToolbar isVisible position={Position.Top}>
      <div style={{ display:'flex', gap:'6px', padding:'4px 8px', backgroundColor:'#1a1d2e', border:'1px solid #3a3f6e', borderRadius:'8px', boxShadow:'0 4px 16px rgba(0,0,0,0.5)' }}>
        <button onClick={handleApprove} title="承認 (Enter)"
          style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 10px', fontSize:'11px', fontWeight:600, color:'#22d3a0', backgroundColor:'rgba(34,211,160,0.12)', border:'1px solid rgba(34,211,160,0.4)', borderRadius:'6px', cursor:'pointer' }}>
          <CheckCircle2 size={13} /> 承認
        </button>
        <button onClick={handleDiscard} title="破棄 (Esc)"
          style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 10px', fontSize:'11px', fontWeight:600, color:'#f87171', backgroundColor:'rgba(248,113,113,0.12)', border:'1px solid rgba(248,113,113,0.4)', borderRadius:'6px', cursor:'pointer' }}>
          <XCircle size={13} /> 破棄
        </button>
      </div>
    </NodeToolbar>
  ) : null;

  // ---- ノードスタイル ----
  // Switch ON/OFF で色変化、LED 発光で黄色グロー
  const activeBorderColor = data.gateType === 'Switch'
    ? (isOn ? '#22d3a0' : '#475569')
    : data.gateType === 'LED' && isLedOn ? '#facc15'
    : config.borderColor;
  const activeGlowColor = data.gateType === 'Switch'
    ? (isOn ? 'rgba(34,211,160,0.35)' : 'rgba(71,85,105,0.2)')
    : data.gateType === 'LED' && isLedOn ? 'rgba(250,204,21,0.6)'
    : config.glowColor;
  const activeBgColor = data.gateType === 'Switch'
    ? (isOn ? 'rgba(34,211,160,0.12)' : 'rgba(71,85,105,0.08)')
    : data.gateType === 'LED' && isLedOn ? 'rgba(250,204,21,0.20)'
    : config.bgColor;

  const inputCount  = data.handles?.inputs  ?? 1;
  const outputCount = data.handles?.outputs ?? 1;
  // N入力に応じてノードの最小高さを確保（1入力につき最低18px + 上下パディング）
  const dynMinHeight = Math.max(72, Math.max(inputCount, outputCount) * 18 + 24);

  const nodeStyle: React.CSSProperties = {
    position: 'relative',
    minWidth: '80px',
    minHeight: `${dynMinHeight}px`,
    padding: data.gateType === 'Clock' ? '8px 12px' : '10px 16px',
    borderRadius: '10px',
    border: isGhost
      ? '2px dashed #a855f7'
      : `2px solid ${selected ? '#fff' : activeBorderColor}`,
    backgroundColor: isGhost ? 'rgba(168,85,247,0.08)' : activeBgColor,
    boxShadow: isGhost
      ? '0 0 16px rgba(168,85,247,0.2)'
      : selected
        ? `0 0 0 2px ${activeBorderColor}, 0 0 20px ${activeGlowColor}`
        : `0 0 12px ${activeGlowColor}`,
    opacity: isGhost ? 0.55 : 1,
    cursor: data.gateType === 'Switch' ? 'pointer' : 'grab',
    userSelect: 'none',
    transition: 'all 0.15s',
  };

  // カテゴリバッジ
  const categoryBadge = (
    <div style={{
      position:'absolute', top:'-10px', left:'50%', transform:'translateX(-50%)',
      fontSize:'9px', fontWeight:700, letterSpacing:'0.06em', padding:'1px 6px',
      borderRadius:'4px', whiteSpace:'nowrap',
      backgroundColor: config.category === 'quantum' ? 'rgba(168,85,247,0.25)' : 'rgba(91,141,246,0.20)',
      color:            config.category === 'quantum' ? '#c084fc' : '#7eb3fa',
      border: `1px solid ${config.category === 'quantum' ? 'rgba(168,85,247,0.4)' : 'rgba(91,141,246,0.4)'}`,
    }}>
      {config.category === 'quantum' ? '量子' : '論理'}
    </div>
  );

  // Handle スタイル
  const handleStyle = (side: 'left'|'right'): React.CSSProperties => ({
    width:'10px', height:'10px',
    backgroundColor: isGhost ? '#a855f7' : activeBorderColor,
    border: `2px solid ${isGhost ? '#7e22ce' : activeBgColor}`,
    borderRadius:'50%',
    [side]: '-6px',
    transform: 'translateY(-50%)',
    transition:'background-color 0.15s',
  });

  const inputHandles = Array.from({ length: inputCount }, (_, i) => (
    <Handle key={`in-${i}`} id={`in-${i}`} type="target" position={Position.Left}
      style={{ ...handleStyle('left'), top: calcHandleTop(i, inputCount) }} />
  ));

  // --- 分岐ドット: 同一ハンドルに2本以上エッジが接続された場合に表示 ---
  const junctionCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    storeEdges.forEach((e) => {
      if (e.source === id && e.sourceHandle) {
        counts[e.sourceHandle] = (counts[e.sourceHandle] || 0) + 1;
      }
    });
    return counts;
  }, [storeEdges, id]);

  const outputHandles = Array.from({ length: outputCount }, (_, i) => {
    const hid = `out-${i}`;
    const topPct = calcHandleTop(i, outputCount);
    const edgeCount = junctionCounts[hid] ?? 0;
    return (
      <React.Fragment key={hid}>
        <Handle id={hid} type="source" position={Position.Right}
          style={{ ...handleStyle('right'), top: topPct }} />
        {/* 2本以上接続 → 結合点ドット（論理回路の正式記法）*/}
        {edgeCount >= 2 && (
          <div style={{
            position: 'absolute',
            right: '-6px',
            top: topPct,
            transform: 'translateY(-50%)',
            width: '10px', height: '10px',
            borderRadius: '50%',
            backgroundColor: '#22d3a0',
            border: '1.5px solid #064e3b',
            boxShadow: '0 0 8px #22d3a0, 0 0 4px rgba(34,211,160,0.7)',
            pointerEvents: 'none',
            zIndex: 25,
          }} />
        )}
      </React.Fragment>
    );
  });

  // ============================================================
  // Junction 分岐点: 4方向ハンドル付き極小ドットとして早期リターン
  // ============================================================
  if (data.gateType === 'Junction') {
    const jColor = '#60a5fa';
    const jHandleBase: React.CSSProperties = {
      width: '9px', height: '9px',
      backgroundColor: jColor,
      border: '2px solid #1e3a5f',
      borderRadius: '50%',
      position: 'absolute',
    };
    return (
      <>
        {ghostToolbar}
        <div style={{
          position: 'relative',
          width: '20px', height: '20px',
          borderRadius: '50%',
          backgroundColor: selected ? 'rgba(96,165,250,0.35)' : 'rgba(96,165,250,0.15)',
          border: `2px solid ${selected ? '#fff' : jColor}`,
          boxShadow: `0 0 10px rgba(96,165,250,${selected ? '0.8' : '0.5'})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'grab',
          transition: 'all 0.15s',
        }}>
          {/* 中央ドット */}
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: jColor, boxShadow: `0 0 6px ${jColor}` }} />
          {/* 左: 入力 */}
          <Handle id="in-0"  type="target" position={Position.Left}
            style={{ ...jHandleBase, left: '-6px', top: '50%', transform: 'translateY(-50%)' }} />
          {/* 右: 出力0 */}
          <Handle id="out-0" type="source" position={Position.Right}
            style={{ ...jHandleBase, right: '-6px', top: '50%', transform: 'translateY(-50%)' }} />
          {/* 上: 出力1 */}
          <Handle id="out-1" type="source" position={Position.Top}
            style={{ ...jHandleBase, top: '-6px', left: '50%', transform: 'translateX(-50%)' }} />
          {/* 下: 出力2 */}
          <Handle id="out-2" type="source" position={Position.Bottom}
            style={{ ...jHandleBase, bottom: '-6px', left: '50%', transform: 'translateX(-50%)' }} />
        </div>
      </>
    );
  }

  // LED 発光時の追加グロースタイル
  const ledGlowExtra = data.gateType === 'LED' && isLedOn ? {
    animation: 'led-pulse 0.8s ease-in-out infinite alternate',
  } : {};


  // ============================================================
  // LED 専用の内部レンダリング
  // ============================================================
  const ledBody = data.gateType === 'LED' ? (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
      <div style={{
        lineHeight:0,
        color: isLedOn ? '#facc15' : '#64748b',
        filter: isLedOn ? 'drop-shadow(0 0 8px #facc15) drop-shadow(0 0 16px #f59e0b)' : 'none',
        transition: 'all 0.15s',
      }}>
        <Lightbulb size={ICON} />
      </div>
      <span style={{ fontSize:'11px', fontWeight:700, fontFamily:'var(--font-mono)',
        color: isLedOn ? '#facc15' : '#64748b', transition:'color 0.15s' }}>
        {isLedOn ? 'ON' : 'OFF'}
      </span>
    </div>
  ) : null;

  // ============================================================
  const switchBody = data.gateType === 'Switch' ? (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
      <div style={{ color: isOn ? '#22d3a0' : '#475569', transition:'color 0.15s', lineHeight:0 }}>
        {isOn ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
      </div>
      <span style={{
        fontSize:'11px', fontWeight:700, fontFamily:'var(--font-mono)',
        color: isOn ? '#22d3a0' : '#64748b',
        transition:'color 0.15s',
      }}>
        {isOn ? 'HIGH' : 'LOW'}
      </span>
    </div>
  ) : null;

  // ============================================================
  // Clock 専用の内部レンダリング（interval 入力付き）
  // ============================================================
  const clockBody = data.gateType === 'Clock' ? (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
      <div style={{ color: config.textColor, lineHeight:0 }}>
        <Clock size={ICON} />
      </div>
      <span style={{ fontSize:'11px', fontWeight:700, fontFamily:'var(--font-mono)', color: config.textColor }}>
        CLK
      </span>
      {/* pulseInterval 入力欄 */}
      <div
        style={{ display:'flex', alignItems:'center', gap:'3px', marginTop:'2px' }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span style={{ fontSize:'9px', color:'var(--color-text-muted)', fontFamily:'var(--font-mono)' }}>T=</span>
        <input
          type="number"
          className="nodrag nopan"
          value={pulseInterval}
          min={1}
          max={99}
          step={1}
          onChange={handleIntervalChange}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          style={{
            width:'34px',
            padding:'1px 4px',
            fontSize:'10px',
            fontFamily:'var(--font-mono)',
            fontWeight:600,
            color:'#fcd34d',
            backgroundColor:'rgba(245,158,11,0.15)',
            border:'1px solid rgba(245,158,11,0.4)',
            borderRadius:'4px',
            outline:'none',
            textAlign:'center',
            cursor:'text',
          }}
        />

      </div>
    </div>
  ) : null;

  // ============================================================
  // 7-SEG 内部レンダリング
  // ============================================================
  const segState = SEGMENTS[sevenSegValue] ?? 0;
  const sevenSegBody = data.gateType === 'SevenSeg' ? (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
      <svg width="24" height="34" viewBox="0 0 24 34" style={{ filter: 'drop-shadow(0 0 4px rgba(232,121,249,0.5))' }}>
        {/* A (top) */}
        <polygon points="6,2 18,2 15,5 9,5" fill={(segState & 0x01) ? '#e879f9' : '#3a3f6e'} />
        {/* B (top-right) */}
        <polygon points="19,3 22,6 22,14 19,16 16,13 16,6" fill={(segState & 0x02) ? '#e879f9' : '#3a3f6e'} />
        {/* C (bottom-right) */}
        <polygon points="19,18 22,20 22,28 19,31 16,28 16,21" fill={(segState & 0x04) ? '#e879f9' : '#3a3f6e'} />
        {/* D (bottom) */}
        <polygon points="6,32 18,32 15,29 9,29" fill={(segState & 0x08) ? '#e879f9' : '#3a3f6e'} />
        {/* E (bottom-left) */}
        <polygon points="5,31 2,28 2,20 5,18 8,21 8,28" fill={(segState & 0x10) ? '#e879f9' : '#3a3f6e'} />
        {/* F (top-left) */}
        <polygon points="5,16 2,14 2,6 5,3 8,6 8,13" fill={(segState & 0x20) ? '#e879f9' : '#3a3f6e'} />
        {/* G (middle) */}
        <polygon points="6,17 9,14 15,14 18,17 15,20 9,20" fill={(segState & 0x40) ? '#e879f9' : '#3a3f6e'} />
      </svg>
    </div>
  ) : null;

  // ============================================================
  // 通常ゲートの内部レンダリング
  // ============================================================
  const defaultBody = (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', color: isGhost ? '#c084fc' : config.textColor }}>
      <div style={{ lineHeight:0 }}>{config.icon}</div>
      <span style={{ fontSize:'12px', fontWeight:700, fontFamily:'var(--font-mono)', letterSpacing:'0.05em' }}>
        {config.label}
      </span>
    </div>
  );

  return (
    <>
      {ghostToolbar}
      <div
        style={{ ...nodeStyle, ...ledGlowExtra }}
        onClick={data.gateType === 'Switch' ? handleSwitchToggle : undefined}
        title={data.gateType === 'Switch' ? (isOn ? 'クリックで LOW に変更' : 'クリックで HIGH に変更') : undefined}
      >
        {categoryBadge}
        {data.params?.label ? (
          <div style={{
            position: 'absolute', top: '-24px', left: '50%', transform: 'translateX(-50%)',
            fontSize: '11px', fontWeight: 600, color: '#e2e8f0', backgroundColor: 'rgba(15,17,32,0.8)',
            padding: '2px 6px', borderRadius: '4px', border: '1px solid #3a3f6e', whiteSpace: 'nowrap'
          }}>
            {data.params.label as string}
          </div>
        ) : null}
        {data.gateType === 'LED'
          ? ledBody
          : data.gateType === 'Switch'
            ? switchBody
            : data.gateType === 'Clock'
              ? clockBody
              : data.gateType === 'SevenSeg'
                ? sevenSegBody
                : defaultBody
        }
        {inputHandles}
        {outputHandles}
      </div>
      <style>{`
        @keyframes led-pulse {
          from { box-shadow: 0 0 12px rgba(250,204,21,0.6), 0 0 24px rgba(250,204,21,0.3); }
          to   { box-shadow: 0 0 24px rgba(250,204,21,0.9), 0 0 48px rgba(250,204,21,0.5); }
        }
      `}</style>
    </>
  );
};

export default CustomGateNode;
