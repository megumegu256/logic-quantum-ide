"""
真理値表の動作検証スクリプト
AND(sw1, sw2) → LED の回路で全4行を確認する
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from models import CircuitGraphRequest, NodeModel, EdgeModel, NodeData, HandleConfig, Position
from main import truth_table  # FastAPIエンドポイントを直接呼ぶ

# AND(sw1, sw2) → led の回路
nodes = [
    NodeModel(id="sw1", type="customGate", position=Position(x=0, y=0),
              data=NodeData(gateType="Switch", label="A",
                            handles=HandleConfig(inputs=0, outputs=1), params={"value": 0})),
    NodeModel(id="sw2", type="customGate", position=Position(x=0, y=100),
              data=NodeData(gateType="Switch", label="B",
                            handles=HandleConfig(inputs=0, outputs=1), params={"value": 0})),
    NodeModel(id="and1", type="customGate", position=Position(x=200, y=0),
              data=NodeData(gateType="AND", label="AND",
                            handles=HandleConfig(inputs=2, outputs=1))),
    NodeModel(id="led1", type="customGate", position=Position(x=400, y=0),
              data=NodeData(gateType="LED", label="Y",
                            handles=HandleConfig(inputs=1, outputs=0))),
]
edges = [
    EdgeModel(id="e1", source="sw1", sourceHandle="out-0", target="and1", targetHandle="in-0"),
    EdgeModel(id="e2", source="sw2", sourceHandle="out-0", target="and1", targetHandle="in-1"),
    EdgeModel(id="e3", source="and1", sourceHandle="out-0", target="led1", targetHandle="in-0"),
]

req = CircuitGraphRequest(nodes=nodes, edges=edges, steps=1)
result = truth_table(req)

print("inputLabels: ", result.inputLabels)
print("outputLabels:", result.outputLabels)
print()
print("真理値表:")
print(f"  {'A':>3} {'B':>3} | {'Y':>3}")
print("  " + "-" * 13)
for row in result.rows:
    a = row.inputs.get('A', '?')
    b = row.inputs.get('B', '?')
    y = row.outputs.get('Y', '?')
    ok = isinstance(a, int) and isinstance(b, int) and isinstance(y, int) and (a & b) == y
    print(f"  {a:>3} {b:>3} | {y:>3}  {'OK' if ok else 'NG <--'}")

if result.error:
    print("ERROR:", result.error)
