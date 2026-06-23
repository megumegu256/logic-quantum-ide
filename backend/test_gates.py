"""
N入力ゲートの論理動作検証スクリプト
各ゲートについて、2入力・3入力・4入力のすべての組み合わせをテストする
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from models import (
    CircuitGraphRequest, NodeModel, EdgeModel, NodeData, HandleConfig, Position
)
from simulator import simulate

def make_switch(id_, y, value):
    return NodeModel(
        id=id_, type="customGate", position=Position(x=0, y=y),
        data=NodeData(gateType="Switch", label="SW",
                      handles=HandleConfig(inputs=0, outputs=1),
                      params={"value": value})
    )

def make_gate(id_, gate_type, n_in):
    return NodeModel(
        id=id_, type="customGate", position=Position(x=200, y=0),
        data=NodeData(gateType=gate_type, label=gate_type,
                      handles=HandleConfig(inputs=n_in, outputs=1))
    )

def make_led(id_):
    return NodeModel(
        id=id_, type="customGate", position=Position(x=400, y=0),
        data=NodeData(gateType="LED", label="LED",
                      handles=HandleConfig(inputs=1, outputs=0))
    )

def run_gate(gate_type, inputs):
    """指定ゲートに入力リストを流し、LED出力を返す"""
    n = len(inputs)
    nodes = []
    edges = []

    for i, v in enumerate(inputs):
        nodes.append(make_switch(f"sw{i}", i * 50, v))

    nodes.append(make_gate("gate0", gate_type, n))
    nodes.append(make_led("led0"))

    for i in range(n):
        edges.append(EdgeModel(id=f"e_sw{i}", source=f"sw{i}",
                               sourceHandle="out-0", target="gate0",
                               targetHandle=f"in-{i}"))
    edges.append(EdgeModel(id="e_led", source="gate0", sourceHandle="out-0",
                           target="led0", targetHandle="in-0"))

    req = CircuitGraphRequest(nodes=nodes, edges=edges, steps=2)
    result = simulate(req)
    return result.timingData.get("led0", [0])[-1]

def ref_and(inputs): return 1 if all(v == 1 for v in inputs) else 0
def ref_or(inputs):  return 1 if any(v == 1 for v in inputs) else 0
def ref_nand(inputs): return int(not ref_and(inputs))
def ref_nor(inputs):  return int(not ref_or(inputs))

def ref_xor_parity(inputs):
    """XOR の正しい定義: ビット列の偶奇（1の個数が奇数なら1）"""
    count = sum(inputs)
    return count % 2

def ref_xnor_parity(inputs):
    return int(not ref_xor_parity(inputs))

REFS = {
    "AND":  ref_and,
    "OR":   ref_or,
    "NAND": ref_nand,
    "NOR":  ref_nor,
    "XOR":  ref_xor_parity,
}

def all_combos(n):
    """n変数のすべての0/1組み合わせを生成"""
    for mask in range(1 << n):
        yield [(mask >> i) & 1 for i in range(n)]

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"

print("=" * 60)
print("N入力論理ゲート 動作検証")
print("=" * 60)

total_ok = 0
total_ng = 0

for gate_type, ref_fn in REFS.items():
    for n_in in [2, 3, 4]:
        errors = []
        combos = list(all_combos(n_in))
        for inputs in combos:
            actual   = run_gate(gate_type, inputs)
            expected = ref_fn(inputs)
            if actual != expected:
                errors.append((inputs, expected, actual))

        status = PASS if not errors else FAIL
        tag = f"{gate_type} ({n_in}入力)"
        if errors:
            total_ng += 1
            print(f"  {status}  {tag}")
            for inp, exp, got in errors[:4]:   # 最初の4件だけ表示
                print(f"         入力={inp}  期待={exp}  実際={got}")
            if len(errors) > 4:
                print(f"         ... 他 {len(errors)-4} 件のエラー")
        else:
            total_ok += 1
            print(f"  {status}  {tag}  全{len(combos)}組み合わせ OK")

print("=" * 60)
print(f"合計: {total_ok} 成功 / {total_ng} 失敗")
print("=" * 60)
