// GatePalette.tsx
// Quantum IDE — ゲートパレット（左サイドバー）
//
// 【責務】
//   - 論理ゲート / 量子ゲートをセクション別に一覧表示する。
//   - 各ゲートアイテムは draggable 属性を持ち、
//     onDragStart で event.dataTransfer にゲート情報（JSON文字列）をセットする。
//   - ドロップ先の CircuitCanvas.tsx 側で情報を受け取り addNode を呼ぶ。

import React, { useState } from 'react';
import {
  GitMerge, Layers, FlipHorizontal, ShieldOff, Shuffle,
  ToggleLeft, Lightbulb, Clock, Hash,
  Atom, RefreshCw, RefreshCcw, Zap, Timer, Sigma,
  Gauge,
  ChevronDown, ChevronRight, GitBranch, Circle,
} from 'lucide-react';
import useCircuitStore, { type GateType } from '../store/useCircuitStore';

// ============================================================
// ゲートアイテムのメタデータ定義
// ============================================================
export interface GateMeta {
  gateType: GateType;
  label: string;
  description: string;
  icon: React.ReactNode;
  handles: { inputs: number; outputs: number };
  borderColor: string;
  bgColor: string;
  textColor: string;
  params?: Record<string, any>;
}

const ICON_SIZE = 15;

/** ドラッグ転送データの型（CircuitCanvas 側で受け取る） */
export interface DragTransferData {
  gateType: GateType;
  label: string;
  handles: { inputs: number; outputs: number };
  params?: Record<string, any>;
}

export const DRAG_DATA_KEY = 'application/quantum-ide-gate';

// ============================================================
// 論理ゲート一覧
// ============================================================
const LOGIC_GATES: GateMeta[] = [
  {
    gateType: 'AND',
    label: 'AND',
    description: '論理積',
    icon: <GitMerge size={ICON_SIZE} />,
    handles: { inputs: 2, outputs: 1 },
    borderColor: '#5b8df6',
    bgColor: 'rgba(91,141,246,0.10)',
    textColor: '#7eb3fa',
  },
  {
    gateType: 'OR',
    label: 'OR',
    description: '論理和',
    icon: <Layers size={ICON_SIZE} />,
    handles: { inputs: 2, outputs: 1 },
    borderColor: '#38bdf8',
    bgColor: 'rgba(56,189,248,0.10)',
    textColor: '#7dd3fc',
  },
  {
    gateType: 'NOT',
    label: 'NOT',
    description: '否定',
    icon: <FlipHorizontal size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 1 },
    borderColor: '#f87171',
    bgColor: 'rgba(248,113,113,0.10)',
    textColor: '#fca5a5',
  },
  {
    gateType: 'NAND',
    label: 'NAND',
    description: '否定論理積',
    icon: <ShieldOff size={ICON_SIZE} />,
    handles: { inputs: 2, outputs: 1 },
    borderColor: '#fb923c',
    bgColor: 'rgba(251,146,60,0.10)',
    textColor: '#fdba74',
  },
  {
    gateType: 'NOR',
    label: 'NOR',
    description: '否定論理和',
    icon: <ShieldOff size={ICON_SIZE} />,
    handles: { inputs: 2, outputs: 1 },
    borderColor: '#eab308',
    bgColor: 'rgba(234,179,8,0.10)',
    textColor: '#fde047',
  },
  {
    gateType: 'XOR',
    label: 'XOR',
    description: '排他的論理和',
    icon: <Shuffle size={ICON_SIZE} />,
    handles: { inputs: 2, outputs: 1 },
    borderColor: '#34d399',
    bgColor: 'rgba(52,211,153,0.10)',
    textColor: '#6ee7b7',
  },
  {
    gateType: 'Switch',
    label: 'Switch',
    description: 'スイッチ入力',
    icon: <ToggleLeft size={ICON_SIZE} />,
    handles: { inputs: 0, outputs: 1 },
    borderColor: '#22d3a0',
    bgColor: 'rgba(34,211,160,0.10)',
    textColor: '#5eead4',
  },
  {
    gateType: 'LED',
    label: 'LED',
    description: 'LED出力',
    icon: <Lightbulb size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 0 },
    borderColor: '#facc15',
    bgColor: 'rgba(250,204,21,0.10)',
    textColor: '#fde68a',
  },
  {
    gateType: 'Clock',
    label: 'Clock',
    description: 'クロック信号',
    icon: <Clock size={ICON_SIZE} />,
    handles: { inputs: 0, outputs: 1 },
    borderColor: '#f59e0b',
    bgColor: 'rgba(245,158,11,0.10)',
    textColor: '#fcd34d',
  },
  {
    gateType: 'SevenSeg',
    label: '7-Seg',
    description: '7セグメント',
    icon: <Hash size={ICON_SIZE} />,
    handles: { inputs: 4, outputs: 0 },
    borderColor: '#e879f9',
    bgColor: 'rgba(232,121,249,0.10)',
    textColor: '#f0abfc',
  },
];

