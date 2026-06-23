# converters.py — 回路エクスポート変換エンジン
from collections import defaultdict, deque
from typing import List
from models import NodeModel, EdgeModel

QUANTUM_GATES = {'H','X','Y','Z','S','T','CX','CCX','Measure'}

def _topo(nodes, edges):
    node_map = {n.id: n for n in nodes}
    adj = defaultdict(list); in_d = {n.id: 0 for n in nodes}
    for e in edges:
        if e.source in node_map and e.target in node_map:
            adj[e.source].append(e.target); in_d[e.target] += 1
    q = deque(n for n in nodes if in_d[n.id] == 0); res = []
    while q:
        nd = q.popleft(); res.append(nd)
        for nid in adj[nd.id]:
            in_d[nid] -= 1
            if in_d[nid] == 0: q.append(node_map[nid])
    vis = {n.id for n in res}; res.extend(n for n in nodes if n.id not in vis)
    return res

def _build_qubit_map(q_nodes, edges):
    q_ids = {n.id for n in q_nodes}
    q_in = defaultdict(set)
    for e in edges:
        if e.source in q_ids and e.target in q_ids:
            q_in[e.target].add(e.source)
    src = [n for n in q_nodes if not q_in[n.id]]
    n_q = max(1, len(src))
    qmap = {n.id: i for i, n in enumerate(src)}
    for nd in q_nodes:
        if nd.id not in qmap:
            for s in q_in[nd.id]:
                if s in qmap: qmap[nd.id] = qmap[s]; break
            if nd.id not in qmap: qmap[nd.id] = 0
    return qmap, n_q

def _apply_qc(qc, gate, q, n_q):
    if gate=='H': qc.h(q)
    elif gate=='X': qc.x(q)
    elif gate=='Y': qc.y(q)
    elif gate=='Z': qc.z(q)
    elif gate=='S': qc.s(q)
    elif gate=='T': qc.t(q)
    elif gate=='CX' and n_q>=2: qc.cx(q,(q+1)%n_q)
    elif gate=='CCX' and n_q>=3: qc.ccx(0,1,2)
    elif gate=='Measure': qc.measure(q,q)

# ============================================================
# QASM 2.0
# ============================================================
def export_qasm(nodes: List[NodeModel], edges: List[EdgeModel]) -> str:
    q_nodes = [n for n in nodes if n.data.gateType in QUANTUM_GATES]
    if not q_nodes:
        return 'OPENQASM 2.0;\ninclude "qelib1.inc";\n// 量子ゲートなし\n'
    try:
        from qiskit import QuantumCircuit
        qmap, n_q = _build_qubit_map(q_nodes, edges)
        has_m = any(n.data.gateType=='Measure' for n in q_nodes)
        qc = QuantumCircuit(n_q, n_q if has_m else 0)
        for nd in _topo(q_nodes, edges):
            if nd.data.gateType in QUANTUM_GATES:
                _apply_qc(qc, nd.data.gateType, qmap.get(nd.id,0), n_q)
        try:
            from qiskit.qasm2 import dumps; return dumps(qc)
        except ImportError:
            return qc.qasm()
    except Exception as e:
        return f'// エラー: {e}\nOPENQASM 2.0;\n'

# ============================================================
# Qiskit Python スクリプト
# ============================================================
def export_python(nodes: List[NodeModel], edges: List[EdgeModel]) -> str:
    q_nodes = [n for n in nodes if n.data.gateType in QUANTUM_GATES]
    L = ['# Quantum IDE — 自動生成 Qiskit スクリプト',
         'from qiskit import QuantumCircuit','from qiskit_aer import AerSimulator',
         'import numpy as np','']
    if not q_nodes:
        L += ['qc = QuantumCircuit(1)','# 量子ゲートが回路にありません']
    else:
        qmap, n_q = _build_qubit_map(q_nodes, edges)
        has_m = any(n.data.gateType=='Measure' for n in q_nodes)
        L.append(f'qc = QuantumCircuit({n_q}{", "+str(n_q) if has_m else ""})')
        for nd in _topo(q_nodes, edges):
            g = nd.data.gateType; q = qmap.get(nd.id,0)
            if g=='H': L.append(f'qc.h({q})')
            elif g=='X': L.append(f'qc.x({q})')
            elif g=='Y': L.append(f'qc.y({q})')
            elif g=='Z': L.append(f'qc.z({q})')
            elif g=='S': L.append(f'qc.s({q})')
            elif g=='T': L.append(f'qc.t({q})')
            elif g=='CX' and n_q>=2: L.append(f'qc.cx({q},{(q+1)%n_q})')
            elif g=='CCX' and n_q>=3: L.append('qc.ccx(0,1,2)')
            elif g=='Measure': L.append(f'qc.measure({q},{q})')
    L += ['','# シミュレーション','qc.save_statevector()',
          "sim = AerSimulator(method='statevector')",
          'result = sim.run(qc).result()',
          'sv = np.array(result.get_statevector(qc))',
          f'probs={{format(i,f"0{{qc.num_qubits}}b"):round(float(abs(a)**2),4) for i,a in enumerate(sv) if abs(a)**2>1e-6}}',
          'print("確率分布:", probs)']
    return '\n'.join(L)

