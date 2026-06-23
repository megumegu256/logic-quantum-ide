import React, { useState, useEffect } from 'react';
import useCircuitStore from '../store/useCircuitStore';
import { X } from 'lucide-react';

const NodePropertyEditor: React.FC = () => {
  const { editingNodeId, nodes, setEditingNodeId, updateNodeData } = useCircuitStore();
  const [label, setLabel] = useState('');
  const [pulseInterval, setPulseInterval] = useState('2');
  const [posX, setPosX] = useState('');
  const [posY, setPosY] = useState('');

  const editingNode = nodes.find(n => n.id === editingNodeId);

  useEffect(() => {
    if (editingNode) {
      setLabel((editingNode.data.params?.label as string) ?? '');
      setPulseInterval(String(editingNode.data.params?.pulseInterval ?? '2'));
      setPosX(String(Math.round(editingNode.position.x)));
      setPosY(String(Math.round(editingNode.position.y)));
    }
  }, [editingNode]);

  if (!editingNodeId || !editingNode) return null;

  const handleSave = () => {
    updateNodeData(editingNodeId, {
      params: {
        ...(editingNode.data.params ?? {}),
        label: label || undefined,
        pulseInterval: editingNode.data.gateType === 'Clock' ? parseInt(pulseInterval, 10) || 1 : undefined,
      }
    });
    
    const newX = parseFloat(posX);
    const newY = parseFloat(posY);
    if (!isNaN(newX) && !isNaN(newY)) {
      useCircuitStore.getState().updateNodePosition(editingNodeId, newX, newY);
    }
    
    setEditingNodeId(null);
  };

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{
        width: '300px', backgroundColor: '#1a1d2e', border: '1px solid #3a3f6e',
        borderRadius: '12px', padding: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: '#fff' }}>プロパティ設定</h3>
          <button onClick={() => setEditingNodeId(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
            変数名 / ラベル
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="例: A, B, Cin"
              style={{
                width: '100%', marginTop: '4px', padding: '6px', fontSize: '12px',
                backgroundColor: '#0a0c16', border: '1px solid #3a3f6e', borderRadius: '4px', color: '#fff'
              }}
            />
          </label>

          {editingNode.data.gateType === 'Clock' && (
            <label style={{ fontSize: '12px', color: '#cbd5e1' }}>
              パルス間隔 (Tick)
              <input
                type="number"
                min="1"
                value={pulseInterval}
                onChange={e => setPulseInterval(e.target.value)}
                style={{
                  width: '100%', marginTop: '4px', padding: '6px', fontSize: '12px',
                  backgroundColor: '#0a0c16', border: '1px solid #3a3f6e', borderRadius: '4px', color: '#fff'
                }}
              />
            </label>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: '#cbd5e1', flex: 1 }}>
              X座標
              <input
                type="number"
                value={posX}
                onChange={e => setPosX(e.target.value)}
                style={{
                  width: '100%', marginTop: '4px', padding: '6px', fontSize: '12px',
                  backgroundColor: '#0a0c16', border: '1px solid #3a3f6e', borderRadius: '4px', color: '#fff'
                }}
              />
            </label>
            <label style={{ fontSize: '12px', color: '#cbd5e1', flex: 1 }}>
              Y座標
              <input
                type="number"
                value={posY}
                onChange={e => setPosY(e.target.value)}
                style={{
                  width: '100%', marginTop: '4px', padding: '6px', fontSize: '12px',
                  backgroundColor: '#0a0c16', border: '1px solid #3a3f6e', borderRadius: '4px', color: '#fff'
                }}
              />
            </label>
          </div>

          <button onClick={handleSave} style={{
            marginTop: '8px', padding: '8px', width: '100%', backgroundColor: '#5b8df6',
            color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600
          }}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default NodePropertyEditor;
