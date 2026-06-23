# simulator.py
# Quantum IDE — シミュレーションエンジン（マルチステップ・反復緩和法対応版）
#
# 【Phase 14 設計変更点】
#   - トポロジカルソートの完全破棄（循環参照の制約をなくす）
#   - 反復緩和法（Fixed-Point Iteration）の導入
#   - 状態が安定するまで（または MAX_ITERATIONS ＝ 50 に達するまで）同一Tick内で状態伝播を繰り返す

import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from models import CircuitGraphRequest, EdgeModel, NodeModel, SimulationResponse

logger = logging.getLogger(__name__)

QUANTUM_GATES = {'H', 'X', 'Y', 'Z', 'S', 'T', 'CX', 'CCX', 'Measure'}
MAX_ITERATIONS = 50


# ============================================================
# 量子回路シミュレーション（Qiskit + Aer）
# ============================================================
def _simulate_quantum(quantum_nodes: List[NodeModel], edges: List[EdgeModel]) -> Dict[str, Any]:
    if not quantum_nodes:
        return {}
    try:
        import numpy as np
        from qiskit import QuantumCircuit
        from qiskit_aer import AerSimulator

        q_ids = {n.id for n in quantum_nodes}
        q_inputs: Dict[str, set] = defaultdict(set)
        for edge in edges:
            if edge.source in q_ids and edge.target in q_ids:
                q_inputs[edge.target].add(edge.source)

        source_nodes = [n for n in quantum_nodes if not q_inputs[n.id]]
        n_qubits = max(1, len(source_nodes))
        qubit_map: Dict[str, int] = {n.id: i for i, n in enumerate(source_nodes)}
        for node in quantum_nodes:
            if node.id not in qubit_map:
                for src_id in q_inputs[node.id]:
                    if src_id in qubit_map:
                        qubit_map[node.id] = qubit_map[src_id]
                        break
                if node.id not in qubit_map:
                    qubit_map[node.id] = 0

        qc = QuantumCircuit(n_qubits)
        for node in quantum_nodes:
            gate = node.data.gateType
            q = qubit_map.get(node.id, 0)
            if gate == 'H':
                qc.h(q)
            elif gate == 'X':
                qc.x(q)
            elif gate == 'Y':
                qc.y(q)
            elif gate == 'Z':
                qc.z(q)
            elif gate == 'S':
                qc.s(q)
            elif gate == 'T':
                qc.t(q)
            elif gate == 'CX' and n_qubits >= 2:
                qc.cx(q, (q + 1) % n_qubits)
            elif gate == 'CCX' and n_qubits >= 3:
                qc.ccx(0, 1, 2)

        qc.save_statevector()
        sim = AerSimulator(method='statevector')
        result = sim.run(qc).result()
        sv = np.array(result.get_statevector(qc))
        probs = {
            format(i, f'0{n_qubits}b'): round(float(abs(amp) ** 2), 4)
            for i, amp in enumerate(sv)
            if abs(amp) ** 2 > 1e-6
        }
        return {'n_qubits': n_qubits, 'probabilities': probs, 'circuit_depth': qc.depth()}
    except Exception as exc:
        logger.warning(f'量子シミュレーションエラー: {exc}')
        return {'error': str(exc), 'n_qubits': 0, 'probabilities': {}}

