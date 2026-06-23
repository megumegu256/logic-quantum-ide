// autoLayout.ts — ELK.js による Layered + Orthogonal 自動配置
// ELK が計算したノード位置 + エッジパス（bendPoints）の両方を返す。
// React Flow はエッジパスを自前計算せず ELK のルートをそのまま描画する。

// @ts-ignore  – elkjs はバンドル版の型定義が不完全なため抑制
import ELK from 'elkjs/lib/elk.bundled.js';
import type { Node, Edge } from 'reactflow';
import type { GateNodeData } from '../store/useCircuitStore';

const elk = new ELK();

const NODE_W   = 130;
const NODE_H   = 72;
const JCT_SIZE = 20;

export interface ElkLayoutResult {
  nodes:     Node<GateNodeData>[];
  edgePaths: Map<string, string>; // edge id → SVG path string
}

/**
 * ELK layered + ORTHOGONAL ルーティングでノード位置を計算し、
 * エッジの SVG パス文字列（bendPoints から生成）も返す。
 */
export async function calculateElkLayout(
  nodes: Node<GateNodeData>[],
  edges: Edge[],
): Promise<ElkLayoutResult> {
  if (nodes.length === 0) return { nodes, edgePaths: new Map() };

  const nodeSet    = new Set(nodes.map((n) => n.id));
  const validEdges = edges.filter((e) => nodeSet.has(e.source) && nodeSet.has(e.target));

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm':                             'layered',
      'elk.direction':                             'RIGHT',
      'elk.edgeRouting':                           'ORTHOGONAL',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode':                      '50',
      'elk.spacing.edgeEdge':                      '20',
      'elk.spacing.edgeNode':                      '20',
      'elk.layered.nodePlacement.strategy':        'SIMPLE',
      'elk.padding':                               '[top=40,left=40,bottom=40,right=40]',
    },
    children: nodes.map((n) => ({
      id:     n.id,
      width:  n.data.gateType === 'Junction' ? JCT_SIZE : NODE_W,
      height: n.data.gateType === 'Junction' ? JCT_SIZE : NODE_H,
    })),
    edges: validEdges.map((e) => ({
      id:      e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  try {
    // @ts-ignore
    const layout = await elk.layout(elkGraph);

    // ① ノード位置マッピング
    const newNodes = nodes.map((n) => {
      // @ts-ignore
      const en = layout.children?.find((c: { id: string }) => c.id === n.id);
      if (!en || en.x === undefined || en.y === undefined) return n;
      return { ...n, position: { x: en.x, y: en.y } };
    });

    // ② エッジ SVG パス生成（ELK の bendPoints を使用）
    const edgePaths = new Map<string, string>();
    // @ts-ignore
    const elkEdges: any[] = layout.edges ?? [];
    for (const ek of elkEdges) {
      const sections: any[] = ek.sections ?? [];
      if (sections.length === 0) continue;
      const sec = sections[0];
      const pts: Array<{ x: number; y: number }> = [
        sec.startPoint,
        ...(sec.bendPoints ?? []),
        sec.endPoint,
      ].filter(Boolean);
      if (pts.length < 2) continue;
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
      edgePaths.set(ek.id, d);
    }

    return { nodes: newNodes, edgePaths };
  } catch (err) {
    console.error('[ELK Layout] 計算エラー:', err);
    return { nodes, edgePaths: new Map() };
  }
}
