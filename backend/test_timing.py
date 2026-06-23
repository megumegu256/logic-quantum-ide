"""
タイミングチャートの1ステップずれバグ検証
CLK(周期1) → AND → LED の回路で、LED が CLK と同ステップに反応するかを確認する
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from models import CircuitGraphRequest, NodeModel, EdgeModel, NodeData, HandleConfig, Position
from simulator import simulate

# CLK(周期1) → AND(1入力) → LED の最小回路
nodes = [
    NodeModel(id="clk", type="customGate", position=Position(x=0, y=0),
              data=NodeData(gateType="Clock", label="CLK",
                            handles=HandleConfig(inputs=0, outputs=1),
                            params={"pulseInterval": 1})),
    NodeModel(id="and", type="customGate", position=Position(x=200, y=0),
              data=NodeData(gateType="AND", label="AND",
                            handles=HandleConfig(inputs=2, outputs=1))),
    NodeModel(id="led", type="customGate", position=Position(x=400, y=0),
              data=NodeData(gateType="LED", label="LED",
                            handles=HandleConfig(inputs=1, outputs=0))),
]

# Switch(常時ON) も追加してANDの2番目入力に供給
nodes.insert(1, NodeModel(id="sw", type="customGate", position=Position(x=0, y=100),
    data=NodeData(gateType="Switch", label="SW",
                  handles=HandleConfig(inputs=0, outputs=1),
                  params={"value": 1})))

edges = [
    EdgeModel(id="e1", source="clk", sourceHandle="out-0", target="and", targetHandle="in-0"),
    EdgeModel(id="e2", source="sw",  sourceHandle="out-0", target="and", targetHandle="in-1"),
    EdgeModel(id="e3", source="and", sourceHandle="out-0", target="led", targetHandle="in-0"),
]

req = CircuitGraphRequest(nodes=nodes, edges=edges, steps=8)
result = simulate(req)

td = result.timingData
print("ステップ:  ", list(range(8)))
print("CLK:       ", td.get("clk", []))
print("AND:       ", td.get("and", []))
print("LED:       ", td.get("led", []))
print()

clk_data = td.get("clk", [])
and_data = td.get("and", [])
led_data = td.get("led", [])

ok = True
for i in range(len(clk_data)):
    if clk_data[i] != led_data[i]:
        print(f"  NG: t={i} CLK={clk_data[i]} AND={and_data[i]} LED={led_data[i]}  ← LEDがずれている")
        ok = False

if ok:
    print("PASS: LEDはCLKと同ステップで一致しています（遅延なし）")
else:
    print("FAIL: LEDにステップずれが残っています")
