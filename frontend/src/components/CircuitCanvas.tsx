// CircuitCanvas.tsx
// Quantum IDE — React Flow キャンバスコンポーネント
//
// 【責務】
//   - Zustand ストアの nodes/edges を React Flow に接続する。
//   - ドラッグ移動・Delete/Backspaceキーによるノード削除を動作させる。
//   - GatePalette からのドラッグ＆ドロップを受け取り addNode する。
//   - このコンポーネント自体に計算ロジックを含めない（純粋な描画レイヤー）。

import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  type NodeTypes,
  type OnNodesDelete,
  type OnEdgesDelete,
  type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';

import useCircuitStore from '../store/useCircuitStore';
import CustomGateNode from './CustomGateNode';
import OffsetEdge from './OffsetEdge';
import NodePropertyEditor from './NodePropertyEditor';
import { DRAG_DATA_KEY, type DragTransferData } from './GatePalette';

// nodeTypes マップ — CustomGateNode 1種類のみ登録（アーキテクチャ仕様通り）
const NODE_TYPES: NodeTypes = {
  customGate: CustomGateNode,
};

// edgeTypes マップ — オフセット対応カスタムエッジ
const EDGE_TYPES = {
  offset: OffsetEdge,
} as const;

// ============================================================
// CircuitCanvas コンポーネント（ReactFlowProvider 内で使用）
// ============================================================
const CircuitCanvasInner: React.FC = () => {
  const {
    nodes, edges, onNodesChange, onEdgesChange,
    onConnect, addNode, deleteElements, simulationResults, edgeType,
    splitEdge, undo, redo, copySelected, pasteClipboard, duplicateSelected,
    selectAll, showMiniMap, setEditingNodeId,
  } = useCircuitStore();

  const edgeStates = simulationResults?.edgeStates ?? {};

  // edgeStates + groupIndex に基づいてエッジを動的にスタイリング
  const displayEdges = useMemo(() => {
    // 同一 source+sourceHandle グループを特定してインデックスを付与
    const groupMap = new Map<string, number[]>();
    edges.forEach((e, idx) => {
      const key = `${e.source}::${e.sourceHandle ?? 'default'}`;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(idx);
    });

    return edges.map((e, idx) => {
      const key = `${e.source}::${e.sourceHandle ?? 'default'}`;
      const group = groupMap.get(key) ?? [idx];
      const groupIndex = group.indexOf(idx);
      // e.type が store で更新されていれば優先、なければ edgeType を使用
      const resolvedType = e.type ?? edgeType;

      return {
        ...e,
        // 全エッジを常に OffsetEdge で一元管理する
        // （groupIndex=0 と >0 で type が変わると描画の一貫性が失われるため）
        type: 'offset',
        animated: edgeStates[e.id] === 1,
        // edgeType を data に渡して OffsetEdge が正しいパス関数を選択できるようにする
        data: { ...(e.data ?? {}), groupIndex, groupSize: group.length, edgeType: resolvedType },
        style: {
          stroke:      edgeStates[e.id] === 1 ? '#22d3a0' : '#3a3f6e',
          strokeWidth: edgeStates[e.id] === 1 ? 2.5 : 2,
        },
      };
    });
  }, [edges, edgeStates, edgeType]);

  // useReactFlow: screenToFlowPosition() で画面座標 → フロー座標変換
  const { screenToFlowPosition } = useReactFlow();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------------
  // ノード削除コールバック（Delete / Backspace キー）
  // ----------------------------------------------------------
  const handleNodesDelete: OnNodesDelete = useCallback(
    (deletedNodes) => {
      deleteElements({ nodes: deletedNodes.map((n) => ({ id: n.id })) });
    },
    [deleteElements],
  );

  // エッジ削除コールバック
  const handleEdgesDelete: OnEdgesDelete = useCallback(
    (deletedEdges) => {
      deleteElements({ edges: deletedEdges.map((e) => ({ id: e.id })) });
    },
    [deleteElements],
  );

  // ----------------------------------------------------------
  // エッジダブルクリック → Junction 挿入（エッジ分割）
  // ----------------------------------------------------------
  const handleEdgeDoubleClick = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.stopPropagation();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      splitEdge(edge.id, position);
    },
    [splitEdge, screenToFlowPosition],
  );

  // ----------------------------------------------------------
  // キーボードショートカット（Undo/Redo/Copy/Paste/Duplicate）
  // ----------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // インプット欄で入力中はスキップ
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
            break;
          case 'y':
            e.preventDefault();
            redo();
            break;
          case 'c':
            e.preventDefault();
            copySelected();
            break;
          case 'v':
            e.preventDefault();
            pasteClipboard();
            break;
          case 'd':
            e.preventDefault();
            duplicateSelected();
            break;
          case 'a':
            e.preventDefault();
            selectAll();
            break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo, copySelected, pasteClipboard, duplicateSelected, selectAll]);

  // ----------------------------------------------------------
  // D&D: onDragOver — ドロップを許可
  // ----------------------------------------------------------
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  // ----------------------------------------------------------
  // D&D: onDrop — ドロップ座標をフロー座標に変換して addNode
  // ----------------------------------------------------------
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      // データが存在しない場合はスキップ
      const raw = e.dataTransfer.getData(DRAG_DATA_KEY);
      if (!raw) return;

      let gateData: DragTransferData;
      try {
        gateData = JSON.parse(raw) as DragTransferData;
      } catch {
        console.error('[Quantum IDE] D&D データのパースに失敗しました:', raw);
        return;
      }

      // ラッパー要素の位置を取得してドロップ座標を計算
      const wrapperRect = reactFlowWrapper.current?.getBoundingClientRect();
      if (!wrapperRect) return;

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // ユニークな ID を生成
      const id = `gate-${gateData.gateType}-${Date.now()}`;

      // Switch のデフォルト初期状態を 0 (OFF) に設定
      const defaultParams: Record<string, unknown> =
        gateData.gateType === 'Switch' ? { value: 0 } : {};

      // addNode でストアに追加（type: 'customGate' 固定）
      addNode({
        id,
        type: 'customGate',
        position,
        data: {
          gateType: gateData.gateType,
          label: gateData.label,
          handles: gateData.handles,
          params: { ...defaultParams, ...(gateData.params ?? {}) },
        },
      });
    },
    [screenToFlowPosition, addNode],
  );

  // ----------------------------------------------------------
  // レンダリング
  // ----------------------------------------------------------
  return (
    <div
      ref={reactFlowWrapper}
      style={{ width: '100%', height: '100%' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={handleNodesDelete}
        onEdgesDelete={handleEdgesDelete}
        onNodeDoubleClick={(_, node) => setEditingNodeId?.(node.id)}
        onEdgeDoubleClick={handleEdgeDoubleClick}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        // ノード削除キーバインド（Delete + Backspace 両対応）
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        // パン・ズーム設定
        minZoom={0.2}
        maxZoom={4}
        snapToGrid={true}
        snapGrid={[10, 10]}
        // エッジのデフォルトスタイル
        defaultEdgeOptions={{
          type: edgeType,
          style: { stroke: '#3a3f6e', strokeWidth: 2 },
          animated: false,
        }}
        // 接続線のスタイル
        connectionLineStyle={{ stroke: '#5b8df6', strokeWidth: 2 }}
        // キャンバス全体のスタイル
        style={{ backgroundColor: 'var(--color-bg-base)' }}
      >
        {/* ドット グリッド背景 */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="#252840"
        />

        {/* ミニマップ */}
        {showMiniMap && (
          <MiniMap
            nodeColor={(node) => {
              const isQuantum = ['H', 'X', 'Y', 'Z', 'S', 'T', 'CX', 'CCX', 'Measure'].includes(
                (node.data as { gateType: string })?.gateType ?? '',
              );
              return isQuantum ? '#a855f7' : '#5b8df6';
            }}
            maskColor="rgba(13,15,26,0.85)"
            style={{
              backgroundColor: '#131626',
              border: '1px solid #252840',
              borderRadius: '8px',
            }}
          />
        )}

        {/* コントロール（ズーム / フィット）*/}
        <Controls
          style={{
            backgroundColor: '#131626',
            border: '1px solid #252840',
            borderRadius: '8px',
          }}
        />
      </ReactFlow>

      {/* プロパティエディタ (モーダル) */}
      <NodePropertyEditor />
    </div>
  );
};

// ============================================================
// CircuitCanvas エクスポート
// useReactFlow は ReactFlowProvider の内側でしか使えないため、
// MainLayout.tsx の CenterCanvas を ReactFlowProvider でラップする。
// ここでは内部コンポーネントをそのままエクスポートする。
// ============================================================
export default CircuitCanvasInner;
