# models.py
# Quantum IDE — Pydantic スキーマ定義

from pydantic import BaseModel
from typing import Any, Dict, List, Optional


class HandleConfig(BaseModel):
    inputs: int
    outputs: int


class NodeData(BaseModel):
    gateType: str
    label: str
    handles: HandleConfig
    isGhost: Optional[bool] = False
    params: Optional[Dict[str, Any]] = None


class Position(BaseModel):
    x: float
    y: float


class NodeModel(BaseModel):
    id: str
    type: str
    position: Position
    data: NodeData


class EdgeModel(BaseModel):
    id: str
    source: str
    sourceHandle: Optional[str] = None
    target: str
    targetHandle: Optional[str] = None
    style: Optional[Dict[str, Any]] = None
    animated: Optional[bool] = None


class CustomModuleModel(BaseModel):
    id: str
    name: str
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    inputs: int
    outputs: int


class CircuitGraphRequest(BaseModel):
    """フロントエンドから送信される回路グラフ全体"""
    nodes: List[NodeModel]
    edges: List[EdgeModel]
    steps: int = 10        # シミュレーションステップ数
    startStep: int = 0     # 開始クロック位置（ステップ実行・クイック実行用）
    initialStates: Optional[Dict[str, int]] = None # 各ノードの直前の出力状態（記憶のアンカー）
    customModules: Optional[Dict[str, CustomModuleModel]] = None



class SimulationResponse(BaseModel):
    """シミュレーション結果レスポンス"""
    edgeStates: Dict[str, int]
    quantumState: Dict[str, Any]
    timingData: Dict[str, List[int]]


class LogicExpressionResponse(BaseModel):
    """論理式抽出レスポンス"""
    expressions: Dict[str, Dict[str, str]] # { nodeId: { text: "...", latex: "..." } }


class ChatRequest(BaseModel):
    """AIチャットリクエスト"""
    message: str
    circuitContext: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    message: str
    suggestion: Optional[Dict[str, Any]] = None


class TruthTableRow(BaseModel):
    inputs:  Dict[str, int]
    outputs: Dict[str, int]


class TruthTableResponse(BaseModel):
    inputLabels:  List[str]
    outputLabels: List[str]
    rows:         List[TruthTableRow]
    error:        Optional[str] = None


class QuantumRequest(BaseModel):
    """量子回路シミュレーションのリクエストモデル"""
    circuit: List[Dict[str, Any]]
    shots: int = 1024
    num_qubits: int = 3
