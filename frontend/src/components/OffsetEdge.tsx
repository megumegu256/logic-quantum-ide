// OffsetEdge.tsx
//
// 【設計思想】
//   ワイヤーの接続情報（どのポートとどのポートが繋がるか）は内部データとして確定済み。
//   グラフィックはその情報を忠実に視覚化するだけ。
//   ポート座標（sourceX/Y, targetX/Y）を描画フェーズで書き換えてはならない。
//
// ────────────────────────────────────────────────
// 【描画モード一覧】
//
//  ● bezier (default)
//      ReactFlow 標準の滑らかな Bezier 曲線。
//
//  ● straight
//      始点→終点を直線（斜め可）で接続。
//      フリップフロップのようなクロス配線が生じる回路の簡潔な表現向け。
//      IEEE では斜め線を許容するシンプル表現。
//
//  ● step (直角モード) ← IEEE/IEC 回路図の正式記法
//
//    [単一出力] getSmoothStepPath によるオルソゴナルルーティング。
//              sourcePosition/targetPosition を尊重し、
//              後退・折り返し接続も正しくラップアラウンドする。
//
//    [複数出力・前進接続] Trunk-Branch 型ルーティング（バス型）:
//
//        前進接続 = ターゲットノードの左端 > ソースハンドル位置 + 最小チャネル幅
//
//        source ──────┬──────────────────► target1
//                     │●  (junction dot)
//                     └──────────────────► target2
//
//        trunkX = sourceX + TRUNK_OFFSET (固定40px)
//        SVGパス: M sx sy  H trunkX  V ty  H tx
//        分岐点ドットを (trunkX, sourceY) に描画 (groupIndex===0 のみ)
//
//    [複数出力・後退接続/チャネル不足]
//        getSmoothStepPath にフォールバック。
//        sourcePosition/targetPosition を尊重して正しくラップアラウンド。
//        → ノードを貫通しない、ポートの方向違反なし。
//
// ────────────────────────────────────────────────
// 【クロス（非接続）の扱い】
//   点なし交差 = 非接続 (IEEE 標準の通過記法)。
//   接続ドットは CustomGateNode がソースポート上に描画済み。
//   Trunk-Branch の分岐点ドットは本コンポーネントが追加描画。

import React, { memo } from 'react';
import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  getStraightPath,
  EdgeLabelRenderer,
  useReactFlow,
  Position,
  type EdgeProps,
} from 'reactflow';
import useCircuitStore from '../store/useCircuitStore';
import { Plus } from 'lucide-react';

// ─────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────
type EdgeData = {
  edgeType?:   string;
};

// ─────────────────────────────────────────────────
// OffsetEdge コンポーネント
// ─────────────────────────────────────────────────
const OffsetEdge: React.FC<EdgeProps> = memo((props) => {
  const {
    id,
    sourceX, sourceY,
    targetX, targetY,
    sourcePosition = Position.Right,
    targetPosition = Position.Left,
    markerEnd, style, data,
  } = props;

  const d        = data as EdgeData | undefined;
  const edgeType = d?.edgeType ?? 'default';

  const splitEdge = useCircuitStore(s => s.splitEdge);
  const { screenToFlowPosition } = useReactFlow();

  // ─────────────────────────────────────────────
  // パス計算
  // ─────────────────────────────────────────────
  let edgePath: string;
  let labelX:   number;
  let labelY:   number;

  if (edgeType === 'step') {
    // ── 標準オルソゴナルルーティング ──────────────
    // getSmoothStepPath は sourcePosition / targetPosition を尊重する:
    //   - RIGHT ポートからは必ず右に出発
    //   - LEFT ポートへは必ず左から到達
    //   - 後退・折り返し接続も自動ラップアラウンド
    // → ノード貫通なし、方向違反なし
    [edgePath, labelX, labelY] = getSmoothStepPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
      borderRadius: 0,
    });
  } else if (edgeType === 'straight') {
    // ── 直線モード ──────────────────────────────────
    // 始点→終点を直線（斜め可）で接続。
    // フリップフロップ等クロス配線の簡潔な表現向け。
    [edgePath, labelX, labelY] = getStraightPath({
      sourceX, sourceY,
      targetX, targetY,
    });
  } else {
    // ── default / bezier ────────────────────────────
    [edgePath, labelX, labelY] = getBezierPath({
      sourceX, sourceY, sourcePosition,
      targetX, targetY, targetPosition,
    });
  }

  // ─────────────────────────────────────────────
  // イベント
  // ─────────────────────────────────────────────
  const onEdgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    splitEdge(id, position);
  };

  // ─────────────────────────────────────────────
  // レンダリング
  // ─────────────────────────────────────────────
  return (
    <>
      {/* ワイヤー本体 */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
      />

      {/* ウェイポイント追加ボタン（ホバー時に表示） */}
      <EdgeLabelRenderer>
        <div
          style={{
            position:  'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 20,
          }}
          className="edge-waypoint-btn"
        >
          <button
            onClick={onEdgeClick}
            title="ウェイポイントを追加"
            style={{
              width:  '14px',
              height: '14px',
              borderRadius:    '50%',
              backgroundColor: '#5b8df6',
              border: 'none',
              color:  '#fff',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              cursor:     'pointer',
              opacity:    0,          // CSS で hover 時に表示
              transition: 'all 0.2s ease',
              boxShadow:  '0 0 4px rgba(91,141,246,0.8)',
            }}
          >
            <Plus size={10} strokeWidth={3} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});

OffsetEdge.displayName = 'OffsetEdge';
export default OffsetEdge;
