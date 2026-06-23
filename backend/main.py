# main.py
# Quantum IDE — FastAPI アプリケーション

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from models import CircuitGraphRequest, SimulationResponse, ChatRequest, ChatResponse, TruthTableResponse, LogicExpressionResponse, QuantumRequest
from simulator import simulate, extract_logic_expressions
from quantum_simulator import run_simulation
from ai_agent import generate_response

# ログ設定（日本語）
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)

# ============================================================
# FastAPI アプリ初期化
# ============================================================
app = FastAPI(
    title="Quantum IDE バックエンドAPI",
    description="量子・論理回路シミュレーターのバックエンドAPI",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ============================================================
# CORS 設定
# フロントエンド（http://localhost:5173）からのアクセスを許可
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# エンドポイント定義
# ============================================================

@app.get("/")
def root():
    """ヘルスチェック"""
    logger.info("ルートエンドポイントへのアクセス")
    return {"message": "Quantum IDE バックエンドAPI が起動中です", "status": "ok"}


@app.post("/api/simulate", response_model=SimulationResponse)
def simulate_circuit(request: CircuitGraphRequest) -> SimulationResponse:
    """
    回路グラフ (nodes + edges) を受け取り、シミュレーション結果を返す。

    処理順序:
      1. トポロジカルソート
      2. 論理ゲートの真理値計算
      3. Qiskit による量子回路の状態ベクトル計算
      4. タイミングデータ履歴の更新・返却

    レスポンス形式:
      {
        "edgeStates":   { "<edgeId>": 0 | 1, ... },
        "quantumState": { "n_qubits": N, "probabilities": {...}, ... },
        "timingData":   { "<nodeId>": [0, 1, 1, 0, ...], ... }
      }
    """
    logger.info(
        f"シミュレーションリクエスト受信: "
        f"ノード数={len(request.nodes)}, エッジ数={len(request.edges)}"
    )
    result = simulate(request)
    logger.info(
        f"シミュレーション完了: "
        f"エッジ状態={len(result.edgeStates)}本, "
        f"タイミングノード={len(result.timingData)}個"
    )
    return result

@app.post("/api/logic-expression", response_model=LogicExpressionResponse)
def logic_expression(request: CircuitGraphRequest) -> LogicExpressionResponse:
    """
    回路グラフから論理式 (AST) を抽出し、テキストおよびLaTeX形式で返す。
    """
    logger.info(f"論理式抽出リクエスト受信: ノード数={len(request.nodes)}, エッジ数={len(request.edges)}")
    result = extract_logic_expressions(request)
    return result


@app.post("/api/chat", response_model=ChatResponse)
def chat(request: ChatRequest) -> ChatResponse:
    """
    AIチャットエンドポイント。
    システムプロンプト: JSON形式 { "message":"...", "suggestion":{...}|null } を強制。
    """
    logger.info(f"AIチャット: {request.message[:60]}")
    ctx = request.circuitContext or {}
    result = generate_response(request.message, ctx)
    logger.info(f"AI応答: suggestion={result.get('suggestion')}")
    return ChatResponse(**result)


# ============================================================
# エクスポートエンドポイント
# ============================================================
from fastapi.responses import PlainTextResponse
from converters import export_qasm, export_python, export_verilog, export_logisim


@app.post("/api/export/qasm", response_class=PlainTextResponse)
def export_qasm_ep(request: CircuitGraphRequest) -> str:
    """OpenQASM 2.0 文字列を返す"""
    logger.info(f"QASM エクスポート: {len(request.nodes)} ノード")
    return export_qasm(request.nodes, request.edges)


@app.post("/api/export/python", response_class=PlainTextResponse)
def export_python_ep(request: CircuitGraphRequest) -> str:
    """Qiskit Python スクリプト文字列を返す"""
    logger.info(f"Python エクスポート: {len(request.nodes)} ノード")
    return export_python(request.nodes, request.edges)


@app.post("/api/export/verilog", response_class=PlainTextResponse)
def export_verilog_ep(request: CircuitGraphRequest) -> str:
    """Structural Verilog (.v) 文字列を返す"""
    logger.info(f"Verilog エクスポート: {len(request.nodes)} ノード")
    return export_verilog(request.nodes, request.edges)


@app.post("/api/export/logisim", response_class=PlainTextResponse)
def export_logisim_ep(request: CircuitGraphRequest) -> str:
    logger.info(f"Logisim エクスポート: {len(request.nodes)} ノード")
    return export_logisim(request.nodes, request.edges)


@app.post("/api/truthtable", response_model=TruthTableResponse)
def truth_table(request: CircuitGraphRequest) -> TruthTableResponse:
    """Switch / Clock の全組み合わせを1ステップ実行し、LED / SevenSeg 出力との対応表を返す"""
    from models import NodeData, NodeModel, Position, TruthTableRow

    # Switch と Clock を入力変数として扱う
    input_nodes = [n for n in request.nodes if n.data.gateType in ('Switch', 'Clock')]
    led_nodes   = [n for n in request.nodes if n.data.gateType in ('LED', 'SevenSeg')]

    if not input_nodes:
        return TruthTableResponse(
            inputLabels=[], outputLabels=[], rows=[],
            error='Switch / Clock ノードが回路にありません'
        )
    if len(input_nodes) > 8:
        return TruthTableResponse(
            inputLabels=[], outputLabels=[], rows=[],
            error='入力数が多すぎます（最大8ビット）'
        )

    def node_label(node, fallback_prefix: str, idx: int) -> str:
        """params.label → data.label → フォールバック名の優先順位でラベルを返す"""
        custom = (node.data.params or {}).get('label', '')
        if custom:
            return str(custom)
        if node.data.label and node.data.label not in ('Switch', 'LED', 'SevenSeg', 'CLK', 'Clock'):
            return node.data.label
        return f"{fallback_prefix}_{idx + 1}"

    def fallback_for(node, idx):
        return 'CLK' if node.data.gateType == 'Clock' else 'SW'

    input_labels  = [node_label(n, fallback_for(n, i), i) for i, n in enumerate(input_nodes)]
    output_labels = [node_label(ld, 'LED', i) for i, ld in enumerate(led_nodes)]
    n_in = len(input_nodes)
    rows = []

    input_id_set = {n.id for n in input_nodes}

    for combo in range(2 ** n_in):
        vals = [(combo >> (n_in - 1 - i)) & 1 for i in range(n_in)]

        # Switch / Clock を固定値の Switch 相当ノードに置き換える
        modified: list = []
        for i, inp in enumerate(input_nodes):
            new_params = {**(inp.data.params or {}), 'value': vals[i]}
            # Clock は一時的に Switch として扱い、時変動作を無効化する
            new_data = NodeData(
                gateType='Switch',
                label=inp.data.label,
                handles=inp.data.handles,
                params=new_params,
            )
            modified.append(NodeModel(id=inp.id, type=inp.type, position=inp.position, data=new_data))
        modified.extend(n for n in request.nodes if n.id not in input_id_set)

        req    = CircuitGraphRequest(
            nodes=modified, edges=request.edges, steps=1, startStep=0,
            customModules=request.customModules,
        )
        result = simulate(req)

        rows.append(TruthTableRow(
            inputs  = {input_labels[i]: vals[i] for i in range(n_in)},
            outputs = {
                output_labels[i]: result.timingData.get(ld.id, [0])[0]
                for i, ld in enumerate(led_nodes)
            },
        ))

    logger.info(f"真理値表: {n_in} 入力, {len(led_nodes)} 出力, {len(rows)} 行")
    return TruthTableResponse(inputLabels=input_labels, outputLabels=output_labels, rows=rows)


# ============================================================
# 量子回路シミュレーション エンドポイント
# ============================================================
@app.post("/api/simulate/quantum")
def simulate_quantum_endpoint(request: QuantumRequest):
    import fastapi
    logger.info(f"量子シミュレーション要求受信: {request.num_qubits} qubits, {request.shots} shots, {len(request.circuit)} ops")
    results = run_simulation(request.circuit, shots=request.shots, num_qubits=request.num_qubits)
    
    if 'error' in results:
        raise fastapi.HTTPException(status_code=400, detail=results['error'])
    
    return results
