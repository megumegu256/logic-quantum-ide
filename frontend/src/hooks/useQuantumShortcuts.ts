// frontend/src/hooks/useQuantumShortcuts.ts
import { useEffect, useState } from 'react';
import useCircuitStore, { type QuantumGate } from '../store/useCircuitStore';

interface UseQuantumShortcutsProps {
  selectedCells: { q: number; s: number }[];
  setSelectedCells: (cells: { q: number; s: number }[]) => void;
}

export function useQuantumShortcuts({
  selectedCells,
  setSelectedCells,
}: UseQuantumShortcutsProps) {
  const {
    quantumGrid,
    quantumNumSlots,
    setQuantumGrid,
    pushQuantumHistory,
    undoQuantum,
    redoQuantum,
    setQuantumSelectedStep,
  } = useCircuitStore();

  const [quantumClipboard, setQuantumClipboard] = useState<
    { qOffset: number; sOffset: number; gate: QuantumGate }[]
  >([]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      // 矢印キー: 選択枠（青枠）を1セルずつ移動する
      const arrowDelta: Record<string, { dq: number; ds: number }> = {
        ArrowUp: { dq: -1, ds: 0 },
        ArrowDown: { dq: 1, ds: 0 },
        ArrowLeft: { dq: 0, ds: -1 },
        ArrowRight: { dq: 0, ds: 1 },
      };
      const delta = arrowDelta[e.key];
      if (delta && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        if (selectedCells.length === 0) return;

        // ページスクロールなど既定の動作を抑止する
        e.preventDefault();

        const canMove = selectedCells.every(cell => {
          const q = cell.q + delta.dq;
          const s = cell.s + delta.ds;
          return q >= 0 && q < quantumGrid.length && s >= 0 && s < quantumNumSlots;
        });
        if (!canMove) return;

        const movedCells = selectedCells.map(cell => ({
          q: cell.q + delta.dq,
          s: cell.s + delta.ds,
        }));
        setSelectedCells(movedCells);

        // 計算過程パネルの選択行ハイライトも選択枠に合わせる
        const slots = new Set(movedCells.map(cell => cell.s));
        const gateCells = movedCells.filter(cell => quantumGrid[cell.q]?.[cell.s]);
        if (slots.size === 1 && gateCells.length > 0) {
          setQuantumSelectedStep({
            qubits: Array.from(new Set(gateCells.map(cell => cell.q))),
            slot: movedCells[0].s,
            source: 'canvas',
          });
        } else {
          setQuantumSelectedStep(null);
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 選択セルにゲートがある場合のみ削除する（空セルでの連打で履歴を汚さない）
        if (selectedCells.length > 0 && selectedCells.some((cell) => quantumGrid[cell.q]?.[cell.s])) {
          pushQuantumHistory();
          const newGrid = [...quantumGrid.map((row) => [...row])];
          selectedCells.forEach((cell) => {
            newGrid[cell.q][cell.s] = null;
          });
          setQuantumGrid(newGrid);
          // 選択枠は残したままにして、矢印キーで続けて移動・削除できるようにする
        }
      } else if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'a': {
            e.preventDefault();
            const allSelected: { q: number; s: number }[] = [];
            for (let q = 0; q < quantumGrid.length; q++) {
              for (let s = 0; s < quantumNumSlots; s++) {
                if (quantumGrid[q][s]) {
                  allSelected.push({ q, s });
                }
              }
            }
            setSelectedCells(allSelected);
            break;
          }
          case 'c': {
            if (selectedCells.length > 0) {
              const expanded = [...selectedCells];
              const minQ = Math.min(...expanded.map((c) => c.q));
              const minS = Math.min(...expanded.map((c) => c.s));
              const items: { qOffset: number; sOffset: number; gate: QuantumGate }[] = [];
              expanded.forEach((c) => {
                const gate = quantumGrid[c.q][c.s];
                if (gate) {
                  items.push({ qOffset: c.q - minQ, sOffset: c.s - minS, gate });
                }
              });
              setQuantumClipboard(items);
            }
            break;
          }
          case 'v': {
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
                    if (
                      pasteQ < 0 ||
                      pasteQ >= quantumGrid.length ||
                      pasteS < 0 ||
                      pasteS >= quantumNumSlots ||
                      quantumGrid[pasteQ][pasteS]
                    ) {
                      canFit = false;
                      break;
                    }
                  }
                  if (canFit) {
                    targetS = s;
                    foundPos = true;
                    break;
                  }
                }
              } else {
                outer: for (let s = 0; s < quantumNumSlots; s++) {
                  for (let q = 0; q < quantumGrid.length; q++) {
                    let canFit = true;
                    for (const item of quantumClipboard) {
                      const pasteQ = q + item.qOffset;
                      const pasteS = s + item.sOffset;
                      if (
                        pasteQ < 0 ||
                        pasteQ >= quantumGrid.length ||
                        pasteS < 0 ||
                        pasteS >= quantumNumSlots ||
                        quantumGrid[pasteQ][pasteS]
                      ) {
                        canFit = false;
                        break;
                      }
                    }
                    if (canFit) {
                      targetQ = q;
                      targetS = s;
                      foundPos = true;
                      break outer;
                    }
                  }
                }
              }

              if (foundPos && targetQ !== undefined && targetS !== undefined) {
                pushQuantumHistory();
                const newGrid = [...quantumGrid.map((row) => [...row])];
                const pairIdMap = new Map<number, number>();
                const newSelected: { q: number; s: number }[] = [];

                quantumClipboard.forEach((item) => {
                  const pasteQ = targetQ! + item.qOffset;
                  const pasteS = targetS! + item.sOffset;
                  const newGate = { ...item.gate, id: Date.now() + Math.random() };

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
          }
          case 'z': {
            e.preventDefault();
            if (e.shiftKey) redoQuantum();
            else undoQuantum();
            setSelectedCells([]);
            break;
          }
          case 'y': {
            e.preventDefault();
            redoQuantum();
            setSelectedCells([]);
            break;
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    quantumGrid,
    selectedCells,
    quantumClipboard,
    pushQuantumHistory,
    undoQuantum,
    redoQuantum,
    setQuantumGrid,
    quantumNumSlots,
    setSelectedCells,
    setQuantumSelectedStep,
  ]);

  return {
    quantumClipboard,
    setQuantumClipboard,
  };
}