def _flatten_circuit(nodes: List[NodeModel], edges: List[EdgeModel], custom_modules: Dict[str, Any]) -> Tuple[List[NodeModel], List[EdgeModel], Dict[str, str]]:
    """CustomICノードを展開し、純粋なグラフデータの物理的マクロ展開としてフラットなリストを返す。"""
    flat_nodes = []
    import copy
    
    routing_out = defaultdict(list)
    routing_in = {}
    
    def expand(node, prefix_id=""):
        c_id = node.data.params.get('customId') if node.data.params else None
        if not c_id or not custom_modules or c_id not in custom_modules:
            flat_nodes.append(node)
            return
        
        mod = custom_modules[c_id]
        mod_prefix = prefix_id + node.id + "_"
        
        switches = sorted([n for n in mod.nodes if n.data.gateType == 'Switch'], key=lambda x: x.position.y)
        leds = sorted([n for n in mod.nodes if n.data.gateType in ('LED', 'SevenSeg')], key=lambda x: x.position.y)
        
        sw_map = {sw.id: i for i, sw in enumerate(switches)}
        led_map = {led.id: i for i, led in enumerate(leds)}
        
        for sub_n in mod.nodes:
            if sub_n.data.gateType in ('Switch', 'LED', 'SevenSeg'):
                continue
            new_n = copy.deepcopy(sub_n)
            new_n.id = mod_prefix + sub_n.id
            if new_n.data.gateType == 'CustomIC':
                expand(new_n, mod_prefix)
            else:
                flat_nodes.append(new_n)
                
        for sub_e in mod.edges:
            src = sub_e.source
            tgt = sub_e.target
            src_key = (mod_prefix + src, sub_e.sourceHandle or 'out-0')
            tgt_key = (mod_prefix + tgt, sub_e.targetHandle or 'in-0')
            
            if src in sw_map:
                idx = sw_map[src]
                src_key = (prefix_id + node.id, f"in-{idx}")
            if tgt in led_map:
                idx = led_map[tgt]
                tgt_key = (prefix_id + node.id, f"out-{idx}")
                
            routing_out[src_key].append(tgt_key)
            routing_in[tgt_key] = src_key

    for node in nodes:
        if node.data.gateType == 'CustomIC':
            expand(node)
        else:
            flat_nodes.append(node)
            
    for edge in edges:
        src_key = (edge.source, edge.sourceHandle or 'out-0')
        tgt_key = (edge.target, edge.targetHandle or 'in-0')
        routing_out[src_key].append(tgt_key)
        routing_in[tgt_key] = src_key
        
    final_edges = []
    
    def resolve_targets(curr_key, visited):
        if curr_key in visited:
            return []
        visited.add(curr_key)
        real_targets = []
        for nxt in routing_out[curr_key]:
            nxt_node = nxt[0]
            is_real = any(n.id == nxt_node for n in flat_nodes)
            if is_real:
                real_targets.append(nxt)
            else:
                real_targets.extend(resolve_targets(nxt, visited))
        visited.remove(curr_key)
        return real_targets

    edge_id_counter = 0
    for node in flat_nodes:
        for out_idx in range(max(1, node.data.handles.outputs)):
            src_key = (node.id, f"out-{out_idx}")
            targets = resolve_targets(src_key, set())
            for tgt in targets:
                final_edges.append(EdgeModel(
                    id=f"macro_edge_{edge_id_counter}",
                    source=src_key[0],
                    sourceHandle=src_key[1],
                    target=tgt[0],
                    targetHandle=tgt[1],
                    type="default"
                ))
                edge_id_counter += 1

    return flat_nodes, final_edges, routing_in

