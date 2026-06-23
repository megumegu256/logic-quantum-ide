// TruthTable.tsx — 真理値表の自動生成・表示コンポーネント
import React, { useState } from 'react';
import { Table2, Loader2, AlertCircle } from 'lucide-react';
import useCircuitStore from '../store/useCircuitStore';

const API = 'http://localhost:8000';

interface TruthTableData {
  inputLabels:  string[];
  outputLabels: string[];
  rows: { inputs: Record<string,number>; outputs: Record<string,number> }[];
  error?: string;
}

const TruthTable: React.FC = () => {
  const nodes         = useCircuitStore((s) => s.nodes);
  const edges         = useCircuitStore((s) => s.edges);
  const customModules = useCircuitStore((s) => s.customModules);
  const [data,      setData]      = useState<TruthTableData | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [fetchErr,  setFetchErr]  = useState<string | null>(null);

  const nSwitch = nodes.filter((n) => n.data.gateType === 'Switch' || n.data.gateType === 'Clock').length;
  const nLed    = nodes.filter((n) => n.data.gateType === 'LED' || n.data.gateType === 'SevenSeg').length;
  const tooMany = nSwitch > 8;
  const canAnalyze = !loading && !tooMany && nSwitch > 0;

  const analyze = async () => {
    if (!canAnalyze) return;
    setLoading(true); setFetchErr(null);
    try {
      const res = await fetch(`${API}/api/truthtable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, customModules }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TruthTableData = await res.json();
      setData(json);
      if (json.error) setFetchErr(json.error);
    } catch (e) {
      setFetchErr(`通信エラー: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const cell: React.CSSProperties = {
    padding: '5px 12px', fontSize: '11px', fontFamily: 'var(--font-mono)',
    fontWeight: 600, textAlign: 'center', borderBottom: '1px solid var(--color-border)',
    whiteSpace: 'nowrap',
  };
  const hcell: React.CSSProperties = {
    ...cell, fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
    color: 'var(--color-text-muted)', textTransform: 'uppercase',
    backgroundColor: 'rgba(91,141,246,0.06)', position: 'sticky', top: 0,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ヘッダーバー */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px',
        flexShrink: 0, borderBottom: '1px solid var(--color-border)' }}>
        <Table2 size={13} style={{ color: 'var(--color-accent-purple)' }} />
        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', flex: 1, fontFamily: 'var(--font-mono)' }}>
          Switch/Clock {nSwitch}入力 / LED {nLed}出力 — {tooMany ? '⚠ 8bit 以下にしてください' : nSwitch === 0 ? 'Switch/Clockを配置してください' : `${Math.pow(2, nSwitch)} 行`}
        </span>
        <button
          onClick={analyze}
          disabled={!canAnalyze}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '3px 12px', height: '26px', fontSize: '11px', fontWeight: 600,
            color: '#a855f7', backgroundColor: 'rgba(168,85,247,0.10)',
            border: '1px solid rgba(168,85,247,0.4)', borderRadius: '6px',
            cursor: canAnalyze ? 'pointer' : 'not-allowed',
            opacity: canAnalyze ? 1 : 0.45,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { if (canAnalyze) (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(168,85,247,0.22)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(168,85,247,0.10)'; }}
        >
          {loading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Table2 size={12} />}
          {loading ? '解析中...' : '🔍 解析'}
        </button>
      </div>

      {/* エラー */}
      {fetchErr && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px',
          color: '#f87171', fontSize: '11px', backgroundColor: 'rgba(248,113,113,0.08)',
          borderBottom: '1px solid rgba(248,113,113,0.2)' }}>
          <AlertCircle size={13} />{fetchErr}
        </div>
      )}

      {/* 空状態 */}
      {!data && !loading && !fetchErr && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '8px', opacity: 0.4 }}>
          <Table2 size={28} style={{ color: 'var(--color-accent-purple)' }} />
          <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
            「解析」ボタンで Switch/LED の真理値表を生成します
          </p>
        </div>
      )}

      {/* テーブル */}
      {data && !data.error && data.rows.length > 0 && (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {data.inputLabels.map((l) => (
                  <th key={l} style={{ ...hcell, color: '#7eb3fa', borderRight: '1px solid var(--color-border)' }}>{l}</th>
                ))}
                {data.outputLabels.map((l) => (
                  <th key={l} style={{ ...hcell, color: '#22d3a0' }}>{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  {data.inputLabels.map((l) => (
                    <td key={l} style={{
                      ...cell,
                      color: row.inputs[l] === 1 ? '#7eb3fa' : 'var(--color-text-muted)',
                      borderRight: '1px solid var(--color-border)',
                    }}>
                      {row.inputs[l]}
                    </td>
                  ))}
                  {data.outputLabels.map((l) => (
                    <td key={l} style={{
                      ...cell,
                      color: row.outputs[l] === 1 ? '#22d3a0' : '#475569',
                      fontWeight: row.outputs[l] === 1 ? 700 : 500,
                    }}>
                      {row.outputs[l] === 1
                        ? <span style={{ color: '#22d3a0' }}>1 ✓</span>
                        : <span style={{ color: '#475569' }}>0</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TruthTable;
