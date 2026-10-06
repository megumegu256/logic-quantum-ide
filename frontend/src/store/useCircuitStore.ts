// useCircuitStore.ts
// Quantum IDE — Zustand グローバルストア（Debounce 廃止版）
//
// 【設計変更点】
//   - 自動 Debounce シミュレーションを廃止
//   - runSimulation(steps) を手動実行専用に変更
//   - updateNodeData: Switch/Clock のパラメータ更新用
//   - clearResults: タイミングデータをリセット

import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from 'reactflow';

// ============================================================
// 型定義
// ============================================================
export type AppMode = 'logic' | 'quantum';

export type GateType =
  | 'AND' | 'OR' | 'NOT' | 'NAND' | 'NOR' | 'XOR'
  | 'Switch' | 'LED' | 'Clock' | 'SevenSeg'
  | 'H' | 'X' | 'Y' | 'Z' | 'S' | 'T' | 'CX' | 'CZ' | 'CCX' | 'CTRL' | 'Measure'
  | 'Junction' | 'CustomIC';

export interface GateNodeData {
  gateType: GateType;
  label: string;
  handles: { inputs: number; outputs: number };
  isGhost?: boolean;
  params?: Record<string, unknown>;
}

export interface SimulationResult {
  edgeStates:   Record<string, number>;
  quantumState: Record<string, unknown>;
  timingData:   Record<string, number[]>;
}

export interface CustomModule {
  id: string;
  name: string;
  nodes: Node<GateNodeData>[];
  edges: Edge[];
  inputs: number;
  outputs: number;
}

export type EdgeMode = 'default' | 'straight' | 'step';

type Snapshot = { nodes: Node<GateNodeData>[]; edges: Edge[] };

export interface QuantumGate {
  type: string;
  role?: 'control' | 'target';
  id: number;
  pairId?: number;
}

type WorkspaceState = {
  nodes: Node<GateNodeData>[];
  edges: Edge[];
  past: Snapshot[];
  future: Snapshot[];
};

interface CircuitState {
  mode:              AppMode;
  logicState:        WorkspaceState;
  quantumState:      WorkspaceState;

  nodes:             Node<GateNodeData>[];
  edges:             Edge[];
  simulationResults: SimulationResult | null;
  isSimulating:      boolean;
  clockStep:         number;
  edgeType:          EdgeMode;

  // --- Undo/Redo 履歴スタック ---
  past:      Snapshot[];
  future:    Snapshot[];

  // --- コピー/ペースト用クリップボード ---
  clipboard: Snapshot | null;

  // --- 論理式データ ---
  logicExpressions: Record<string, { text: string; latex: string }> | null;

  // --- カスタムモジュール ---
  customModules: Record<string, CustomModule>;

  // --- UI状態 ---
  showLogicPanel:    boolean;
  showMiniMap:       boolean;
  editingNodeId:     string | null;
  chartRowOrder:     string[];

  // --- 量子回路用ステート ---
  quantumGrid: (QuantumGate | null)[][];
  quantumNumQubits: number;
  quantumNumSlots: number;
  quantumSimulationResult: any | null;
  connectionNotice: string | null;
  setQuantumGrid: (grid: (QuantumGate | null)[][]) => void;
  setQuantumNumQubits: (num: number) => void;
  setQuantumSimulationResult: (res: any) => void;
  setConnectionNotice: (message: string | null) => void;

  quantumPast: (QuantumGate | null)[][][];
  quantumFuture: (QuantumGate | null)[][][];
  pushQuantumHistory: () => void;
  undoQuantum: () => void;
  redoQuantum: () => void;

  quantumHoveredStep: { qubits: number[], slot: number, source?: 'panel' | 'canvas' } | null;
  quantumSelectedStep: { qubits: number[], slot: number, source?: 'panel' | 'canvas' } | null;
  setQuantumHoveredStep: (step: { qubits: number[], slot: number, source?: 'panel' | 'canvas' } | null) => void;
  setQuantumSelectedStep: (step: { qubits: number[], slot: number, source?: 'panel' | 'canvas' } | null) => void;