// ============================================================
// 配線ツール一覧（Junction 分岐点など）
// ============================================================
const WIRE_TOOLS: GateMeta[] = [
  {
    gateType: 'Junction',
    label: 'Junction',
    description: '分岐点（パススルー）',
    icon: <GitBranch size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 3 },
    borderColor: '#60a5fa',
    bgColor: 'rgba(96,165,250,0.12)',
    textColor: '#93c5fd',
  },
];

// ============================================================
// 量子ゲート一覧
// ============================================================
export const QUANTUM_GATES: GateMeta[] = [
  {
    gateType: 'H',
    label: 'H',
    description: 'Hadamardゲート',
    icon: <Atom size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 1 },
    borderColor: '#a855f7',
    bgColor: 'rgba(168,85,247,0.12)',
    textColor: '#c084fc',
  },
  {
    gateType: 'X',
    label: 'X',
    description: 'Pauli-X / NOT',
    icon: <RefreshCw size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 1 },
    borderColor: '#818cf8',
    bgColor: 'rgba(129,140,248,0.12)',
    textColor: '#a5b4fc',
  },
  {
    gateType: 'Y',
    label: 'Y',
    description: 'Pauli-Y',
    icon: <RefreshCcw size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 1 },
    borderColor: '#6366f1',
    bgColor: 'rgba(99,102,241,0.12)',
    textColor: '#818cf8',
  },
  {
    gateType: 'Z',
    label: 'Z',
    description: 'Pauli-Z',
    icon: <Zap size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 1 },
    borderColor: '#7c3aed',
    bgColor: 'rgba(124,58,237,0.12)',
    textColor: '#a78bfa',
  },
  {
    gateType: 'S',
    label: 'S',
    description: 'Sゲート (π/2)',
    icon: <Sigma size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 1 },
    borderColor: '#9333ea',
    bgColor: 'rgba(147,51,234,0.12)',
    textColor: '#c084fc',
  },
  {
    gateType: 'T',
    label: 'T',
    description: 'Tゲート (π/4)',
    icon: <Timer size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 1 },
    borderColor: '#c026d3',
    bgColor: 'rgba(192,38,211,0.12)',
    textColor: '#e879f9',
  },

  {
    gateType: 'CTRL',
    label: 'Control',
    description: 'コントロール (黒丸)',
    icon: <Circle fill="currentColor" size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 1 },
    borderColor: '#6d28d9',
    bgColor: 'rgba(109,40,217,0.12)',
    textColor: '#8b5cf6',
  },
  {
    gateType: 'Measure',
    label: 'Measure',
    description: '測定',
    icon: <Gauge size={ICON_SIZE} />,
    handles: { inputs: 1, outputs: 1 },
    borderColor: '#db2777',
    bgColor: 'rgba(219,39,119,0.12)',
    textColor: '#f472b6',
  },
];

