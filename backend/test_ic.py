from models import CircuitGraphRequest, NodeModel, EdgeModel, CustomModuleModel, NodeData, HandleConfig, Position
from simulator import _flatten_circuit, simulate

nodes = [
    NodeModel(id="sw1", type="customGate", position=Position(x=0,y=0), data=NodeData(gateType="Switch", label="SW", handles=HandleConfig(inputs=0, outputs=1))),
    NodeModel(id="sw2", type="customGate", position=Position(x=0,y=0), data=NodeData(gateType="Switch", label="SW", handles=HandleConfig(inputs=0, outputs=1))),
    NodeModel(id="ic1", type="customGate", position=Position(x=0,y=0), data=NodeData(gateType="CustomIC", label="IC", handles=HandleConfig(inputs=2, outputs=1), params={"customId": "mod1"})),
    NodeModel(id="led1", type="customGate", position=Position(x=0,y=0), data=NodeData(gateType="LED", label="LED", handles=HandleConfig(inputs=1, outputs=0)))
]

edges = [
    EdgeModel(id="e1", source="sw1", sourceHandle="out-0", target="ic1", targetHandle="in-0"),
    EdgeModel(id="e2", source="sw2", sourceHandle="out-0", target="ic1", targetHandle="in-1"),
    EdgeModel(id="e3", source="ic1", sourceHandle="out-0", target="led1", targetHandle="in-0")
]

mod_nodes = [
    NodeModel(id="msw1", type="customGate", position=Position(x=0,y=0), data=NodeData(gateType="Switch", label="SW", handles=HandleConfig(inputs=0, outputs=1))),
    NodeModel(id="msw2", type="customGate", position=Position(x=0,y=10), data=NodeData(gateType="Switch", label="SW", handles=HandleConfig(inputs=0, outputs=1))),
    NodeModel(id="mand1", type="customGate", position=Position(x=0,y=0), data=NodeData(gateType="AND", label="AND", handles=HandleConfig(inputs=2, outputs=1))),
    NodeModel(id="mled1", type="customGate", position=Position(x=0,y=0), data=NodeData(gateType="LED", label="LED", handles=HandleConfig(inputs=1, outputs=0)))
]

mod_edges = [
    EdgeModel(id="me1", source="msw1", sourceHandle="out-0", target="mand1", targetHandle="in-0"),
    EdgeModel(id="me2", source="msw2", sourceHandle="out-0", target="mand1", targetHandle="in-1"),
    EdgeModel(id="me3", source="mand1", sourceHandle="out-0", target="mled1", targetHandle="in-0")
]

mod = CustomModuleModel(id="mod1", name="mod1", nodes=mod_nodes, edges=mod_edges, inputs=2, outputs=1)

req = CircuitGraphRequest(nodes=nodes, edges=edges, steps=2, customModules={"mod1": mod}, initialStates={"sw1": 1, "sw2": 1})

flat_nodes, flat_edges, _ = _flatten_circuit(nodes, edges, {"mod1": mod})
print("FLAT NODES:")
for n in flat_nodes:
    print(f"  {n.id} ({n.data.gateType})")

print("FLAT EDGES:")
for e in flat_edges:
    print(f"  {e.source}:{e.sourceHandle} -> {e.target}:{e.targetHandle}")

res = simulate(req)
print("SIM RESULT:")
print("Timing Data:", res.timingData)
print("Edge States:", res.edgeStates)