# ============================================================
# メインシミュレーション（反復緩和法による論理エンジン）
# ============================================================
def simulate(request: CircuitGraphRequest) -> SimulationResponse:
    if not request.nodes:
        return SimulationResponse(edgeStates={}, quantumState={}, timingData={})

    steps = max(1, request.steps)
    start = max(0, request.startStep)
    total_steps = start + steps

    # CustomICの展開
    flat_nodes, flat_edges, routing_in = _flatten_circuit(request.nodes, request.edges, request.customModules)
    
    # 元のノードIDだけでなく、全ての物理ノードのIDをタイミングデータ用に保持する
    # これにより内部フリップフロップなどの状態も initialStates に保存される
    timing_data: Dict[str, List[int]] = {}

    # 以降はフラット展開されたノード・エッジでシミュレーションを行う
    nodes_for_sim = flat_nodes
    edges_for_sim = flat_edges
    
    # 入力マップの構築 (target_id, in_idx) -> (source_id, out_idx)
    input_map: Dict[Tuple[str, str], Tuple[str, str]] = {}
    for edge in edges_for_sim:
        th = edge.targetHandle or 'in-0'
        sh = edge.sourceHandle or 'out-0'
        input_map[(edge.target, th)] = (edge.source, sh)

    # 初期状態（t=0が始まる前の過去の記憶）
    prev_state: Dict[str, Dict[int, int]] = {}
    if request.initialStates:
        for nid, val in request.initialStates.items():
            prev_state[nid] = {0: val}

    # デフォルトの0埋め
    for node in nodes_for_sim:
        if node.id not in prev_state:
            prev_state[node.id] = {i: 0 for i in range(max(1, node.data.handles.outputs))}

    last_node_output: Dict[str, Dict[int, int]] = {k: v.copy() for k, v in prev_state.items()}

    # --- 完全同期・並列更新モデル (Synchronous Parallel Update) ---
    # t=0 ではなく、要求された start から必要な steps 分だけ正確に時間を進める
    for t in range(start, start + steps):
        # 時間依存入力 (Switch / Clock) の設定
        step_overrides: Dict[str, Dict[int, int]] = {}
        for node in nodes_for_sim:
            gate = node.data.gateType
            params = node.data.params or {}

            if gate == 'Switch':
                val = int(params.get('value', 0))
                step_overrides[node.id] = {0: val}
            elif gate == 'Clock':
                interval = max(1, int(params.get('pulseInterval', 2)))
                # t=0 から LOW(0) 始まり: 0→HIGH, 1→LOW の順
                clock_val = (t // interval) % 2
                step_overrides[node.id] = {0: clock_val}

        # そのTickでの計算を開始する際、まずは前のTickの状態をコピーする（読み取り専用の「過去」）
        current_state = {k: v.copy() for k, v in prev_state.items()}
        
        # 定数（Switch/Clock）を事前注入
        for nid, vals in step_overrides.items():
            current_state[nid] = vals

        def get_input(state: Dict[str, Dict[int, int]], nid: str, idx: int) -> int:
            key = (nid, f'in-{idx}')
            if key in input_map:
                src_id, src_handle = input_map[key]
                src_idx = int(src_handle.split('-')[-1]) if '-' in src_handle else 0
                return state.get(src_id, {}).get(src_idx, 0)
            return 0

        def compute_next(working: Dict[str, Dict[int, int]]) -> Dict[str, Dict[int, int]]:
            """working ステート を参照してすべての組み合わせ回路ノードを1回評価する"""
            result = {k: v.copy() for k, v in working.items()}
            for node in nodes_for_sim:
                nid = node.id
                # Switch/Clock は step_overrides で確定済み
                if nid in step_overrides:
                    result[nid] = step_overrides[nid]
                    continue
                gate = node.data.gateType
                out: Dict[int, int] = {}
                n_in = node.data.handles.inputs

                if gate == 'AND':
                    res = 1
                    for i in range(max(2, n_in)):
                        if get_input(working, nid, i) == 0:
                            res = 0; break
                    out[0] = res
                elif gate == 'OR':
                    res = 0
                    for i in range(max(2, n_in)):
                        if get_input(working, nid, i) == 1:
                            res = 1; break
                    out[0] = res
                elif gate == 'NOR':
                    res = 0
                    for i in range(max(2, n_in)):
                        if get_input(working, nid, i) == 1:
                            res = 1; break
                    out[0] = int(not res)
                elif gate == 'NOT':
                    out[0] = int(not get_input(working, nid, 0))
                elif gate == 'NAND':
                    res = 1
                    for i in range(max(2, n_in)):
                        if get_input(working, nid, i) == 0:
                            res = 0; break
                    out[0] = int(not res)
                elif gate == 'XOR':
                    res = 0
                    for i in range(max(2, n_in)):
                        res ^= get_input(working, nid, i)
                    out[0] = res
                elif gate == 'LED':
                    out[0] = get_input(working, nid, 0)
                elif gate == 'SevenSeg':
                    val = 0
                    for i in range(4):
                        if get_input(working, nid, i) == 1:
                            val |= (1 << i)
                    out[0] = val
                elif gate == 'Junction':
                    in_val = get_input(working, nid, 0)
                    for i in range(max(1, node.data.handles.outputs)):
                        out[i] = in_val
                elif gate in QUANTUM_GATES:
                    for i in range(node.data.handles.outputs):
                        out[i] = get_input(working, nid, i % n_in) if n_in > 0 else 0
                else:
                    out[0] = 0
                result[nid] = out
            return result

        # ── Tick 内安定化ループ ──────────────────────────────────
        # Switch/Clock の値を注入した current_state を起点に、
        # 組み合わせ回路が安定する（=前の評価と変化なし）まで最大 MAX_SETTLE_ITER 回繰り返す。
        # これにより CLK→AND→LED のような連鎖が同一 Tick 内で完全伝播する。
        MAX_SETTLE_ITER = len(nodes_for_sim) + 2
        working_state = current_state.copy()
        for _ in range(MAX_SETTLE_ITER):
            new_state = compute_next(working_state)
            if new_state == working_state:
                break
            working_state = new_state
        next_state = working_state

        # 次のTickのために状態をシフト
        prev_state = next_state
        last_node_output = next_state

        # 指定された開始ステップ以降なら結果に記録
        if t >= start:
            for node in nodes_for_sim:
                val = next_state.get(node.id, {}).get(0, 0)
                if node.id not in timing_data:
                    timing_data[node.id] = []
                timing_data[node.id].append(val)

    def get_real_source(curr_key):
        if curr_key in routing_in:
            prev = routing_in[curr_key]
            if any(n.id == prev[0] for n in nodes_for_sim):
                return prev
            else:
                return get_real_source(prev)
        return curr_key

    # ---- 最終ステップのエッジ状態 ----
    edge_states: Dict[str, int] = {}
    for edge in request.edges:
        sh = edge.sourceHandle or 'out-0'
        src_key = (edge.source, sh)
        
        real_id, real_handle = get_real_source(src_key)
        src_idx = int(real_handle.split('-')[-1]) if '-' in real_handle else 0
        
        edge_states[edge.id] = last_node_output.get(real_id, {}).get(src_idx, 0)

    # ---- 量子シミュレーション（最終ステップのみ） ----
    quantum_nodes = [n for n in nodes_for_sim if n.data.gateType in QUANTUM_GATES]
    quantum_state = _simulate_quantum(quantum_nodes, edges_for_sim)

    logger.info(f'シミュレーション完了: start={start}, steps={steps}, total={total_steps}, nodes={len(request.nodes)}')
    return SimulationResponse(
        edgeStates=edge_states,
        quantumState=quantum_state,
        timingData=timing_data,
    )


# ============================================================
# 論理式抽出（ASTの構築とテキスト/LaTeX生成）
# ============================================================
def extract_logic_expressions(request: CircuitGraphRequest) -> 'LogicExpressionResponse':
    from models import LogicExpressionResponse
    
    input_map: Dict[Tuple[str, str], Tuple[str, str]] = {}
    for edge in request.edges:
        th = edge.targetHandle or 'in-0'
        sh = edge.sourceHandle or 'out-0'
        input_map[(edge.target, th)] = (edge.source, sh)

    node_dict = {n.id: n for n in request.nodes}
    
    # 循環参照を防ぐための訪問済みセット（パスごと）
    def build_ast(nid: str, visited: set, is_root: bool = False) -> Tuple[str, str]:
        if nid in visited:
            loop_node = node_dict.get(nid)
            lbl = loop_node.data.params.get('label') if loop_node and loop_node.data.params else None
            if not lbl:
                lbl = f"{loop_node.data.gateType}_{nid[:4]}" if loop_node else "(LOOP)"
            return (lbl, f"\\text{{{lbl}}}")
        
        node = node_dict.get(nid)
        if not node:
            return ("0", "0")
            
        gate = node.data.gateType
        n_in = node.data.handles.inputs
        
        lbl = node.data.params.get('label') if node.data.params and node.data.params.get('label') else None
        
        if gate == 'Switch':
            if not lbl: lbl = f"SW_{nid[:4]}"
            return (lbl, f"\\text{{{lbl}}}")
        elif gate == 'Clock':
            if not lbl: lbl = f"CLK_{nid[:4]}"
            return (lbl, f"\\text{{{lbl}}}")
            
        # 入力を収集
        inputs_ast = []
        for i in range(n_in):
            key = (nid, f'in-{i}')
            if key in input_map:
                src_id, src_handle = input_map[key]
                child_text, child_latex = build_ast(src_id, visited | {nid}, False)
                inputs_ast.append((child_text, child_latex))
            else:
                inputs_ast.append(("0", "0"))
                
        if not inputs_ast:
            inputs_ast = [("0", "0")]

        if gate == 'AND':
            txt = " * ".join([f"({t})" if len(t)>1 and t[0]!='(' else t for t, _ in inputs_ast])
            ltx = " \\cdot ".join([f"({l})" if len(l)>1 and l[0]!='(' and not l.startswith('\\') else l for _, l in inputs_ast])
            return (f"({txt})", f"({ltx})")
        elif gate == 'OR':
            txt = " + ".join([f"({t})" if len(t)>1 and t[0]!='(' else t for t, _ in inputs_ast])
            ltx = " + ".join([f"({l})" if len(l)>1 and l[0]!='(' and not l.startswith('\\') else l for _, l in inputs_ast])
            return (f"({txt})", f"({ltx})")
        elif gate == 'NOT':
            t, l = inputs_ast[0]
            t_str = f"~({t})" if len(t)>1 and t[0]!='(' else f"~{t}"
            l_str = f"\\overline{{{l}}}"
            return (t_str, l_str)
        elif gate == 'NAND':
            txt = " * ".join([f"({t})" if len(t)>1 and t[0]!='(' else t for t, _ in inputs_ast])
            ltx = " \\cdot ".join([f"({l})" if len(l)>1 and l[0]!='(' and not l.startswith('\\') else l for _, l in inputs_ast])
            return (f"~({txt})", f"\\overline{{{ltx}}}")
        elif gate == 'NOR':
            txt = " + ".join([f"({t})" if len(t)>1 and t[0]!='(' else t for t, _ in inputs_ast])
            ltx = " + ".join([f"({l})" if len(l)>1 and l[0]!='(' and not l.startswith('\\') else l for _, l in inputs_ast])
            return (f"~({txt})", f"\\overline{{{ltx}}}")
        elif gate == 'XOR':
            txt = " ^ ".join([f"({t})" if len(t)>1 and t[0]!='(' else t for t, _ in inputs_ast])
            ltx = " \\oplus ".join([f"({l})" if len(l)>1 and l[0]!='(' and not l.startswith('\\') else l for _, l in inputs_ast])
            return (f"({txt})", f"({ltx})")
        elif gate in ('LED', 'SevenSeg', 'Junction'):
            return inputs_ast[0]
        else:
            if not lbl:
                lbl = node.data.label if node.data.label else f"{gate}_{nid[:4]}"
            return (lbl, f"\\text{{{lbl}}}")

    expressions = {}
    for node in request.nodes:
        if node.data.gateType in ('LED', 'SevenSeg'):
            lbl = node.data.params.get('label') if node.data.params else None
            out_name = lbl if lbl else node.data.label
            if not out_name:
                out_name = f"{node.data.gateType}_{node.id[:4]}"
                
            t, l = build_ast(node.id, set(), True)
            expressions[node.id] = {
                'text': f"{out_name} = {t}",
                'latex': f"\\text{{{out_name}}} = {l}"
            }
            
    return LogicExpressionResponse(expressions=expressions)