// ============================================================
// 個別ゲートアイテムコンポーネント
// ============================================================
const GateItem: React.FC<{ gate: GateMeta; inputOverride?: number }> = ({ gate, inputOverride }) => {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    const data: DragTransferData = {
      gateType: gate.gateType,
      label: String(gate.label),
      handles: {
        inputs:  inputOverride ?? gate.handles.inputs,
        outputs: gate.handles.outputs,
      },
      params: gate.params,
    };
    e.dataTransfer.setData(DRAG_DATA_KEY, JSON.stringify(data));
    // 量子回路モード互換用のD&Dデータ
    e.dataTransfer.setData('mode', 'new');
    e.dataTransfer.setData('gateType', gate.gateType.toLowerCase());
    
    e.dataTransfer.effectAllowed = 'copy';
    setDragging(true);
  };

  const handleDragEnd = () => setDragging(false);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`${gate.label} — ${gate.description}\n入力: ${gate.handles.inputs}  出力: ${gate.handles.outputs}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        margin: '1px 4px',
        borderRadius: '7px',
        border: `1px solid ${hovered || dragging ? gate.borderColor : 'transparent'}`,
        backgroundColor: hovered || dragging ? gate.bgColor : 'transparent',
        cursor: 'grab',
        opacity: dragging ? 0.5 : 1,
        transition: 'all 0.12s ease',
        userSelect: 'none',
      }}
    >
      {/* アイコン */}
      <div style={{ color: gate.textColor, lineHeight: 0, flexShrink: 0 }}>
        {gate.icon}
      </div>

      {/* ラベル + 説明 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            fontFamily: 'var(--font-mono)',
            color: hovered ? gate.textColor : 'var(--color-text-primary)',
            transition: 'color 0.12s',
          }}
        >
          {gate.label}
        </div>
        <div
          style={{
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            marginTop: '1px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {gate.description}
        </div>
      </div>

      {/* 入出力バッジ */}
      <div
        style={{
          fontSize: '9px',
          color: 'var(--color-text-muted)',
          fontFamily: 'var(--font-mono)',
          flexShrink: 0,
          textAlign: 'right',
          lineHeight: 1.4,
        }}
      >
        <div>in:{gate.handles.inputs}</div>
        <div>out:{gate.handles.outputs}</div>
      </div>
    </div>
  );
};

// ============================================================
// 入力数コンフィギュレータ
// ============================================================
const MULTI_INPUT_GATES = new Set(['AND', 'OR', 'NAND', 'XOR']);

const InputConfigurator: React.FC<{
  value: number;
  onChange: (n: number) => void;
}> = ({ value, onChange }) => (
  <div style={{
    margin: '2px 8px 6px',
    padding: '6px 8px',
    borderRadius: '7px',
    backgroundColor: 'rgba(91,141,246,0.06)',
    border: '1px solid rgba(91,141,246,0.18)',
  }}>
    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '5px', fontWeight: 600 }}>
      入力数:
    </div>
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
      {[2, 3, 4, 5, 8].map((n) => (
        <button key={n} onClick={() => onChange(n)}
          style={{
            width: '24px', height: '22px', fontSize: '11px', fontWeight: 700,
            borderRadius: '4px',
            border: `1px solid ${value === n ? '#5b8df6' : 'var(--color-border)'}`,
            backgroundColor: value === n ? 'rgba(91,141,246,0.3)' : 'transparent',
            color: value === n ? '#93c5fd' : 'var(--color-text-muted)',
            cursor: 'pointer', transition: 'all 0.12s',
          }}
        >{n}</button>
      ))}
      <input
        type="number" min={1} max={32} value={value}
        onChange={(e) => onChange(Math.max(1, Math.min(32, parseInt(e.target.value) || 2)))}
        style={{
          width: '40px', height: '22px', padding: '0 4px', fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-primary)',
          backgroundColor: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px', textAlign: 'center',
        }}
      />
    </div>
  </div>
);

// ============================================================
// セクション（折りたたみ可能）
// ============================================================
interface SectionProps {
  title: string;
  accent: string;
  gates: GateMeta[];
  defaultOpen?: boolean;
  inputConfigurator?: React.ReactNode;
  logicInputCount?: number;
  headerRight?: React.ReactNode;
}

const PaletteSection: React.FC<SectionProps> = ({
  title, accent, gates, defaultOpen = true,
  inputConfigurator, logicInputCount, headerRight
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ marginBottom: '2px' }}>
      {/* セクションヘッダー */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          width: '100%',
          padding: '5px 10px',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'background-color 0.12s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.04)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <span style={{ color: accent, lineHeight: 0 }}>
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: accent,
          }}
        >
          {title}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {headerRight && (
            <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center' }}>
              {headerRight}
            </div>
          )}
          <span
            style={{
              fontSize: '10px',
              color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-mono)',
              width: '16px',
              textAlign: 'right'
            }}
          >
            {gates.length}
          </span>
        </div>
      </div>

      {/* ゲート一覧 */}
      {open && (
        <div style={{ paddingBottom: '4px' }}>
          {/* N入力コンフィギュレータ（論理ゲートセクション用） */}
          {inputConfigurator}
          {gates.map((gate) => (
            <GateItem
              key={gate.gateType}
              gate={gate}
              inputOverride={
                logicInputCount && MULTI_INPUT_GATES.has(gate.gateType)
                  ? logicInputCount
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================
// GatePalette メインコンポーネント
// ============================================================
const GatePalette: React.FC = () => {
  const [logicInputCount, setLogicInputCount] = useState(2);
  const customModules = useCircuitStore((s) => s.customModules);
  const saveCustomModule = useCircuitStore((s) => s.saveCustomModule);
  const mode = useCircuitStore((s) => s.mode);
  const setMode = useCircuitStore((s) => s.setMode);

  const customGates: GateMeta[] = Object.values(customModules).map(m => ({
    gateType: 'CustomIC',
    label: m.name,
    description: `カスタムモジュール (${m.inputs}in / ${m.outputs}out)`,
    icon: <Layers size={ICON_SIZE} />,
    handles: { inputs: m.inputs, outputs: m.outputs },
    borderColor: '#10b981',
    bgColor: 'rgba(16,185,129,0.10)',
    textColor: '#34d399',
    params: { customId: m.id }, // このモジュールのIDをパラメーターとして渡す
  }));

  const handleSaveModule = () => {
    const name = prompt('カスタムモジュールの名前を入力してください:');
    if (name) {
      saveCustomModule(name);
    }
  };

  return (
    <aside
      style={{
        width: '256px',
        flexShrink: 0,
        height: '100%',
        overflowY: 'scroll',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--color-bg-panel)',
        borderRight: '1px solid var(--color-border)',
      }}
    >
      {/* パレットヘッダー */}
      <div
        style={{
          padding: '8px 10px 6px',
          borderBottom: '1px solid var(--color-border)',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--color-bg-panel)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px' }}>
          <p style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
            ゲートをキャンバスにドラッグ
          </p>
        </div>
        
        {/* モード切り替えタブ */}
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--color-bg-base)', padding: '2px', borderRadius: '6px' }}>
          <button
            onClick={() => setMode('logic')}
            style={{
              flex: 1, padding: '4px 0', fontSize: '11px', fontWeight: 600,
              backgroundColor: mode === 'logic' ? 'var(--color-bg-panel)' : 'transparent',
              color: mode === 'logic' ? 'var(--color-accent-blue)' : 'var(--color-text-muted)',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
              boxShadow: mode === 'logic' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            論理回路
          </button>
          <button
            onClick={() => setMode('quantum')}
            style={{
              flex: 1, padding: '4px 0', fontSize: '11px', fontWeight: 600,
              backgroundColor: mode === 'quantum' ? 'var(--color-bg-panel)' : 'transparent',
              color: mode === 'quantum' ? 'var(--color-accent-purple)' : 'var(--color-text-muted)',
              border: 'none', borderRadius: '4px', cursor: 'pointer',
              boxShadow: mode === 'quantum' ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            量子回路
          </button>
        </div>
      </div>

      {/* ゲートリスト */}
      <div style={{ flex: 1, paddingTop: '4px' }}>
        {mode === 'logic' ? (
          <>
            {/* 配線ツールセクション */}
            <PaletteSection
              title="配線"
              accent="#60a5fa"
              gates={WIRE_TOOLS}
              defaultOpen={true}
            />
            {/* カスタムICセクション */}
            <PaletteSection
              title="カスタムIC"
              accent="#10b981"
              gates={customGates}
              defaultOpen={true}
              headerRight={
                <button onClick={handleSaveModule} title="現在の回路をカスタムICとして保存"
                  style={{
                    padding: '2px 6px', fontSize: '10px', fontWeight: 600,
                    backgroundColor: 'var(--color-accent-green)', color: '#000',
                    border: 'none', borderRadius: '4px', cursor: 'pointer'
                  }}>
                  保存
                </button>
              }
            />
            {/* 論理ゲートセクション（N入力コンフィギュレータ付き）*/}
            <PaletteSection
              title="論理ゲート"
              accent="var(--color-accent-blue)"
              gates={LOGIC_GATES}
              defaultOpen={true}
              inputConfigurator={
                <InputConfigurator value={logicInputCount} onChange={setLogicInputCount} />
              }
              logicInputCount={logicInputCount}
            />
          </>
        ) : (
          /* 量子ゲートセクション */
          <PaletteSection
            title="量子ゲート"
            accent="var(--color-accent-purple)"
            gates={QUANTUM_GATES}
            defaultOpen={true}
          />
        )}
      </div>
    </aside>
  );
};

export default GatePalette;
