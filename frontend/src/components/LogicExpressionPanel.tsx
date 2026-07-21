import React, { useState } from 'react';
import { Sigma, Copy, Check } from 'lucide-react';
import useCircuitStore from '../store/useCircuitStore';

const LogicExpressionPanel: React.FC = () => {
  const logicExpressions = useCircuitStore((s) => s.logicExpressions);
  const nodes = useCircuitStore((s) => s.nodes);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!logicExpressions || Object.keys(logicExpressions).length === 0) {
    return null;
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{
      position: 'absolute', top: '80px', right: '20px', zIndex: 10,
      width: '320px', maxHeight: '400px', overflowY: 'auto',
      backgroundColor: 'var(--color-bg-panel)',
      border: '1px solid var(--color-border)',
      borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: '8px',
        backgroundColor: 'rgba(91,141,246,0.05)'
      }}>
        <Sigma size={16} color="#5b8df6" />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>論理式 (AST)</span>
      </div>

      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {Object.entries(logicExpressions).map(([nodeId, expr]) => {
          const node = nodes.find(n => n.id === nodeId);
          const label = String(node?.data.params?.label || node?.data.label || node?.data.gateType || nodeId.slice(0, 8));
          return (
            <div key={nodeId} style={{
              backgroundColor: 'var(--color-bg-console)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px', padding: '10px'
            }}>
              <div style={{
                fontSize: '11px', fontWeight: 600, color: '#94a3b8',
                marginBottom: '6px', display: 'flex', justifyContent: 'space-between'
              }}>
                <span>{label}</span>
                <button onClick={() => handleCopy(expr.latex, nodeId)}
                  style={{
                    background: 'none', border: 'none', color: copiedId === nodeId ? '#22d3a0' : '#64748b',
                    cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center'
                  }} title="LaTeXをコピー">
                  {copiedId === nodeId ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <div style={{
                fontSize: '13px', fontFamily: 'var(--font-mono)', color: '#7dd3fc',
                whiteSpace: 'nowrap', overflowX: 'auto',
                lineHeight: 1.5, paddingBottom: '4px'
              }}>
                {expr.text}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LogicExpressionPanel;
