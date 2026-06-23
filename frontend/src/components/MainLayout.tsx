// MainLayout.tsx
// Quantum IDE メインレイアウト（react-resizable-panels 対応 H 型構造）
//
// Phase 10 変更点:
//   - react-resizable-panels で左/中/右・上下境界をドラッグ変更可能に
//   - AppHeader に 「レイアウト初期化」「✨ 回路整理（Dagre）」ボタン追加
//   - BottomConsole に「真理値表」タブ追加（TimingChart / TruthTable / AI）

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';
import { useGroupRef } from 'react-resizable-panels';
import {
  Cpu, Settings, Activity, MessageSquare,
  FolderOpen, Save, Download, LayoutGrid, Sparkles,
  BarChart2, Table2, FunctionSquare, Map as MapIcon,
} from 'lucide-react';

import TimingChart   from './TimingChart';
import TruthTable    from './TruthTable';
import StateMonitor  from './StateMonitor';
import ChatPanel     from './ChatPanel';
import GatePalette   from './GatePalette';
import CircuitCanvas from './CircuitCanvas';
import QuantumCircuitCanvas from './QuantumCircuitCanvas';
import LogicExpressionPanel from './LogicExpressionPanel';
import useCircuitStore from '../store/useCircuitStore';
import { calculateElkLayout } from '../utils/autoLayout';

// ============================================================
// リサイズハンドル スタイル
// ============================================================
const HorizHandle: React.FC = () => (
  <PanelResizeHandle
    style={{ width: '4px', backgroundColor: 'var(--color-border)', cursor: 'col-resize',
      flexShrink: 0, transition: 'background-color 0.2s' }}
  />
);
const VertHandle: React.FC = () => (
  <PanelResizeHandle
    style={{ height: '4px', backgroundColor: 'var(--color-border)', cursor: 'row-resize',
      flexShrink: 0, transition: 'background-color 0.2s' }}
  />
);

// ============================================================
// ヘッダー（開く/保存/エクスポート/レイアウト初期化/回路整理）
// ============================================================
interface AppHeaderProps {
  onResetLayout: () => void;
}
import type { EdgeMode } from '../store/useCircuitStore';

