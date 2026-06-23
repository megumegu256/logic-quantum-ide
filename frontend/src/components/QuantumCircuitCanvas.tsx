import React, { useState, useEffect, useCallback, useRef } from 'react';
import useCircuitStore, { type QuantumGate } from '../store/useCircuitStore';
import { QUANTUM_GATES } from './GatePalette';

const QuantumCircuitCanvas: React.FC = () => {
  const { 
    quantumGrid, quantumNumQubits, quantumNumSlots, 
    setQuantumGrid, setQuantumNumQubits,
    pushQuantumHistory, undoQuantum, redoQuantum
  } = useCircuitStore();

  const [dragOverCell, setDragOverCell] = useState<{ q: number; s: number } | null>(null);
  const [draggingGate, setDraggingGate] = useState<{ q: number; s: number } | null>(null);
  const [selectedCells, setSelectedCells] = useState<{ q: number; s: number }[]>([]);
  const [quantumClipboard, setQuantumClipboard] = useState<{qOffset: number; sOffset: number; gate: QuantumGate}[]>([]);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input field
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedCells.length > 0) {
          pushQuantumHistory();
          const newGrid = [...quantumGrid.map(row => [...row])];
          selectedCells.forEach(cell => {
            newGrid[cell.q][cell.s] = null;
          });
          setQuantumGrid(newGrid);
          setSelectedCells([]);
        }
      } else if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'a':
            e.preventDefault();
            const allSelected: {q: number, s: number}[] = [];
            for (let q = 0; q < quantumGrid.length; q++) {
              for (let s = 0; s < quantumNumSlots; s++) {
                if (quantumGrid[q][s]) {
                  allSelected.push({ q, s });
                }
              }
            }
            setSelectedCells(allSelected);
            break;
          case 'c':
            if (selectedCells.length > 0) {
              const expanded = [...selectedCells];
              const minQ = Math.min(...expanded.map(c => c.q));
              const minS = Math.min(...expanded.map(c => c.s));
              const items: {qOffset: number, sOffset: number, gate: QuantumGate}[] = [];
              expanded.forEach(c => {
                const gate = quantumGrid[c.q][c.s];
                if (gate) {
                  items.push({ qOffset: c.q - minQ, sOffset: c.s - minS, gate });
                }
              });
              setQuantumClipboard(items);
            }
            break;
          case 'v':
            if (quantumClipboard.length > 0) {
              let targetQ = selectedCells.length > 0 ? selectedCells[0].q : undefined;
              let targetS = selectedCells.length > 0 ? selectedCells[0].s : undefined;

              let foundPos = false;
              if (targetQ !== undefined && targetS !== undefined) {
                 for (let s = targetS; s < quantumNumSlots; s++) {
                    let canFit = true;
                    for (const item of quantumClipboard) {
                       const pasteQ = targetQ + item.qOffset;
                       const pasteS = s + item.sOffset;
                       if (pasteQ < 0 || pasteQ >= quantumGrid.length || pasteS < 0 || pasteS >= quantumNumSlots || quantumGrid[pasteQ][pasteS]) {
                          canFit = false; break;
                       }
                    }
                    if (canFit) {
                       targetS = s; foundPos = true; break;
                    }
                 }
              } else {
                 outer: for (let s = 0; s < quantumNumSlots; s++) {
                    for (let q = 0; q < quantumGrid.length; q++) {
                       let canFit = true;
                       for (const item of quantumClipboard) {
                          const pasteQ = q + item.qOffset;
                          const pasteS = s + item.sOffset;
                          if (pasteQ < 0 || pasteQ >= quantumGrid.length || pasteS < 0 || pasteS >= quantumNumSlots || quantumGrid[pasteQ][pasteS]) {
                             canFit = false; break;
                          }
                       }
                       if (canFit) {
                          targetQ = q; targetS = s; foundPos = true; break outer;
                       }
                    }
                 }
              }

              if (foundPos && targetQ !== undefined && targetS !== undefined) {
                 pushQuantumHistory();
                 const newGrid = [...quantumGrid.map(row => [...row])];
                 const pairIdMap = new Map<number, number>();
                 const newSelected: {q: number, s: number}[] = [];
                 
                 quantumClipboard.forEach(item => {
                    const pasteQ = targetQ! + item.qOffset;
                    const pasteS = targetS! + item.sOffset;
                    let newGate = { ...item.gate, id: Date.now() + Math.random() };
                    
                    if (newGate.pairId) {
                       if (!pairIdMap.has(newGate.pairId)) {
                          pairIdMap.set(newGate.pairId, Date.now() + Math.random());
                       }
                       newGate.pairId = pairIdMap.get(newGate.pairId);
                    }
                    newGrid[pasteQ][pasteS] = newGate;
                    newSelected.push({ q: pasteQ, s: pasteS });
                 });
                 
                 setQuantumGrid(newGrid);
                 setSelectedCells(newSelected);
              }
            }
            break;
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redoQuantum(); else undoQuantum();
            setSelectedCells([]);
            break;
          case 'y':
            e.preventDefault();
            redoQuantum();
            setSelectedCells([]);
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quantumGrid, selectedCells, quantumClipboard, pushQuantumHistory, undoQuantum, redoQuantum, setQuantumGrid, quantumNumSlots]);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        setScale(s => Math.min(Math.max(0.2, s - e.deltaY * 0.005), 3));
      } else {
        setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.target === e.currentTarget) {
      setIsPanning(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleDragOver = (e: React.DragEvent, qIndex: number, sIndex: number) => {
    e.preventDefault();
    setDragOverCell({ q: qIndex, s: sIndex });
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, qIndex: number, sIndex: number) => {
    e.preventDefault();
    setDragOverCell(null);
    setDraggingGate(null);

    const applyWireStraddle = (grid: any[][], q: number, s: number) => {
      const g = grid[q][s];
      if (!g) return;
      let spanningPairId: number | null = null;
      const pairIds = new Set<number>();
      for (let i = 0; i < grid.length; i++) {
        if (grid[i][s]?.pairId) pairIds.add(grid[i][s].pairId);
      }
      for (const pid of pairIds) {
        const qs: number[] = [];
        for (let i = 0; i < grid.length; i++) {
          if (grid[i][s]?.pairId === pid) qs.push(i);
        }
        if (Math.min(...qs) < q && Math.max(...qs) > q) {
          spanningPairId = pid;
          break;
        }
      }
      if (spanningPairId) {
        if (g.type === 'Z' || g.type === 'CZ') {
          g.type = 'CZ'; g.role = 'target'; g.pairId = spanningPairId;
        } else if (g.type === 'X' || g.type === 'CX') {
          g.type = 'CX'; g.role = 'target'; g.pairId = spanningPairId;
        } else if (g.role) {
          g.pairId = spanningPairId;
        }
      }
    };

    const mode = e.dataTransfer.getData('mode');
    if (mode === 'new') {
      pushQuantumHistory();
      const gateType = e.dataTransfer.getData('gateType').toUpperCase();
      const newGrid = [...quantumGrid.map(row => [...row])];
      
      if (gateType === 'CX_TARGET' || gateType === 'CZ_TARGET') {
        const typeStr = gateType === 'CX_TARGET' ? 'CX' : 'CZ';
        newGrid[qIndex][sIndex] = { type: typeStr, id: Date.now(), role: 'target', pairId: Date.now() };
      } else if (gateType === 'CTRL') {
        newGrid[qIndex][sIndex] = { type: 'CTRL', id: Date.now(), role: 'control', pairId: Date.now() };
      } else {
        newGrid[qIndex][sIndex] = { type: gateType, id: Date.now() };
      }
      
      applyWireStraddle(newGrid, qIndex, sIndex);
      setQuantumGrid(newGrid);
    } else if (mode === 'connect') {
      const srcQ = parseInt(e.dataTransfer.getData('q'));
      const srcS = parseInt(e.dataTransfer.getData('s'));
      if (srcS === sIndex && srcQ !== qIndex) {
        const srcGate = quantumGrid[srcQ][srcS];
        const tgtGate = quantumGrid[qIndex][sIndex];
        if (srcGate && tgtGate) {
          pushQuantumHistory();
          const newGrid = [...quantumGrid.map(row => [...row])];
          const srcPairId = srcGate.pairId;
          const tgtPairId = tgtGate.pairId;
          
          if (srcPairId && tgtPairId) {
            const minQ = Math.min(srcQ, qIndex);
            const maxQ = Math.max(srcQ, qIndex);
            
            const pairIdsToMerge = new Set<number>([tgtPairId]);
            for (let q = minQ + 1; q < maxQ; q++) {
               const g = newGrid[q][sIndex];
               if (g && (g.role || g.type === 'Z' || g.type === 'X' || g.type === 'CZ' || g.type === 'CX')) {
                  if (g.type === 'Z' || g.type === 'CZ') { g.type = 'CZ'; g.role = 'target'; }
                  if (g.type === 'X' || g.type === 'CX') { g.type = 'CX'; g.role = 'target'; }
                  if (g.pairId) pairIdsToMerge.add(g.pairId);
                  g.pairId = srcPairId;
               }
            }

            for (let q = 0; q < newGrid.length; q++) {
              const g = newGrid[q][sIndex];
              if (g && g.pairId && pairIdsToMerge.has(g.pairId)) {
                newGrid[q][sIndex] = { ...g, pairId: srcPairId };
              }
            }
            setQuantumGrid(newGrid);
          }
        }
      }
    } else if (mode === 'move') {
      const srcQ = parseInt(e.dataTransfer.getData('q'));
      const srcS = parseInt(e.dataTransfer.getData('s'));
      const isMultiMove = selectedCells.some(c => c.q === srcQ && c.s === srcS);
      const newGrid = [...quantumGrid.map(row => [...row])];
      
      if (isMultiMove && selectedCells.length > 1) {
        const deltaQ = qIndex - srcQ;
        const deltaS = sIndex - srcS;

        const expanded = [...selectedCells];
        const pairIds = new Set<number>();
        selectedCells.forEach(c => {
           const g = quantumGrid[c.q][c.s];
           if (g && g.pairId) pairIds.add(g.pairId);
        });
        for (let q = 0; q < quantumGrid.length; q++) {
           for (let s = 0; s < quantumNumSlots; s++) {
              const g = quantumGrid[q][s];
              if (g && g.pairId && pairIds.has(g.pairId)) {
                 if (!expanded.some(e => e.q === q && e.s === s)) {
                    expanded.push({q, s});
                 }
              }
           }
        }

        let canMove = true;
        for (const cell of expanded) {
           const tgtQ = cell.q + deltaQ;
           const tgtS = cell.s + deltaS;
           if (tgtQ < 0 || tgtQ >= quantumGrid.length || tgtS < 0 || tgtS >= quantumNumSlots) { canMove = false; break; }
           const isSelf = expanded.some(c => c.q === tgtQ && c.s === tgtS);
           if (!isSelf && quantumGrid[tgtQ][tgtS]) { canMove = false; break; }
        }

        if (canMove) {
           pushQuantumHistory();
           const gatesToMove = expanded.map(c => ({ src: c, gate: quantumGrid[c.q][c.s] }));
           expanded.forEach(c => { newGrid[c.q][c.s] = null; });
           const newSelectedCells: {q: number, s: number}[] = [];
           gatesToMove.forEach(({src, gate}) => {
              if (gate) {
                 newGrid[src.q + deltaQ][src.s + deltaS] = gate;
                 newSelectedCells.push({ q: src.q + deltaQ, s: src.s + deltaS });
              }
           });
           setQuantumGrid(newGrid);
           setSelectedCells(newSelectedCells);
        }
      } else {
        const gate = newGrid[srcQ][srcS];
        
        if (gate && gate.pairId) {
          if (sIndex === srcS) {
            const existingInTarget = newGrid[qIndex][sIndex];
            if (existingInTarget && existingInTarget.pairId === gate.pairId) {
              return;
            }
            pushQuantumHistory();
            newGrid[srcQ][srcS] = null;
            newGrid[qIndex][sIndex] = gate;
            setSelectedCells([{ q: qIndex, s: sIndex }]);
          } else {
            pushQuantumHistory();
            const pairedNodes: {q: number, gate: any}[] = [];
            for (let q = 0; q < newGrid.length; q++) {
              if (newGrid[q][srcS] && newGrid[q][srcS]?.pairId === gate.pairId) {
                pairedNodes.push({q, gate: newGrid[q][srcS]});
              }
            }
            pairedNodes.forEach(p => { newGrid[p.q][srcS] = null; });
            pairedNodes.forEach(p => { newGrid[p.q][sIndex] = p.gate; });
            setSelectedCells(pairedNodes.map(p => ({ q: p.q, s: sIndex })));
          }
        } else {
          pushQuantumHistory();
          newGrid[srcQ][srcS] = null;
          newGrid[qIndex][sIndex] = gate;
          setSelectedCells([{ q: qIndex, s: sIndex }]);
        }
        
        applyWireStraddle(newGrid, qIndex, sIndex);
        setQuantumGrid(newGrid);
      }
    }
  };

  const handleGateDragStart = (e: React.DragEvent, qIndex: number, sIndex: number) => {
    e.dataTransfer.setData('mode', 'move');
    e.dataTransfer.setData('q', qIndex.toString());
    e.dataTransfer.setData('s', sIndex.toString());
    setDraggingGate({ q: qIndex, s: sIndex });

    const isMultiMove = selectedCells.some(c => c.q === qIndex && c.s === sIndex) && selectedCells.length > 1;
    if (isMultiMove) {
      const el = document.createElement('div');
      el.style.padding = '8px 16px';
      el.style.backgroundColor = 'rgba(168,85,247,0.9)';
      el.style.color = '#fff';
      el.style.borderRadius = '8px';
      el.style.fontWeight = 'bold';
      el.style.fontFamily = 'var(--font-mono)';
      el.textContent = `Moving ${selectedCells.length} gates...`;
      el.style.position = 'absolute';
      el.style.top = '-1000px';
      document.body.appendChild(el);
      e.dataTransfer.setDragImage(el, 10, 10);
      setTimeout(() => document.body.removeChild(el), 10);
    }
  };

  const handleGateDragEnd = () => {
    setDraggingGate(null);
  };

  const removeGate = (e: React.MouseEvent, qIndex: number, sIndex: number) => {
    e.stopPropagation();
    pushQuantumHistory();
    const newGrid = [...quantumGrid.map(row => [...row])];
    newGrid[qIndex][sIndex] = null;
    setQuantumGrid(newGrid);
  };

  return (
    <div 
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={(e) => {
        setSelectedCells([]);
      }}
      style={{
        width: '100%', height: '100%',
        backgroundColor: 'var(--color-bg-base)',
        overflow: 'hidden', position: 'relative',
        cursor: isPanning ? 'grabbing' : 'default'
      }}
    >
      <div style={{ position: 'absolute', top: '24px', left: '24px', display: 'flex', gap: '12px', zIndex: 10 }}>
        <button onClick={(e) => {
          e.stopPropagation();
          pushQuantumHistory();
          setQuantumNumQubits(quantumNumQubits + 1);
        }} style={{
          padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.05)',
          color: 'var(--color-text-primary)', border: '1px solid var(--color-border)',
          borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s',
          fontFamily: 'var(--font-mono)', fontSize: '14px',
          backdropFilter: 'blur(8px)'
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
        >
          + Add Qubit
        </button>

        <button onClick={(e) => {
          e.stopPropagation();
          if (quantumNumQubits > 1) {
            pushQuantumHistory();
            setQuantumNumQubits(quantumNumQubits - 1);
          }
        }} style={{
          padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.05)',
          color: 'var(--color-text-primary)', border: '1px solid var(--color-border)',
          borderRadius: '6px', cursor: quantumNumQubits <= 1 ? 'not-allowed' : 'pointer', 
          transition: 'all 0.2s', fontFamily: 'var(--font-mono)', fontSize: '14px',
          opacity: quantumNumQubits <= 1 ? 0.5 : 1,
          backdropFilter: 'blur(8px)'
        }}
        onMouseEnter={e => {
          if (quantumNumQubits > 1) e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)';
        }}
        onMouseLeave={e => {
          if (quantumNumQubits > 1) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
        }}
        disabled={quantumNumQubits <= 1}
        >
          - Remove Qubit
        </button>
      </div>

      <div style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
        transformOrigin: '0 0',
        transition: isPanning ? 'none' : 'transform 0.1s ease-out',
        display: 'flex', flexDirection: 'column',
        gap: '24px', backgroundColor: 'var(--color-bg-panel)',
        padding: '32px', borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        border: '1px solid var(--color-border)',
        width: 'max-content'
      }}>
        {quantumGrid.map((row, qIndex) => (
          <div key={qIndex} style={{ display: 'flex', alignItems: 'center', height: '64px' }}>
            <div style={{
              width: '60px', color: 'var(--color-text-primary)', fontWeight: 600, fontSize: '18px',
              fontFamily: 'var(--font-mono)'
            }}>
              q{qIndex}
            </div>
            
            <div style={{ display: 'flex', position: 'relative', flex: 1, alignItems: 'center' }}>
              <div style={{
                position: 'absolute', top: '50%', left: 0, right: 0,
                height: '2px', backgroundColor: 'var(--color-border)', zIndex: 0,
                boxShadow: '0 0 4px rgba(0,0,0,0.3)'
              }} />
              
              {row.map((cell, sIndex) => {
                const gateMeta = cell ? QUANTUM_GATES.find(g => g.gateType.toUpperCase() === cell.type.toUpperCase()) : null;
                const bgColor = gateMeta ? gateMeta.bgColor : 'rgba(168,85,247,0.15)';
                const borderColor = gateMeta ? gateMeta.borderColor : '#a855f7';
                const textColor = gateMeta ? gateMeta.textColor : '#e879f9';
                const hoverBgColor = gateMeta ? gateMeta.bgColor.replace(/0\.\d+\)/, '0.25)') : 'rgba(168,85,247,0.25)';
                const isSelected = selectedCells.some(c => c.q === qIndex && c.s === sIndex);

                return (
                  <div
                    key={sIndex}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey || e.ctrlKey || e.metaKey) {
                        const isSelected = selectedCells.some(c => c.q === qIndex && c.s === sIndex);
                        if (isSelected) {
                          setSelectedCells(selectedCells.filter(c => c.q !== qIndex || c.s !== sIndex));
                        } else {
                          setSelectedCells([...selectedCells, { q: qIndex, s: sIndex }]);
                        }
                      } else {
                        setSelectedCells([{ q: qIndex, s: sIndex }]);
                      }
                    }}
                    onDragOver={(e) => handleDragOver(e, qIndex, sIndex)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, qIndex, sIndex)}
                    style={{
                      width: '64px', height: '64px',
                      position: 'relative', zIndex: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: dragOverCell?.q === qIndex && dragOverCell?.s === sIndex
                        ? 'rgba(168,85,247,0.2)' : 'transparent',
                      borderRadius: '10px',
                      border: dragOverCell?.q === qIndex && dragOverCell?.s === sIndex
                        ? '2px dashed #a855f7' : (isSelected ? '2px solid #3b82f6' : '2px dashed transparent'),
                      boxShadow: dragOverCell?.q === qIndex && dragOverCell?.s === sIndex
                        ? 'inset 0 0 12px rgba(168,85,247,0.5)' : (isSelected ? '0 0 12px rgba(59,130,246,0.5)' : 'none'),
                      transition: 'all 0.15s ease',
                      margin: '0 4px',
                      cursor: 'pointer'
                    }}
                  >
                  {cell && (
                    <div
                      draggable
                      onDragStart={(e) => handleGateDragStart(e, qIndex, sIndex)}
                      onDragEnd={handleGateDragEnd}
                      style={{
                        width: '46px', height: '46px',
                        backgroundColor: cell.role ? 'transparent' : bgColor,
                        border: cell.role ? 'none' : `2px solid ${borderColor}`,
                        borderRadius: '10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: textColor, fontWeight: 700, fontSize: '18px',
                        fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
                        cursor: 'grab', backdropFilter: cell.role ? 'none' : 'blur(4px)',
                        boxShadow: cell.role ? 'none' : `0 0 12px ${bgColor.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgba($1,$2,$3,0.4)')}`,
                        position: 'relative', transition: 'all 0.15s ease',
                        opacity: draggingGate?.q === qIndex && draggingGate?.s === sIndex ? 0.3 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (draggingGate) return;
                        const el = e.currentTarget as HTMLElement;
                        if (cell.role) {
                          el.style.backgroundColor = 'rgba(168,85,247,0.1)';
                        } else {
                          el.style.backgroundColor = hoverBgColor;
                          el.style.boxShadow = `0 0 0 2px ${borderColor}, 0 0 20px ${bgColor.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgba($1,$2,$3,0.6)')}`;
                        }
                        const btn = el.querySelector('.delete-btn') as HTMLElement;
                        if (btn) btn.style.opacity = '1';
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLElement;
                        if (cell.role) {
                          el.style.backgroundColor = 'transparent';
                        } else {
                          el.style.backgroundColor = bgColor;
                          el.style.boxShadow = `0 0 12px ${bgColor.replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgba($1,$2,$3,0.4)')}`;
                        }
                        const btn = el.querySelector('.delete-btn') as HTMLElement;
                        if (btn) btn.style.opacity = '0';
                        const handles = el.querySelectorAll('.connect-handle') as NodeListOf<HTMLElement>;
                        handles.forEach(h => h.style.opacity = '0');
                      }}
                    >
                      {cell.role === 'control' || (cell.role === 'target' && cell.type === 'CZ') ? (
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: borderColor, zIndex: 10 }} />
                      ) : cell.role === 'target' && cell.type === 'CX' ? (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: `2px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', backgroundColor: 'var(--color-bg-base)', zIndex: 10 }}>
                          <div style={{ position: 'absolute', width: '100%', height: '2px', backgroundColor: borderColor }} />
                          <div style={{ position: 'absolute', width: '2px', height: '100%', backgroundColor: borderColor }} />
                        </div>
                      ) : (
                        cell.type
                      )}

                      {cell.pairId && (() => {
                        const pairedQIndices = quantumGrid
                          .map((r, q) => (r[sIndex] && r[sIndex]?.pairId === cell.pairId ? q : -1))
                          .filter(q => q !== -1);
                        if (pairedQIndices.length > 1 && Math.min(...pairedQIndices) === qIndex) {
                           const maxQ = Math.max(...pairedQIndices);
                           const height = (maxQ - qIndex) * 88;
                           return (
                             <div style={{ position: 'absolute', left: '50%', top: `23px`, width: '2px', height: `${height}px`, backgroundColor: borderColor, zIndex: 0, transform: 'translateX(-50%)' }} />
                           );
                        }
                        return null;
                      })()}

                    {/* 接続用ハンドル (上) */}
                    {cell.role && (
                      <div
                        draggable
                        className="connect-handle"
                        onDragStart={(e) => {
                           e.stopPropagation();
                           e.dataTransfer.setData('mode', 'connect');
                           e.dataTransfer.setData('q', qIndex.toString());
                           e.dataTransfer.setData('s', sIndex.toString());
                        }}
                        style={{
                          position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)',
                          width: '12px', height: '12px', borderRadius: '50%',
                          backgroundColor: borderColor, cursor: 'crosshair', opacity: 0,
                          transition: 'opacity 0.2s', zIndex: 20
                        }}
                      />
                    )}
                    {/* 接続用ハンドル (下) */}
                    {cell.role && (
                      <div
                        draggable
                        className="connect-handle"
                        onDragStart={(e) => {
                           e.stopPropagation();
                           e.dataTransfer.setData('mode', 'connect');
                           e.dataTransfer.setData('q', qIndex.toString());
                           e.dataTransfer.setData('s', sIndex.toString());
                        }}
                        style={{
                          position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)',
                          width: '12px', height: '12px', borderRadius: '50%',
                          backgroundColor: borderColor, cursor: 'crosshair', opacity: 0,
                          transition: 'opacity 0.2s', zIndex: 20
                        }}
                      />
                    )}
                    
                    {/* 削除ボタン */}
                    <div
                      className="delete-btn"
                      onClick={(e) => removeGate(e, qIndex, sIndex)}
                      style={{
                        position: 'absolute', top: '-6px', right: '-6px',
                        width: '18px', height: '18px', borderRadius: '50%',
                        backgroundColor: '#ef4444', color: '#fff',
                        fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', opacity: 0, transition: 'all 0.2s ease',
                        boxShadow: '0 0 8px rgba(239,68,68,0.6)', border: '1px solid #7f1d1d'
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                      }}
                    >
                      ×
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      ))}
      </div>
    </div>
  );
};

export default QuantumCircuitCanvas;
