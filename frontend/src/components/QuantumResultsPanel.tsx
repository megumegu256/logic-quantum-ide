import React, { useState, useMemo } from 'react';
import useCircuitStore from '../store/useCircuitStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2, CircleDashed, ListTree, ArrowDownUp } from 'lucide-react';

// --- Types ---
type Tab = 'process' | 'counts' | 'phase' | 'statevector';
type SortMode = 'basis' | 'frequency';
type DisplayMode = 'rect' | 'polar' | 'root';

interface StateData {
  basisStr: string;
  real: number;
  imag: number;
  magnitude: number;
  phase: number;
  probability: number;
}

// --- Utils ---
const parseComplex = (valStr: string): { real: number, imag: number } => {
  const cleanStr = String(valStr).replace(/[() j]/g, '');
  if (!cleanStr) return { real: 0, imag: 0 };
  const match = cleanStr.match(/^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)(?:([+-]\d*\.?\d+(?:e[+-]?\d+)?))?$/);
  if (match) {
    const real = parseFloat(match[1]);
    const imag = match[2] ? parseFloat(match[2]) : 0;
    return { real, imag };
  }
  return { real: 0, imag: 0 };
};

const parseStatevector = (sv: any[]): StateData[] => {
  if (!sv) return [];
  const numBits = Math.max(1, Math.log2(sv.length));
  return sv.map((val, idx) => {
    const basisStr = idx.toString(2).padStart(numBits, '0');
    const { real, imag } = parseComplex(String(val));
    const magnitude = Math.sqrt(real * real + imag * imag);
    const phase = Math.atan2(imag, real);
    const probability = magnitude * magnitude;
    return { basisStr, real, imag, magnitude, phase, probability };
  }).filter(s => s.probability > 1e-6); 
};

const formatRoot = (val: number): string => {
  if (Math.abs(val) < 1e-6) return '0';
  const sq = val * val;
  let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
  let b = sq;
  for (let i = 0; i < 15; i++) {
    let a = Math.floor(b);
    let aux = h1; h1 = a * h1 + h2; h2 = aux;
    aux = k1; k1 = a * k1 + k2; k2 = aux;
    b = 1 / (b - a);
    if (Math.abs(sq - h1 / k1) < 1e-5) break;
  }
  const n = h1;
  const d = k1;
  
  if (Math.abs(sq - n / d) > 1e-4) return val.toFixed(4);

  const signStr = val < 0 ? '-' : '';
  const isPerfectSquare = (x: number) => Number.isInteger(Math.sqrt(x));
  
  const numStr = isPerfectSquare(n) ? Math.sqrt(n).toString() : `√${n}`;
  const denStr = isPerfectSquare(d) ? Math.sqrt(d).toString() : `√${d}`;
  
  if (d === 1) return `${signStr}${numStr}`;
  if (numStr === '0') return '0';
  return `${signStr}${numStr}/${denStr}`;
};

const formatComplexRoot = (real: number, imag: number): string => {
  const r = formatRoot(real);
  const i = formatRoot(imag);
  
  if (r === '0' && i === '0') return '0';
  if (r === '0') return i === '1' ? 'i' : i === '-1' ? '-i' : `${i}i`;
  if (i === '0') return r;
  
  const iStr = i === '1' ? 'i' : i === '-1' ? '-i' : `${i}i`;
  if (imag > 0) return `${r} + ${iStr}`;
  return `${r} - ${iStr.startsWith('-') ? iStr.substring(1) : iStr}`;
};