const AppHeader: React.FC<AppHeaderProps> = ({ onResetLayout }) => {
  const [showExport, setShowExport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { 
    mode, quantumGrid, quantumNumQubits, quantumNumSlots, setQuantumSimulationResult,
    nodes, edges, loadCircuit, applyLayout, edgeType, setEdgeType, 
    showLogicPanel, showMiniMap, toggleLogicPanel, toggleMiniMap 
  } = useCircuitStore();
  const API = 'http://localhost:8000';

  const dl = (content: string, filename: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content]));
    a.download = filename; a.click();
  };
  const handleSave = () => {
    const data = mode === 'logic'
      ? { type: 'quantum_ide_project', mode: 'logic', logicData: { nodes, edges } }
      : { type: 'quantum_ide_project', mode: 'quantum', quantumData: { grid: quantumGrid, numQubits: quantumNumQubits, numSlots: quantumNumSlots } };
    dl(JSON.stringify(data, null, 2), 'circuit.json');
  };
  const handleOpen = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { loadCircuit(JSON.parse(ev.target?.result as string)); }
      catch { alert('ファイルの読み込みに失敗しました。正しい .json または .qide ファイルを選択してください。'); }
    };
    reader.readAsText(f); e.target.value = '';
  }, [loadCircuit]);
  const exportFetch = async (path: string, filename: string) => {
    setShowExport(false);
    try {
      const res = await fetch(`${API}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges }),
      });
      dl(await res.text(), filename);
    } catch { alert('エクスポートに失敗しました。バックエンドが起動しているか確認してください。'); }
  };
  const handleAutoLayout = useCallback(async () => {
    if (nodes.length === 0) return;
    try {
      const result = await calculateElkLayout(nodes, edges);
      applyLayout(result.nodes);
    } catch (err) {
      console.error('[AutoLayout] ELK エラー:', err);
    }
  }, [nodes, edges, applyLayout]);

  const handleQuantumSimulate = async () => {
    try {
      const circuit: any[] = [];
      const numSlots = quantumGrid[0]?.length || 0;
      for (let sIndex = 0; sIndex < numSlots; sIndex++) {
        const groups = new Map<number, { controls: number[], targets: { q: number, type: string }[] }>();
        const independent: { q: number, type: string }[] = [];

        for (let qIndex = 0; qIndex < quantumGrid.length; qIndex++) {
          const cell = quantumGrid[qIndex][sIndex];
          if (!cell) continue;
          
          if (cell.pairId) {
             if (!groups.has(cell.pairId)) groups.set(cell.pairId, { controls: [], targets: [] });
             const g = groups.get(cell.pairId)!;
             if (cell.role === 'control' || cell.type.toUpperCase() === 'CTRL') {
                g.controls.push(qIndex);
             } else if (cell.role === 'target' || cell.type.toUpperCase() === 'CX' || cell.type.toUpperCase() === 'CZ') {
                g.targets.push({ q: qIndex, type: cell.type.toLowerCase() });
             } else {
                independent.push({ q: qIndex, type: cell.type.toLowerCase() });
             }
          } else {
             if (cell.type.toUpperCase() === 'CTRL') continue; // lone control does nothing
             if (cell.type.toUpperCase() === 'CX_TARGET' || cell.type.toUpperCase() === 'CX') {
                independent.push({ q: qIndex, type: 'x' });
             } else if (cell.type.toUpperCase() === 'CZ_TARGET' || cell.type.toUpperCase() === 'CZ') {
                independent.push({ q: qIndex, type: 'z' });
             } else {
                independent.push({ q: qIndex, type: cell.type.toLowerCase() });
             }
          }
        }

        independent.forEach(ind => {
           circuit.push({ gate: ind.type, qubit: ind.q, slot: sIndex });
        });

        groups.forEach(g => {
           g.targets.forEach(tgt => {
              if (g.controls.includes(tgt.q)) return; // Invalid placement
              const numCtrls = g.controls.length;
              if (numCtrls === 0) {
                 const baseType = tgt.type === 'cz' ? 'z' : 'x';
                 circuit.push({ gate: baseType, qubit: tgt.q, slot: sIndex });
              } else if (numCtrls === 1) {
                 const gateType = tgt.type === 'cz' ? 'cz' : 'cx';
                 circuit.push({ gate: gateType, qubits: [g.controls[0], tgt.q], slot: sIndex });
              } else if (numCtrls === 2) {
                 const gateType = tgt.type === 'cz' ? 'ccz' : 'ccx';
                 circuit.push({ gate: gateType, qubits: [g.controls[0], g.controls[1], tgt.q], slot: sIndex });
              } else {
                 const gateType = tgt.type === 'cz' ? 'mcz' : 'mcx';
                 circuit.push({ gate: gateType, controls: g.controls, target: tgt.q, slot: sIndex });
              }
           });
        });
      }
      
      circuit.sort((a, b) => a.slot - b.slot);

      const res = await fetch(`${API}/api/simulate/quantum`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circuit, shots: 1024, num_qubits: quantumNumQubits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Simulation Failed');
      setQuantumSimulationResult(data);
    } catch (e: any) {
      alert(`量子シミュレーションエラー: ${e.message}`);
    }
  };

  const iconBtn = (icon: React.ReactNode, label: string, onClick: () => void, color?: string) => (
    <button onClick={onClick} title={label}
      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', height: '28px',
        fontSize: '11px', fontWeight: 500,
        color: color ?? 'var(--color-text-secondary)',
        backgroundColor: color ? `${color}18` : 'transparent',
        border: `1px solid ${color ? `${color}55` : 'var(--color-border)'}`,
        borderRadius: '6px', cursor: 'pointer', transition: 'all 0.15s' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
    >{icon}{label}</button>
  );

  return (
    <header className="h-14 flex-none flex items-center justify-between px-4 select-none"
      style={{ backgroundColor: 'var(--color-bg-header)', borderBottom: '1px solid var(--color-border)',
        boxShadow: '0 2px 20px rgba(91,141,246,0.08)' }}>

      {/* ロゴ */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ background: 'linear-gradient(135deg,#5b8df6 0%,#a855f7 100%)', boxShadow: '0 0 16px rgba(91,141,246,0.5)' }}>
          <Cpu size={16} color="#fff" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight"
            style={{ background: 'linear-gradient(90deg,#5b8df6,#a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Quantum IDE
          </span>
          <span className="ml-2 text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: 'rgba(91,141,246,0.15)', color: 'var(--color-accent-blue)', border: '1px solid rgba(91,141,246,0.3)' }}>
            v1.0
          </span>
        </div>
      </div>

      {/* 中央: IO + ユーティリティ */}
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" accept=".qide,.json" onChange={handleOpen} style={{ display: 'none' }} />
        {iconBtn(<FolderOpen size={13} />, '開く', () => fileRef.current?.click())}
        {iconBtn(<Save size={13} />, '保存', handleSave)}

        {/* エクスポートドロップダウン */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowExport((p) => !p)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', height: '28px',
              fontSize: '11px', fontWeight: 500, color: 'var(--color-accent-blue)',
              backgroundColor: 'rgba(91,141,246,0.10)', border: '1px solid rgba(91,141,246,0.35)',
              borderRadius: '6px', cursor: 'pointer' }}>
            <Download size={13} />エクスポート
          </button>
          {showExport && (
            <div style={{ position: 'absolute', top: '34px', right: 0, zIndex: 100, minWidth: '165px',
              backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)',
              borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
              {([
                ['/api/export/qasm',   'circuit.qasm', 'OpenQASM 2.0 (.qasm)'],
                ['/api/export/python', 'circuit.py',   'Qiskit Python (.py)'],
                ['/api/export/verilog','circuit.v',    'Structural Verilog (.v)'],
                ['/api/export/logisim','circuit.circ', 'Logisim XML (.circ)'],
              ] as [string,string,string][]).map(([path,file,label]) => (
                <button key={path} onClick={() => exportFetch(path, file)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px',
                    fontSize: '11px', color: 'var(--color-text-secondary)', backgroundColor: 'transparent',
                    border: 'none', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(91,141,246,0.1)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >{label}</button>
              ))}
            </div>
          )}
          {showExport && <div onClick={() => setShowExport(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />}
        </div>

        {/* 区切り */}
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-border)', margin: '0 4px' }} />

        {mode === 'logic' && (
          <>
            {/* ✨ 回路整理 */}
            {iconBtn(<Sparkles size={13} />, '回路整理', handleAutoLayout, '#a855f7')}

            {/* 配線モード切替 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>配線:</span>
              <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
                {([
                  ['default',  '曲線'],
                  ['straight', '直線'],
                  ['step',     '直角'],
                ] as [EdgeMode, string][]).map(([m, label]) => (
                  <button key={m} onClick={() => setEdgeType(m)}
                    style={{
                      padding: '2px 8px', height: '26px', fontSize: '10px', fontWeight: 600,
                      color: edgeType === m ? '#fff' : 'var(--color-text-muted)',
                      backgroundColor: edgeType === m ? 'rgba(91,141,246,0.55)' : 'transparent',
                      border: 'none',
                      borderRight: m !== 'step' ? '1px solid var(--color-border)' : 'none',
                      cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={(e) => { if (edgeType !== m) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(91,141,246,0.15)'; }}
                    onMouseLeave={(e) => { if (edgeType !== m) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >{label}</button>
                ))}
              </div>
            </div>
            {/* 区切り */}
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-border)', margin: '0 4px' }} />
          </>
        )}

        {mode === 'quantum' && (
          <>
            <button onClick={handleQuantumSimulate}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 16px', height: '30px', fontSize: '12px', fontWeight: 'bold',
                color: '#fff', backgroundColor: 'var(--color-accent-purple)',
                border: 'none', borderRadius: '6px', cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(168,85,247,0.3)', transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.filter = 'none';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
            >
              <Activity size={14} /> シミュレーション実行
            </button>
            {/* 区切り */}
            <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-border)', margin: '0 4px' }} />
          </>
        )}
        {/* UI トグル */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {iconBtn(<FunctionSquare size={13} />, '論理式', toggleLogicPanel, showLogicPanel ? '#5b8df6' : undefined)}
          {iconBtn(<MapIcon size={13} />, 'ミニマップ', toggleMiniMap, showMiniMap ? '#5b8df6' : undefined)}
        </div>

        {/* 区切り */}
        <div style={{ width: '1px', height: '20px', backgroundColor: 'var(--color-border)', margin: '0 2px' }} />

        {/* レイアウト初期化 */}
        {iconBtn(<LayoutGrid size={13} />, 'レイアウト初期化', onResetLayout)}
      </div>

      {/* 右: ステータス + 設定 */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
          style={{ backgroundColor: 'rgba(34,211,160,0.12)', border: '1px solid rgba(34,211,160,0.3)', color: 'var(--color-accent-green)' }}>
          <span className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: 'var(--color-accent-green)', boxShadow: '0 0 6px #22d3a0' }} />
          待機中
        </div>
        <button className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ color: 'var(--color-text-secondary)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
          title="設定">
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
};

import QuantumResultsPanel from './QuantumResultsPanel';

// ============================================================
// 下部コンソール（タイミングチャート / 真理値表 / AI コンソール / 量子結果）
// ============================================================
type ConsoleTab = 'timing' | 'truthtable' | 'ai' | 'quantumResult';
const BottomConsole: React.FC = () => {
  const [tab, setTab] = useState<ConsoleTab>('timing');
  const mode = useCircuitStore((s) => s.mode);

  useEffect(() => {
    if (mode === 'quantum' && (tab === 'timing' || tab === 'truthtable')) {
      setTab('quantumResult');
    }
  }, [mode, tab]);

  const tabBtn = (id: ConsoleTab, icon: React.ReactNode, label: string) => (
    <button onClick={() => setTab(id)} style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '0 12px', height: '100%', fontSize: '11px', fontWeight: 600,
      color: tab === id ? 'var(--color-accent-blue)' : 'var(--color-text-muted)',
      backgroundColor: 'transparent', border: 'none',
      borderBottom: tab === id ? '2px solid var(--color-accent-blue)' : '2px solid transparent',
      cursor: 'pointer', transition: 'color 0.15s', whiteSpace: 'nowrap',
    }}>
      {icon}{label}
    </button>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      backgroundColor: 'var(--color-bg-console)' }}>
      {/* タブバー */}
      <div style={{ display: 'flex', height: '36px', flexShrink: 0,
        borderBottom: '1px solid var(--color-border)' }}>
        {mode === 'logic' && tabBtn('timing',     <BarChart2 size={12} />, 'タイミングチャート')}
        {mode === 'logic' && tabBtn('truthtable', <Table2    size={12} />, '真理値表')}
        {mode === 'quantum' && tabBtn('quantumResult', <BarChart2 size={12} />, '量子計算結果')}
        {tabBtn('ai',         <MessageSquare size={12} />, 'AI コンソール')}
      </div>
      {/* コンテンツ */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'timing'     && mode === 'logic' && <TimingChart />}
        {tab === 'truthtable' && mode === 'logic' && <TruthTable />}
        {tab === 'quantumResult' && mode === 'quantum' && <QuantumResultsPanel />}
        {tab === 'ai'         && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '8px', opacity: 0.4 }}>
            <MessageSquare size={28} style={{ color: 'var(--color-accent-blue)' }} />
            <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              AI コンソールは右サイドバーの「AI チャット」タブをご利用ください
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================
// 右サイドバー（状態モニタ / AI チャット タブ）
// ============================================================
const RightSidebar: React.FC = () => {
  const [tab, setTab] = useState<'monitor' | 'chat'>('monitor');
  const tabBtn = (id: 'monitor' | 'chat', icon: React.ReactNode, label: string) => (
    <button onClick={() => setTab(id)} style={{
      display: 'flex', alignItems: 'center', gap: '5px',
      padding: '0 10px', height: '100%', fontSize: '11px', fontWeight: 600,
      color: tab === id ? 'var(--color-accent-purple)' : 'var(--color-text-muted)',
      backgroundColor: 'transparent', border: 'none',
      borderBottom: tab === id ? '2px solid var(--color-accent-purple)' : '2px solid transparent',
      cursor: 'pointer', transition: 'color 0.15s',
    }}>
      {icon}{label}
    </button>
  );
  return (
    <aside style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      backgroundColor: 'var(--color-bg-panel)', borderLeft: '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', height: '36px', flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
        {tabBtn('monitor', <Activity size={12} />, '状態モニタ')}
        {tabBtn('chat',    <MessageSquare size={12} />, 'AI チャット')}
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        {tab === 'monitor' && <StateMonitor />}
        {tab === 'chat'    && <ChatPanel />}
      </div>
    </aside>
  );
};

const LogicPanelWrapper: React.FC = () => {
  const { showLogicPanel } = useCircuitStore();
  if (!showLogicPanel) return null;
  return <LogicExpressionPanel />;
};

// ============================================================
// メインレイアウト（react-resizable-panels H 型）
// ============================================================
const DEFAULT_H  = [20, 58, 22] as const;   // left / center / right (%)
const DEFAULT_V  = [68, 32]     as const;   // canvas / console (%)

const MainLayout: React.FC = () => {
  const mainRef = useGroupRef();
  const vertRef = useGroupRef();
  const mode = useCircuitStore((s) => s.mode);

  const resetLayout = useCallback(() => {
    mainRef.current?.setLayout({ 'left': DEFAULT_H[0], 'center': DEFAULT_H[1], 'right': DEFAULT_H[2] });
    vertRef.current?.setLayout({ 'canvas': DEFAULT_V[0], 'console': DEFAULT_V[1] });
  }, [mainRef, vertRef]);

  return (
    <div data-theme={mode} style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <AppHeader onResetLayout={resetLayout} />

      <ReactFlowProvider>
        <div style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <PanelGroup
            groupRef={mainRef}
            id="main"
            orientation="horizontal"
            style={{ height: '100%' }}
          >
            {/* 左パレット — maxSize なし、minSize=5 */}
            <Panel id="left" defaultSize={DEFAULT_H[0]} minSize={5}
              style={{ overflow: 'hidden' }}>
              <GatePalette />
            </Panel>

            <HorizHandle />

            {/* 中央（キャンバス上 / コンソール下） */}
            <Panel id="center" defaultSize={DEFAULT_H[1]} minSize={20} style={{ overflow: 'hidden' }}>
              <PanelGroup groupRef={vertRef} orientation="vertical" style={{ height: '100%' }}>
                <Panel id="canvas" defaultSize={DEFAULT_V[0]} minSize={10} style={{ overflow: 'hidden', position: 'relative' }}>
                  {mode === 'logic' ? <CircuitCanvas /> : <QuantumCircuitCanvas />}
                  <LogicPanelWrapper />
                </Panel>
                <VertHandle />
                <Panel id="console" defaultSize={DEFAULT_V[1]} minSize={5} style={{ overflow: 'hidden' }}>
                  <BottomConsole />
                </Panel>
              </PanelGroup>
            </Panel>

            <HorizHandle />

            {/* 右サイドバー — maxSize なし、minSize=5 */}
            <Panel id="right" defaultSize={DEFAULT_H[2]} minSize={5}
              style={{ overflow: 'hidden' }}>
              <RightSidebar />
            </Panel>
          </PanelGroup>

        </div>
      </ReactFlowProvider>
    </div>
  );
};


export default MainLayout;