  onNodesChange:  (changes: NodeChange[]) => void;
  onEdgesChange:  (changes: EdgeChange[]) => void;
  onConnect:      (connection: Connection) => void;

  addNode:        (node: Node<GateNodeData>) => void;
  deleteElements: (params: { nodes?: { id: string }[]; edges?: { id: string }[] }) => void;
  updateNodeData: (nodeId: string, data: Partial<GateNodeData>) => void;
  addGhostNode:   (gateType: GateType, handles: { inputs: number; outputs: number }, label: string) => void;
  acceptGhostNode:(nodeId: string) => void;
  discardGhostNode:(nodeId: string) => void;
  toggleSwitch:   (nodeId: string) => void;
  applyLayout:    (newNodes: Node<GateNodeData>[]) => void;
  setEdgeType:    (type: EdgeMode) => void;

  // --- 履歴操作 ---
  pushHistory:       () => void;
  undo:              () => void;
  redo:              () => void;

  // --- クリップボード操作 ---
  copySelected:      () => void;
  pasteClipboard:    () => void;
  duplicateSelected: () => void;
  selectAll:         () => void;

  // --- エッジ分割（ダブルクリックで Junction 挿入）---
  splitEdge:         (edgeId: string, position: { x: number; y: number }) => void;

  runSimulation:    (steps?: number) => Promise<void>;
  quickSimulate:    () => Promise<void>;
  stepSimulate:     () => Promise<void>;
  fastPropagate:    () => Promise<void>;
  resetSimulation:  () => void;
  clearResults:     () => void;
  loadCircuit:      (data: any) => void;
  
  fetchLogicExpressions: () => Promise<void>;
  saveCustomModule: (name: string) => void;

  toggleLogicPanel:  () => void;
  toggleMiniMap:     () => void;
  setEditingNodeId:  (id: string | null) => void;
  setChartRowOrder:  (order: string[]) => void;
  updateNodePosition: (id: string, x: number, y: number) => void;
  
  setMode:           (mode: AppMode) => void;
}

const API_BASE = 'http://localhost:8000';

const QUANTUM_GATE_TYPES = new Set(['H', 'X', 'Y', 'Z', 'S', 'T', 'CTRL', 'Measure']);

const isValidControlConnection = (
  sourceType: GateType | undefined,
  targetType: GateType | undefined,
): boolean => {
  if (sourceType !== 'CTRL' && targetType !== 'CTRL') return true;
  if (sourceType === 'CTRL' && targetType === 'CTRL') return true;
  const otherType = sourceType === 'CTRL' ? targetType : sourceType;
  return otherType === 'X' || otherType === 'Z';
};