// --- Components ---
const QuantumResultsPanel: React.FC = () => {
  const { quantumSimulationResult } = useCircuitStore();
  const [activeTab, setActiveTab] = useState<Tab>('counts');
  const [sortMode, setSortMode] = useState<SortMode>('basis');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('rect');

  const { counts, statevector, error, measured_qubits, calc_steps } = quantumSimulationResult || {};

  const filteredStatevector = useMemo(() => {
    return parseStatevector(statevector || []);
  }, [statevector]);

  const countsData = useMemo(() => {
    if (!counts) return [];
    
    // 集計用マップ (フォーマット済みの文字列 -> カウント)
    const aggregatedCounts: Record<string, number> = {};
    
    Object.entries(counts).forEach(([state, count]) => {
      let formattedState = state;
      // 測定されたビットのみを表示し、測定されていないビットは "_" でマスクする
      if (measured_qubits && measured_qubits.length > 0) {
        let masked = "";
        for (let i = 0; i < state.length; i++) {
          const qIndex = state.length - 1 - i; // Qiskitの出力は右端がq0
          if (measured_qubits.includes(qIndex)) {
            masked += state[i];
          } else {
            masked += "_";
          }
        }
        formattedState = masked;
      }
      aggregatedCounts[formattedState] = (aggregatedCounts[formattedState] || 0) + (count as number);
    });

    const data = Object.entries(aggregatedCounts).map(([state, count]) => ({ state, count }));
    
    if (sortMode === 'frequency') {
      data.sort((a, b) => b.count - a.count);
    } else {
      data.sort((a, b) => a.state.localeCompare(b.state));
    }
    return data;
  }, [counts, sortMode, measured_qubits]);

  const totalShots = useMemo(() => countsData.reduce((acc, curr) => acc + curr.count, 0), [countsData]);

  if (!quantumSimulationResult) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
        シミュレーションを実行すると結果が表示されます
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#ef4444', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  const tabButtonStyle = (isActive: boolean) => ({
    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', fontSize: '12px', fontWeight: 600,
    color: isActive ? 'var(--color-accent-purple)' : 'var(--color-text-muted)',
    backgroundColor: isActive ? 'rgba(168,85,247,0.1)' : 'transparent',
    border: 'none', borderBottom: isActive ? '2px solid var(--color-accent-purple)' : '2px solid transparent',
    cursor: 'pointer', transition: 'all 0.2s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--color-bg-base)' }}>
      {/* タブヘッダー */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 10px' }}>
        <button style={tabButtonStyle(activeTab === 'process')} onClick={() => setActiveTab('process')}>
          <ListTree size={14} /> 計算過程
        </button>
        <button style={tabButtonStyle(activeTab === 'counts')} onClick={() => setActiveTab('counts')}>
          <BarChart2 size={14} /> Counts
        </button>
        <button style={tabButtonStyle(activeTab === 'phase')} onClick={() => setActiveTab('phase')}>
          <CircleDashed size={14} /> Phase Disks
        </button>
        <button style={tabButtonStyle(activeTab === 'statevector')} onClick={() => setActiveTab('statevector')}>
          <ListTree size={14} /> Statevector
        </button>
      </div>

      {/* タブコンテンツ */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        
        {/* Process タブ */}
        {activeTab === 'process' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {calc_steps && calc_steps.length > 0 ? (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-primary)' }}>回路の計算過程</h3>
                  {calc_steps.map((step: any, idx: number) => {
                    const sv = parseStatevector(step.statevector);
                    const diracStr = sv.map(s => {
                      const coeff = formatComplexRoot(s.real, s.imag);
                      if (coeff === '1') return `|${s.basisStr}⟩`;
                      if (coeff === '-1') return `- |${s.basisStr}⟩`;
                      if (coeff === 'i') return `i|${s.basisStr}⟩`;
                      if (coeff === '-i') return `-i|${s.basisStr}⟩`;
                      return `(${coeff})|${s.basisStr}⟩`;
                    }).join(' + ');

                    const gateDesc = (() => {
                      const isCtrl = step.label.includes('(ctrl)');
                      if (step.label.includes('→ H')) return '重ね合わせ状態を作る（|0⟩ → |+⟩, |1⟩ → |-⟩）';
                      if (step.label.includes('→ X') && !step.label.includes('→ CX') && !step.label.includes('→ MCX') && !step.label.includes('→ CCX')) return 'ビット反転（|0⟩ → |1⟩, |1⟩ → |0⟩）';
                      if (step.label.includes('→ Y')) return 'ビットと位相を反転（|0⟩ → i|1⟩, |1⟩ → -i|0⟩）';
                      if (step.label.includes('→ Z') && !step.label.includes('→ CZ') && !step.label.includes('→ MCZ') && !step.label.includes('→ CCZ')) return '位相反転（|0⟩ → |0⟩, |1⟩ → - |1⟩）';
                      if (step.label.includes('→ S')) return 'π/2 位相反転（|0⟩ → |0⟩, |1⟩ → i|1⟩）';
                      if (step.label.includes('→ T')) return 'π/4 位相反転（|0⟩ → |0⟩, |1⟩ → e^(iπ/4)|1⟩）';
                      if (step.label.includes('→ CX')) {
                        if (isCtrl) return '制御X（CNOT）。制御が |1⟩ のとき、標的のビットを反転（例: ctrl=|1⟩, tgt=|0⟩ のとき |10⟩ → |11⟩）';
                        return 'ビット反転（|0⟩ → |1⟩, |1⟩ → |0⟩）';
                      }
                      if (step.label.includes('→ CZ')) {
                        if (isCtrl) return '制御Z。両方が |1⟩ のとき、状態全体に -1 の位相をかける（|11⟩ → - |11⟩。※位相は特定のビットではなく全体につきます）';
                        return '位相反転（|0⟩ → |0⟩, |1⟩ → - |1⟩）';
                      }
                      if (step.label.includes('→ CCX') || step.label.includes('→ MCX')) return 'トフォリ（制御X）。全ての制御が |1⟩ のとき、標的を反転';
                      if (step.label.includes('→ CCZ') || step.label.includes('→ MCZ')) return '制御Z。全ての制御が |1⟩ のとき、位相を反転';
                      return '';
                    })();
                    
                    const formatQubitState = (qs: any) => {
                      if (typeof qs === 'string') return qs === 'ENTANGLED' ? 'もつれ状態 (Entangled)' : qs;
                      if (Array.isArray(qs)) {
                        const parsed = parseStatevector(qs);
                        return parsed.map(s => {
                          const coeff = formatComplexRoot(s.real, s.imag);
                          if (coeff === '1') return `    |${s.basisStr}⟩`;
                          if (coeff === '-1') return ` -  |${s.basisStr}⟩`;
                          if (coeff === 'i') return `  i |${s.basisStr}⟩`;
                          if (coeff === '-i') return ` -i |${s.basisStr}⟩`;
                          return `(${coeff})|${s.basisStr}⟩`;
                        }).join(' + ') || '0';
                      }
                      return 'Unknown';
                    };

                    const prev_qubits_state = idx > 0 ? calc_steps[idx - 1].qubits_state : null;

                    return (
                      <div key={idx} style={{ padding: '12px', backgroundColor: 'var(--color-bg-panel)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                          {idx + 1}. {step.label}
                        </div>
                        {gateDesc && (
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                            {gateDesc}
                          </div>
                        )}
                        {step.qubits_state && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                            {step.qubits_state.map((qs: any, qidx: number) => {
                              const fQs = formatQubitState(qs);
                              const fPrevQs = prev_qubits_state ? formatQubitState(prev_qubits_state[qidx]) : null;
                              return (
                                <div key={qidx} style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>
                                  {fPrevQs ? `q${qidx}: ${fPrevQs} → ${fQs}` : `q${qidx}: ${fQs}`}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-accent-purple)', wordBreak: 'break-all', borderTop: '1px dashed var(--color-border)', paddingTop: '8px' }}>
                          全体: {diracStr || '0'}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--color-text-primary)', borderTop: '1px solid var(--color-border)', paddingTop: '20px' }}>出力結果</h3>
                  <div style={{ padding: '12px', backgroundColor: 'rgba(168,85,247,0.05)', borderRadius: '6px', border: '1px solid rgba(168,85,247,0.2)' }}>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', marginBottom: '10px' }}>
                      この回路を測定すると、以下の確率で状態が観測されます。
                    </div>
                    {filteredStatevector.map(state => (
                      <div key={state.basisStr} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0' }}>
                        <div style={{ width: '60px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-accent-purple)' }}>
                          |{state.basisStr}⟩
                        </div>
                        <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--color-bg-panel)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${state.probability * 100}%`, height: '100%', backgroundColor: 'var(--color-accent-purple)', borderRadius: '4px' }} />
                        </div>
                        <div style={{ width: '50px', textAlign: 'right', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {(state.probability * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '20px' }}>
                計算過程のデータがありません。
              </div>
            )}
          </div>
        )}

        {/* Counts タブ */}
        {activeTab === 'counts' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSortMode(s => s === 'basis' ? 'frequency' : 'basis')}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '11px',
                backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: '4px',
                color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                <ArrowDownUp size={12} /> {sortMode === 'basis' ? '状態名順' : '頻度順'}
              </button>
            </div>
            {countsData.length > 0 ? (
              <div style={{ flex: 1, minHeight: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countsData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="state" stroke="var(--color-text-muted)" fontSize={12} tickMargin={10} />
                    <YAxis stroke="var(--color-text-muted)" fontSize={12} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(168,85,247,0.05)' }}
                      contentStyle={{ backgroundColor: 'var(--color-bg-panel)', borderColor: 'var(--color-border)', borderRadius: '6px' }}
                      itemStyle={{ color: 'var(--color-text-primary)' }}
                      formatter={(value: number) => [`${value} (${((value / totalShots) * 100).toFixed(1)}%)`, 'Count']}
                    />
                    <Bar dataKey="count" fill="var(--color-accent-purple)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                測定ゲート(M)がないため、Countsデータはありません。
              </div>
            )}
          </div>
        )}

        {/* Phase Disks タブ */}
        {activeTab === 'phase' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignContent: 'flex-start' }}>
            {filteredStatevector.length > 0 ? filteredStatevector.map(state => {
              const maxRadius = 32;
              const fillRadius = maxRadius * state.magnitude;
              
              const lineX = maxRadius + maxRadius * Math.cos(state.phase);
              const lineY = maxRadius - maxRadius * Math.sin(state.phase);

              return (
                <div key={state.basisStr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <svg width={maxRadius * 2} height={maxRadius * 2} viewBox={`0 0 ${maxRadius * 2} ${maxRadius * 2}`}>
                    <circle cx={maxRadius} cy={maxRadius} r={maxRadius} fill="var(--color-bg-panel)" stroke="var(--color-border)" strokeWidth="1" />
                    <circle cx={maxRadius} cy={maxRadius} r={fillRadius} fill="rgba(168,85,247,0.5)" />
                    <line x1={maxRadius} y1={maxRadius} x2={lineX} y2={lineY} stroke="var(--color-accent-purple)" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    |{state.basisStr}⟩
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                    {(state.probability * 100).toFixed(1)}%
                  </div>
                </div>
              );
            }) : (
              <div style={{ width: '100%', textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '20px' }}>
                有効な状態ベクトルデータがありません。
              </div>
            )}
          </div>
        )}

        {/* Statevector タブ */}
        {activeTab === 'statevector' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setDisplayMode(d => d === 'rect' ? 'polar' : d === 'polar' ? 'root' : 'rect')}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '11px',
                backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: '4px',
                color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                <ArrowDownUp size={12} /> {displayMode === 'rect' ? '極座標へ切替' : displayMode === 'polar' ? 'ルート表示へ切替' : '直交座標へ切替'}
              </button>
            </div>
            
            {filteredStatevector.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                {filteredStatevector.map(state => (
                  <div key={state.basisStr} style={{
                    padding: '10px 12px', backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border)',
                    borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '4px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-accent-purple)', fontFamily: 'var(--font-mono)' }}>
                      |{state.basisStr}⟩
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {displayMode === 'rect' ? (
                        <>
                          {state.real.toFixed(4)} {state.imag >= 0 ? '+' : '-'} {Math.abs(state.imag).toFixed(4)}i
                        </>
                      ) : displayMode === 'polar' ? (
                        <>
                          {state.magnitude.toFixed(4)} e<sup>i{(state.phase / Math.PI).toFixed(2)}π</sup>
                        </>
                      ) : (
                        <>
                          {formatComplexRoot(state.real, state.imag)}
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      Prob: {(state.probability * 100).toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ width: '100%', textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '20px' }}>
                有効な状態ベクトルデータがありません。
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuantumResultsPanel;
