import React, { useState, useMemo } from 'react';
import useCircuitStore from '../store/useCircuitStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart2, CircleDashed, ListTree, ArrowDownUp } from 'lucide-react';

// --- Types ---
type Tab = 'counts' | 'phase' | 'statevector';
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

  const { counts, statevector, error } = quantumSimulationResult || {};

  const filteredStatevector = useMemo(() => {
    return parseStatevector(statevector || []);
  }, [statevector]);

  const countsData = useMemo(() => {
    if (!counts) return [];
    const data = Object.entries(counts).map(([state, count]) => ({ state, count: count as number }));
    if (sortMode === 'frequency') {
      data.sort((a, b) => b.count - a.count);
    } else {
      data.sort((a, b) => a.state.localeCompare(b.state));
    }
    return data;
  }, [counts, sortMode]);

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