# ============================================================
# Structural Verilog
# ============================================================
def export_verilog(nodes: List[NodeModel], edges: List[EdgeModel]) -> str:
    def vid(nid): return 'n_' + nid.replace('-','_')[:18]
    sorted_n = _topo(nodes, edges)
    in_nodes  = [n for n in sorted_n if n.data.gateType in ('Switch','Clock')]
    out_nodes = [n for n in sorted_n if n.data.gateType in ('LED','SevenSeg')]
    mid_nodes = [n for n in sorted_n if n not in in_nodes and n not in out_nodes]
    input_map = {}
    for e in edges:
        si = int((e.sourceHandle or 'out-0').split('-')[-1])
        ti = int((e.targetHandle or 'in-0').split('-')[-1])
        src_wire = vid(e.source) if any(n.id==e.source for n in in_nodes) else f'{vid(e.source)}_o{si}'
        input_map[(e.target,ti)] = src_wire
    def gi(nid,i): return input_map.get((nid,i),"1'b0")
    L = ['// Quantum IDE — Structural Verilog','module circuit(']
    ports = []
    if in_nodes:  ports.append('  input  '+', '.join(vid(n.id) for n in in_nodes))
    if out_nodes: ports.append('  output '+', '.join(vid(n.id) for n in out_nodes))
    L.append(',\n'.join(ports)); L.append(');'); L.append('')
    if mid_nodes:
        L.append('  // 内部ワイヤ')
        for n in mid_nodes:
            for i in range(max(1,n.data.handles.outputs)):
                L.append(f'  wire {vid(n.id)}_o{i};')
        L.append('')
    L.append('  // ゲートインスタンス')
    for n in mid_nodes:
        g=n.data.gateType; o=f'{vid(n.id)}_o0'
        if g=='AND':  L.append(f'  and({o},{gi(n.id,0)},{gi(n.id,1)});')
        elif g=='OR': L.append(f'  or({o},{gi(n.id,0)},{gi(n.id,1)});')
        elif g=='NOT':L.append(f'  not({o},{gi(n.id,0)});')
        elif g=='NAND':L.append(f'  nand({o},{gi(n.id,0)},{gi(n.id,1)});')
        elif g=='XOR': L.append(f'  xor({o},{gi(n.id,0)},{gi(n.id,1)});')
        else: L.append(f'  // {g} {vid(n.id)}')
    if out_nodes:
        L.append(''); L.append('  // 出力代入')
        for n in out_nodes: L.append(f'  assign {vid(n.id)} = {gi(n.id,0)};')
    L += ['','endmodule']
    return '\n'.join(L)

# ============================================================
# Logisim XML
# ============================================================
def export_logisim(nodes: List[NodeModel], edges: List[EdgeModel]) -> str:
    import xml.etree.ElementTree as ET
    MAP = {'AND':('1','AND Gate'),'OR':('1','OR Gate'),'NOT':('1','NOT Gate'),
           'NAND':('1','NAND Gate'),'XOR':('1','XOR Gate'),
           'Switch':('0','Pin'),'LED':('5','LED'),'Clock':('0','Clock')}
    root = ET.Element('project',version='1.0')
    for d,nm in [('#Wiring','0'),('#Gates','1'),('#I/O','5')]:
        ET.SubElement(root,'lib',desc=d,name=nm)
    circ = ET.SubElement(root,'circuit',name='circuit')
    for i,n in enumerate(nodes):
        if n.data.gateType not in MAP: continue
        lib,cname = MAP[n.data.gateType]
        x=int(n.position.x//2)*10+100; y=int(n.position.y//2)*10+100
        comp=ET.SubElement(circ,'comp',lib=lib,loc=f'({x},{y})',name=cname)
        if n.data.gateType=='Switch': ET.SubElement(comp,'a',name='output',val='true')
    try: ET.indent(root,space='  ')
    except: pass
    return '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n'+ET.tostring(root,encoding='unicode')
