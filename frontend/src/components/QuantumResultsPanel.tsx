import React from 'react';
import useCircuitStore from '../store/useCircuitStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const QuantumResultsPanel: React.FC = () => {
  const { quantumSimulationResult } = useCircuitStore();

  if (!quantumSimulationResult) {
    return (
      <div style={{
        height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--color-text-muted)', fontSize: '13px'
      }}>
        シミュレーションを実行すると結果が表示されます
      </div>
    );
  }

  const { counts, statevector, error } = quantumSimulationResult;

  if (error) {
    return (
      <div style={{ padding: '20px', color: '#ef4444' }}>
        <strong>Error:</strong> {error}
      </div>
    );
  }

  // counts がある場合、Recharts 用のデータに変換
  const data = counts 
    ? Object.keys(counts).map(key => ({ state: key, count: counts[key] }))
    : [];

  return (
    <div style={{ display: 'flex', height: '100%', padding: '20px', gap: '20px', overflowY: 'auto' }}>
      {/* ヒストグラム */}
      <div style={{ flex: 1, minWidth: '300px', backgroundColor: 'var(--color-bg-card)', padding: '15px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '15px', color: 'var(--color-text-primary)' }}>測定結果 (Counts)</h3>
        {data.length > 0 ? (
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <XAxis dataKey="state" stroke="var(--color-text-muted)" fontSize={12} />
                <YAxis stroke="var(--color-text-muted)" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--color-bg-panel)', borderColor: 'var(--color-border)' }}
                  itemStyle={{ color: 'var(--color-accent-purple)' }}
                />
                <Bar dataKey="count" fill="var(--color-accent-purple)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>測定ゲート(M)がありません</div>
        )}
      </div>

      {/* 状態ベクトルなど */}
      {statevector && (
        <div style={{ flex: 1, minWidth: '300px', backgroundColor: 'var(--color-bg-card)', padding: '15px', borderRadius: '8px', border: '1px solid var(--color-border)', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '15px', color: 'var(--color-text-primary)' }}>状態ベクトル</h3>
          <div style={{ 
            fontFamily: 'var(--font-mono)', fontSize: '12px', 
            color: 'var(--color-text-secondary)', lineHeight: 1.6,
            wordBreak: 'break-all'
          }}>
            {statevector.map((val: any, idx: number) => {
              // Python側で "{complex(v):.3f}" とフォーマットされた文字列が渡ってくる
              const valStr = String(val).replace(/[()j]/g, '').replace(/\+/g, ' + ').replace(/(?<!e)-/g, ' - ');
              return (
                <div key={idx} style={{ display: 'flex', gap: '10px' }}>
                  <span style={{ color: '#a855f7' }}>|{idx.toString(2).padStart(Math.max(1, Math.log2(statevector.length)), '0')}⟩</span>
                  <span>{valStr}i</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuantumResultsPanel;