// ============================================================
// Zustand ストア定義
// ============================================================
const useCircuitStore = create<CircuitState>((set, get) => ({
  mode:              'logic',
  logicState:        { nodes: [], edges: [], past: [], future: [] },
  quantumState:      { nodes: [], edges: [], past: [], future: [] },

  nodes:             [],
  edges:             [],
  simulationResults: null,
  isSimulating:      false,
  clockStep:         0,
  edgeType:          'default' as EdgeMode,
  past:              [],
  future:            [],
  clipboard:         null,
  logicExpressions:  null,
  customModules:     {},
  showLogicPanel:    false,
  showMiniMap:       false,
  editingNodeId:     null,
  chartRowOrder:     [],

  quantumGrid:       Array(2).fill(null).map(() => Array(30).fill(null)),
  quantumNumQubits:  2,
  quantumNumSlots:   30,
  quantumSimulationResult: null,
  connectionNotice: null,

  quantumPast:       [],
  quantumFuture:     [],
  quantumHoveredStep: null,
  quantumSelectedStep: null,

  setQuantumHoveredStep: (step) => set({ quantumHoveredStep: step }),
  setQuantumSelectedStep: (step) => set({ quantumSelectedStep: step }),

  pushQuantumHistory: () => {
    set((state) => {
      // Deep copy the current grid
      const gridSnapshot = state.quantumGrid.map(row => row.map(cell => cell ? { ...cell } : null));
      return {
        quantumPast: [...state.quantumPast, gridSnapshot].slice(-50), // keep last 50
        quantumFuture: [],
      };
    });
  },

  undoQuantum: () => {
    set((state) => {
      if (state.quantumPast.length === 0) return {};
      const prev = state.quantumPast[state.quantumPast.length - 1];
      const currentGridSnapshot = state.quantumGrid.map(row => row.map(cell => cell ? { ...cell } : null));
      return {
        quantumGrid: prev,
        quantumPast: state.quantumPast.slice(0, -1),
        quantumFuture: [currentGridSnapshot, ...state.quantumFuture].slice(0, 50),
      };
    });
  },

  redoQuantum: () => {
    set((state) => {
      if (state.quantumFuture.length === 0) return {};
      const next = state.quantumFuture[0];
      const currentGridSnapshot = state.quantumGrid.map(row => row.map(cell => cell ? { ...cell } : null));
      return {
        quantumGrid: next,
        quantumPast: [...state.quantumPast, currentGridSnapshot].slice(-50),
        quantumFuture: state.quantumFuture.slice(1),
      };
    });
  },

  setQuantumGrid: (grid) => set({ quantumGrid: grid }),
  setConnectionNotice: (message) => set({ connectionNotice: message }),
  setQuantumNumQubits: (num) => set((state) => {
    // リサイズ時の安全な処理（切り詰め・拡張）
    let newGrid = Array(num).fill(null).map((_, i) => {
      if (i < state.quantumGrid.length) {
        return [...state.quantumGrid[i]];
      }
      return Array(state.quantumNumSlots).fill(null);
    });

    if (num < state.quantumGrid.length) {
      // 削除される行にあるペアゲートの相方も削除する
      const deletedRows = state.quantumGrid.slice(num);
      const deletedPairIds = new Set<number>();
      deletedRows.forEach(row => {
        row.forEach(cell => {
          if (cell && cell.pairId) {
            deletedPairIds.add(cell.pairId);
          }
        });
      });
      if (deletedPairIds.size > 0) {
        newGrid = newGrid.map(row =>
          row.map(cell => (cell && cell.pairId && deletedPairIds.has(cell.pairId)) ? null : cell)
        );
      }
    }
    return { quantumNumQubits: num, quantumGrid: newGrid };
  }),
  setQuantumSimulationResult: (res) => set({ quantumSimulationResult: res }),

  // --- React Flow コールバック（純粋な描画状態同期のみ） ---
  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes) as Node<GateNodeData>[],
    }));
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    }));
  },

  onConnect: (connection) => {
    const { edgeType, nodes } = get();
    const sourceType = nodes.find((node) => node.id === connection.source)?.data.gateType;
    const targetType = nodes.find((node) => node.id === connection.target)?.data.gateType;

    if (
      sourceType && targetType &&
      QUANTUM_GATE_TYPES.has(sourceType) && QUANTUM_GATE_TYPES.has(targetType)
    ) {
      if (!isValidControlConnection(sourceType, targetType)) return;
    }

    get().pushHistory();
    set((state) => ({
      edges: addEdge(
        { ...connection, type: edgeType, style: { stroke: '#3a3f6e', strokeWidth: 2 }, animated: false },
        state.edges,
      ),
    }));
    setTimeout(() => get().fastPropagate(), 0);
  },

  // --- ノード追加 ---
  addNode: (node) => {
    get().pushHistory();
    set((state) => ({ nodes: [...state.nodes, node] }));
  },

  // --- ノード・エッジ削除 ---
  deleteElements: ({ nodes: del_n = [], edges: del_e = [] }) => {
    if (del_n.length > 0 || del_e.length > 0) get().pushHistory();
    const nids = new Set(del_n.map((n) => n.id));
    const eids = new Set(del_e.map((e) => e.id));
    set((state) => ({
      nodes: state.nodes.filter((n) => !nids.has(n.id)),
      edges: state.edges.filter(
        (e) => !eids.has(e.id) && !nids.has(e.source) && !nids.has(e.target),
      ),
    }));
    setTimeout(() => get().fastPropagate(), 0);
  },

  // --- ノード data の部分更新（Switch トグル / Clock interval 変更用）---
  updateNodeData: (nodeId, data) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, ...data, params: { ...(n.data.params ?? {}), ...(data.params ?? {}) } } }
          : n,
      ),
    }));
  },

  // --- ゴーストノード操作 ---
  addGhostNode: (gateType, handles, label) => {
    const { nodes } = get();
    // 既存ノードの重心 + オフセットに配置（視野内に収まるよう）
    let x = 350, y = 180;
    if (nodes.length > 0) {
      x = nodes.reduce((s, n) => s + n.position.x, 0) / nodes.length + 120;
      y = nodes.reduce((s, n) => s + n.position.y, 0) / nodes.length + 40;
    }
    const id = `ghost-${gateType}-${Date.now()}`;
    set((state) => ({
      nodes: [...state.nodes, {
        id, type: 'customGate', position: { x, y },
        data: { gateType, label, handles, isGhost: true },
      }],
    }));
  },

  // --- ゴースト承認: isGhost フラグを削除して正式ノードに昇格 ---
  acceptGhostNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, isGhost: false } }
          : n,
      ),
    }));
  },

  // --- ゴースト破棄: ノードを削除 ---
  discardGhostNode: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
  },

  // --- 手動シミュレーション実行 ---
  runSimulation: async (steps = 10) => {
    const { nodes, edges, simulationResults, customModules } = get();
    if (nodes.length === 0) return;

    // 現在の最新状態（記憶のアンカー）を抽出
    const initialStates: Record<string, number> = {};
    if (simulationResults?.timingData) {
      for (const [nid, vals] of Object.entries(simulationResults.timingData)) {
        if (vals.length > 0) initialStates[nid] = vals[vals.length - 1];
      }
    }

    set({ isSimulating: true });
    try {
      const res = await fetch(`${API_BASE}/api/simulate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, steps, initialStates, customModules }),
      });
      if (!res.ok) {
        console.error('[Quantum IDE] シミュレーション API エラー:', res.status);
        return;
      }
      const result: SimulationResult = await res.json();
      set({ simulationResults: result });
      console.info('[Quantum IDE] シミュレーション完了:', result);
    } catch (err) {
      console.warn('[Quantum IDE] バックエンドへの接続に失敗:', err);
    } finally {
      set({ isSimulating: false });
      get().fetchLogicExpressions();
    }
  },

  // --- Switch トグル + イベント駆動の自動伝播 ---
  toggleSwitch: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const cur = Number(node.data.params?.value ?? 1);
    get().updateNodeData(nodeId, { params: { ...(node.data.params ?? {}), value: cur === 1 ? 0 : 1 } });
    setTimeout(() => { get().fastPropagate(); }, 0);
  },

  // --- ELK 自動配置結果を nodes に適用 ---
  applyLayout: (newNodes) => { get().pushHistory(); set({ nodes: newNodes }); },

  // --- エッジ描画タイプ切替: 全エッジの type を一斉更新 ---
  setEdgeType: (type) => {
    set((state) => ({
      edgeType: type,
      edges: state.edges.map((e) => ({ ...e, type })),
    }));
  },

  // --- 全選択 ---
  selectAll: () => set((state) => ({
    nodes: state.nodes.map(n => ({ ...n, selected: true })),
    edges: state.edges.map(e => ({ ...e, selected: true })),
  })),

  // ============================================================
  // --- モード切替 ---
  // ============================================================
  setMode: (newMode) => {
    set((state) => {
      if (state.mode === newMode) return state;

      let nextLogic = state.mode === 'logic' 
        ? { nodes: state.nodes, edges: state.edges, past: state.past, future: state.future } 
        : state.logicState;
      let nextQuantum = state.mode === 'quantum' 
        ? { nodes: state.nodes, edges: state.edges, past: state.past, future: state.future } 
        : state.quantumState;

      // マイグレーション: 論理回路モードにある量子ゲートを抽出して量子回路モードへ移動させる
      if (state.mode === 'logic') {
        const QUANTUM_GATES = new Set(['H','X','Y','Z','S','T','CX','CCX','Measure']);
        const hasQuantum = nextLogic.nodes.some(n => QUANTUM_GATES.has(n.data.gateType));
        if (hasQuantum) {
          const qNodes = nextLogic.nodes.filter(n => QUANTUM_GATES.has(n.data.gateType));
          const lNodes = nextLogic.nodes.filter(n => !QUANTUM_GATES.has(n.data.gateType));
          
          const qNodeIds = new Set(qNodes.map(n => n.id));
          const lNodeIds = new Set(lNodes.map(n => n.id));

          const qEdges = nextLogic.edges.filter(e => qNodeIds.has(e.source) || qNodeIds.has(e.target));
          const lEdges = nextLogic.edges.filter(e => lNodeIds.has(e.source) || lNodeIds.has(e.target));

          nextLogic = { ...nextLogic, nodes: lNodes, edges: lEdges };
          nextQuantum = {
            ...nextQuantum,
            nodes: [...nextQuantum.nodes, ...qNodes],
            edges: [...nextQuantum.edges, ...qEdges]
          };
        }
      }

      const targetWorkspace = newMode === 'logic' ? nextLogic : nextQuantum;

      return {
        mode: newMode,
        logicState: nextLogic,
        quantumState: nextQuantum,
        nodes: targetWorkspace.nodes,
        edges: targetWorkspace.edges,
        past: targetWorkspace.past,
        future: targetWorkspace.future,
        simulationResults: null, // モード切替時はシミュレーション結果をリセット
      };
    });
  },

  // ============================================================
  // イベントハンドラ
  // ============================================================
  pushHistory: () => {
    const { nodes, edges, past } = get();
    const MAX = 50;
    set({
      past:   [...past.slice(-MAX + 1), { nodes: [...nodes], edges: [...edges] }],
      future: [],
    });
  },

  undo: () => {
    const { past, nodes, edges, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    set({
      nodes:  prev.nodes,
      edges:  prev.edges,
      past:   past.slice(0, -1),
      future: [{ nodes, edges }, ...future],
    });
  },

  redo: () => {
    const { future, nodes, edges, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      nodes:  next.nodes,
      edges:  next.edges,
      past:   [...past, { nodes, edges }],
      future: future.slice(1),
    });
  },

  // ============================================================
  // コピー / ペースト / 複製
  // ============================================================
  copySelected: () => {
    const { nodes, edges } = get();
    const selNodes = nodes.filter((n) => n.selected);
    const selIds   = new Set(selNodes.map((n) => n.id));
    const selEdges = edges.filter((e) => selIds.has(e.source) && selIds.has(e.target));
    set({ clipboard: { nodes: selNodes, edges: selEdges } });
  },

  pasteClipboard: () => {
    const { clipboard, nodes, edges } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;
    get().pushHistory();
    const OFFSET = 25;
    const ts     = Date.now();
    const idMap  = new Map<string, string>();
    const newNodes = clipboard.nodes.map((n, i) => {
      const newId = `${n.data.gateType}-paste-${ts}-${i}`;
      idMap.set(n.id, newId);
      return { ...n, id: newId, selected: true,
        position: { x: n.position.x + OFFSET, y: n.position.y + OFFSET } };
    });
    const newEdges = clipboard.edges.map((e, i) => ({
      ...e,
      id:     `e-paste-${ts}-${i}`,
      source: idMap.get(e.source) ?? e.source,
      target: idMap.get(e.target) ?? e.target,
    }));
    // 元ノードの選択を解除して新ノードを追加
    set({
      nodes: [...nodes.map((n) => ({ ...n, selected: false })), ...newNodes],
      edges: [...edges, ...newEdges],
    });
  },

  duplicateSelected: () => {
    get().copySelected();
    get().pasteClipboard();
  },

  // ============================================================
  // エッジ分割（ダブルクリック → Junction ノード挿入）
  // ============================================================
  splitEdge: (edgeId, position) => {
    const { nodes, edges, edgeType } = get();
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;
    get().pushHistory();

    const jid = `junction-${Date.now()}`;
    const jNode: Node<GateNodeData> = {
      id: jid, type: 'customGate', position,
      data: { gateType: 'Junction', label: 'JNC', handles: { inputs: 1, outputs: 3 } },
    };
    const baseStyle = { stroke: '#3a3f6e', strokeWidth: 2 };
    const e1: Edge = {
      id: `${jid}-in`, source: edge.source, sourceHandle: edge.sourceHandle ?? null,
      target: jid, targetHandle: 'in-0', type: edgeType, style: baseStyle,
    };
    const e2: Edge = {
      id: `${jid}-out`, source: jid, sourceHandle: 'out-0',
      target: edge.target, targetHandle: edge.targetHandle ?? null, type: edgeType, style: baseStyle,
    };
    set({
      nodes: [...nodes, jNode],
      edges: [...edges.filter((e) => e.id !== edgeId), e1, e2],
    });
  },

  // --- クイックシミュレーション: edgeStates のみ更新、timingData は保持 ---
  quickSimulate: async () => {
    const { nodes, edges, clockStep, simulationResults, customModules } = get();
    if (nodes.length === 0) return;

    const initialStates: Record<string, number> = {};
    if (simulationResults?.timingData) {
      for (const [nid, vals] of Object.entries(simulationResults.timingData)) {
        if (vals.length > 0) initialStates[nid] = vals[vals.length - 1];
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, steps: 1, startStep: clockStep, initialStates, customModules }),
      });
      if (!res.ok) return;
      const result: SimulationResult = await res.json();
      set({
        simulationResults: {
          edgeStates:   { ...result.edgeStates },
          quantumState: { ...result.quantumState },
          timingData:   simulationResults?.timingData ?? {},
        },
      });
    } catch { /* サイレントフェイル */ }
  },

  // --- イベント駆動の自動伝播 (Auto-Propagation) ---
  fastPropagate: async () => {
    const { nodes, edges, clockStep, simulationResults, customModules } = get();
    if (nodes.length === 0) return;

    const initialStates: Record<string, number> = {};
    if (simulationResults?.timingData) {
      for (const [nid, vals] of Object.entries(simulationResults.timingData)) {
        if (vals.length > 0) initialStates[nid] = vals[vals.length - 1];
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // 自動伝播として30ステップ高速計算
        body: JSON.stringify({ nodes, edges, steps: 30, startStep: clockStep, initialStates, customModules }),
      });
      if (!res.ok) return;
      const result: SimulationResult = await res.json();
      
      set((state) => {
        const existing = state.simulationResults?.timingData ?? {};
        const merged: Record<string, number[]> = {};
        for (const [nid, vals] of Object.entries(result.timingData)) {
          // タイミングチャートを汚さないため、最終到達状態の1ステップ分だけを記録
          merged[nid] = [...(existing[nid] ?? []), vals[vals.length - 1]];
        }
        return {
          clockStep: state.clockStep + 1,
          simulationResults: {
            edgeStates:   { ...result.edgeStates },
            quantumState: { ...result.quantumState },
            timingData:   merged,
          },
        };
      });
    } catch { /* サイレントフェイル */ }
    finally {
      get().fetchLogicExpressions();
    }
  },

  // --- 1ステップ実行: timingData の末尾に1ステップ分を追記 ---
  stepSimulate: async () => {
    const { nodes, edges, clockStep, simulationResults, customModules } = get();
    if (nodes.length === 0) return;

    const initialStates: Record<string, number> = {};
    if (simulationResults?.timingData) {
      for (const [nid, vals] of Object.entries(simulationResults.timingData)) {
        if (vals.length > 0) initialStates[nid] = vals[vals.length - 1];
      }
    }

    set({ isSimulating: true });
    try {
      const res = await fetch(`${API_BASE}/api/simulate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, steps: 1, startStep: clockStep, initialStates, customModules }),
      });
      if (!res.ok) return;
      const result: SimulationResult = await res.json();
      set((state) => {
        const existing = state.simulationResults?.timingData ?? {};
        const merged: Record<string, number[]> = {};
        for (const [nid, vals] of Object.entries(result.timingData)) {
          merged[nid] = [...(existing[nid] ?? []), ...vals];
        }
        return {
          clockStep: state.clockStep + 1,
          simulationResults: {
            edgeStates:   { ...result.edgeStates },
            quantumState: { ...result.quantumState },
            timingData:   merged,
          },
        };
      });
    } catch (err) {
      console.warn('[Quantum IDE] ステップ実行エラー:', err);
    } finally {
      set({ isSimulating: false });
      get().fetchLogicExpressions();
    }
  },

  // --- リセット: 全クリア + clockStep を 0 に戻す ---
  resetSimulation: () => {
    set({ simulationResults: null, clockStep: 0 });
  },

  // --- タイミングデータをリセット ---
  clearResults: () => { set({ simulationResults: null }); },

  // --- ファイルから回路を復元 ---
  loadCircuit: (data) => {
    if (data.type === 'quantum_ide_project') {
      if (data.mode === 'quantum') {
        set({
          mode: 'quantum',
          quantumGrid: data.quantumData.grid,
          quantumNumQubits: data.quantumData.numQubits,
          quantumNumSlots: data.quantumData.numSlots || 30,
          quantumSimulationResult: null,
        });
      } else {
        set({
          mode: 'logic',
          nodes: data.logicData.nodes as Node<GateNodeData>[],
          edges: data.logicData.edges,
          simulationResults: null,
          clockStep: 0,
          logicExpressions: null,
        });
      }
    } else {
      // 従来の形式（後方互換性）
      set({
        mode: 'logic',
        nodes: (data.nodes || []) as Node<GateNodeData>[],
        edges: data.edges || [],
        simulationResults: null,
        clockStep: 0,
        logicExpressions: null,
      });
    }
  },

  // --- 論理式抽出 ---
  fetchLogicExpressions: async () => {
    const { nodes, edges } = get();
    if (nodes.length === 0) {
      set({ logicExpressions: null });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/logic-expression`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes, edges, steps: 1, startStep: 0 }),
      });
      if (res.ok) {
        const result = await res.json();
        set({ logicExpressions: result.expressions });
      }
    } catch { /* サイレントフェイル */ }
  },

  // --- カスタムモジュールの保存 ---
  saveCustomModule: (name: string) => {
    const { nodes, edges } = get();
    // 選択されているノードがあればそれらを、なければ全ノードを対象とする
    const selectedNodes = nodes.filter(n => n.selected);
    const targetNodes = selectedNodes.length > 0 ? selectedNodes : nodes;
    
    // エッジは対象ノード間で閉じているもののみ
    const targetNodeIds = new Set(targetNodes.map(n => n.id));
    const targetEdges = edges.filter(e => targetNodeIds.has(e.source) && targetNodeIds.has(e.target));

    const inputs = targetNodes.filter(n => n.data.gateType === 'Switch').length;
    const outputs = targetNodes.filter(n => n.data.gateType === 'LED' || n.data.gateType === 'SevenSeg').length;
    const id = `custom-${Date.now()}`;
    const newModule: CustomModule = {
      id, name, nodes: targetNodes, edges: targetEdges, inputs, outputs
    };
    set(state => ({
      customModules: { ...state.customModules, [id]: newModule }
    }));
  },

  // --- UI表示切り替え ---
  toggleLogicPanel: () => set((state) => ({ showLogicPanel: !state.showLogicPanel })),
  toggleMiniMap: () => set((state) => ({ showMiniMap: !state.showMiniMap })),
  updateNodePosition: (id, x, y) => set((state) => ({
    nodes: state.nodes.map(n => n.id === id ? { ...n, position: { x, y } } : n)
  })),
  setEditingNodeId: (id) => set({ editingNodeId: id }),
  setChartRowOrder: (order) => set({ chartRowOrder: order }),
}));

export default useCircuitStore;
