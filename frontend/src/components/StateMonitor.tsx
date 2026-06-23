// StateMonitor.tsx — 量子状態・エッジ状態モニタ
import React from 'react';
import { Activity } from 'lucide-react';
import useCircuitStore from '../store/useCircuitStore';

const StateMonitor: React.FC = () => {
  const results = useCircuitStore((s) => s.simulationResults);
  const nodes   = useCircuitStore((s) => s.nodes);

  if (!results) {
    return (
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', opacity:0.3 }}>
        <Activity size={28} style={{ color:'var(--color-accent-purple)' }} />
        <p style={{ fontSize:'11px', color:'var(--color-text-muted)', textAlign:'center', padding:'0 12px' }}>
          「▶ チャート生成」を実行するとシミュレーション結果が表示されます
        </p>
      </div>
    );
  }

  const { edgeStates, quantumState } = results;
  const probs: Record<string,number> = (quantumState as any)?.probabilities ?? {};
  const nQubits: number = (quantumState as any)?.n_qubits ?? 0;
  const depth: number   = (quantumState as any)?.circuit_depth ?? 0;
  const labelMap: Record<string,string> = {};
  (Array.isArray(nodes) ? nodes : []).forEach(n => { labelMap[n.id] = n.data.label || n.data.gateType; });

  const edgeEntries = Object.entries(edgeStates);
  const probEntries = Object.entries(probs).sort((a,b) => b[1]-a[1]);
  const maxProb = probEntries[0]?.[1] ?? 1;

  const sectionTitle = (t: string) => (
    <div style={{ fontSize:'9px', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
      color:'var(--color-text-muted)', padding:'8px 12px 4px', borderTop:'1px solid var(--color-border)' }}>
      {t}
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:'auto', display:'flex', flexDirection:'column' }}>

      {/* エッジ状態 */}
      {sectionTitle('エッジ状態 (High/Low)')}
      {edgeEntries.length === 0
        ? <p style={{ fontSize:'10px', color:'var(--color-text-muted)', padding:'4px 12px' }}>エッジなし</p>
        : edgeEntries.map(([eid, val]) => (
          <div key={eid} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'3px 12px' }}>
            <div style={{
              width:'8px', height:'8px', borderRadius:'50%', flexShrink:0,
              backgroundColor: val===1 ? '#22d3a0' : '#3a3f6e',
              boxShadow: val===1 ? '0 0 6px #22d3a0' : 'none',
              transition:'all 0.2s',
            }} />
            <span style={{ fontSize:'10px', fontFamily:'var(--font-mono)', color:'var(--color-text-secondary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {eid.slice(0,18)}
            </span>
            <span style={{ fontSize:'10px', fontWeight:700, fontFamily:'var(--font-mono)', color: val===1 ? '#22d3a0' : '#475569' }}>
              {val===1 ? 'HIGH' : 'LOW'}
            </span>
          </div>
        ))
      }

      {/* 量子状態確率分布 */}
      {sectionTitle(`量子状態 (${nQubits}クビット, 深さ${depth})`)}
      {probEntries.length === 0
        ? <p style={{ fontSize:'10px', color:'var(--color-text-muted)', padding:'4px 12px' }}>量子ゲートなし</p>
        : probEntries.map(([state, prob]) => (
          <div key={state} style={{ padding:'3px 12px 4px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'2px' }}>
              <span style={{ fontSize:'10px', fontFamily:'var(--font-mono)', color:'#c084fc' }}>|{state}⟩</span>
              <span style={{ fontSize:'10px', fontFamily:'var(--font-mono)', color:'var(--color-text-secondary)' }}>
                {(prob*100).toFixed(1)}%
              </span>
            </div>
            {/* CSS 棒グラフ */}
            <div style={{ height:'6px', borderRadius:'3px', backgroundColor:'rgba(168,85,247,0.15)', overflow:'hidden' }}>
              <div style={{
                height:'100%',
                width:`${(prob/maxProb)*100}%`,
                borderRadius:'3px',
                background:'linear-gradient(90deg, #7c3aed, #a855f7)',
                boxShadow:'0 0 6px rgba(168,85,247,0.5)',
                transition:'width 0.4s ease',
              }} />
            </div>
          </div>
        ))
      }

      {/* 量子回路エラー表示 */}
      {(quantumState as any)?.error && (
        <p style={{ fontSize:'9px', color:'#f87171', padding:'4px 12px', fontFamily:'var(--font-mono)' }}>
          ⚠ {String((quantumState as any).error).slice(0,80)}
        </p>
      )}
    </div>
  );
};

export default StateMonitor;
