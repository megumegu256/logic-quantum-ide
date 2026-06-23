# 🚀 任務：Quantum IDE (量子・論理ハイブリッドシミュレータ) の完全構築

あなたは世界トップクラスのフルスタックエンジニアです。これより、React (フロントエンド) と FastAPI (バックエンド) を用いて、ブラウザ上で動作するプロ仕様の論理回路・量子回路シミュレータをゼロから構築します。
このプロジェクトは極めて複雑であるため、**以下の【絶対ルール】、【アーキテクチャ仕様】、【段階的開発フェーズ（全10フェーズ）】を1文字の例外もなく厳守**して実装してください。実装の推測は一切許されません。

---

## 🚫 1. プロジェクトの【絶対ルール】（The Constitution）

1. **コード省略の絶対禁止**: ファイルを編集する際は、`// ...既存のコード...` のような省略を絶対にせず、**必ずファイル全体の完全なコードを出力して上書き**すること。
2. **言語の強制**: UIテキスト、コード内のコメント、AIアシスタントの返答、ターミナルのログ出力は**「すべて日本語」**に統一すること。
3. **進行の厳格な停止条件**: 各Phase（フェーズ）の完了時、必ずターミナルに「Phase X 完了。動作確認をお願いします。問題なければ『次へ』と入力してください」と出力し、**ユーザーの明確な承認があるまで絶対に次のPhaseの実装を開始しないこと。**
4. **環境構築の自動化**: 実装の最初（Phase 0）で、必ずバックエンドディレクトリにて `python -m venv venv`、アクティベート、および `requirements.txt` の生成と `pip install` を実行すること。

---

## 🏗️ 2. アーキテクチャとデータ構造の【絶対仕様】

過去のバグを完全に排除するため、以下の設計パターンを強制します。

### A. フロントエンド描画: 「単一カスタムノード」による完全制御
React Flowに登録するノードは `CustomGateNode.tsx` (`type: 'customGate'`) **1種類のみ**に限定します。
* **動的レンダリング**: `CustomGateNode` 内で、`data.gateType` (例: 'AND', 'H', 'Clock') を判定し、表示するSVGアイコンや背景色を動的に切り替えます。
* **ポート（Handle）の動的配置**: 
  * `data.handles.inputs` が 2 なら、左側に2つのTarget Handleを等間隔で配置。
  * `data.handles.outputs` が 1 なら、右側に1つのSource Handleを配置。
* **ゴーストのスタイリングとUX制御**:
  * コンポーネント内で `if (data.isGhost === true)` の場合、CSSクラス `opacity-50 border-dashed border-purple-500` を強制付与します。
  * ゴーストノードには、React Flow標準の `<NodeToolbar>` をホバー時に表示させ、`[✅ 承認(Enter)]` と `[❌ 破棄(Esc)]` のインラインボタンを実装します。

### B. システム処理: 「一方向データフロー」と「バックエンド集権型計算」
* **フロントは「見た目」だけを管理**: Zustand (`useCircuitStore.ts`) は、純粋に「ノードの座標」「エッジの接続」のみを管理します。`onNodesChange`, `onEdgesChange`, `onNodesDelete` をReact Flowの適用関数と完全に同期させ、計算ロジックは一切含めません。
* **シミュレーションのトリガー (Debounce)**: キャンバスに変更（配置、結線、パラメータ変更、Clockパルス進行）があった場合、**500msの待機 (Debounce)** を挟んでから、現在の `{ nodes, edges }` のJSON全体を FastAPI (`/api/simulate`) に POST 送信します。
* **バックエンドの統合ステップ計算**: FastAPI側は受信したJSONに対し、以下の順序で処理を実行します。
  1. トポロジカルソート（つながりの順序づけ）。
  2. 論理ゲートの真理値計算（AND, OR, NOT, Clock等）。
  3. 量子ゲートのQiskit回路構築と状態ベクトル計算。
  4. 計算結果の統合（各線の On/Off 状態、量子確率分布、1ステップ分の波形履歴）。
* **結果の反映**: フロントエンドは計算結果を受け取り、Zustandの `simulationResults` を更新。キャンバス上の線（Edge）は、この結果を参照して「Onなら線を赤く光らせる」などの描画を行います。

### C. 他ツールとの入出力互換性（エクスポート / インポート）
ファイルI/Oの複雑なパース処理はすべてバックエンド（FastAPI）で実行します。
1. **`.qasm` (OpenQASM 2.0)**:
   * **出力**: JSONグラフ -> Qiskitの `QuantumCircuit` 構築 -> `qiskit.qasm2.dumps()` で文字列変換しDL。
   * **入力**: `.qasm` アップロード -> `qiskit.qasm2.loads()` で解析 -> React Flow用 JSONに逆変換してフロントへ描画。
2. **`.py` (Pythonスクリプト)**:
   * **出力のみ**: FastAPI上で回路構築用のQiskitコードテンプレートにデータを流し込み `.py` ファイルとして出力。
3. **`.v` (Verilog HDL)**:
   * **出力のみ**: 論理回路のトポロジカルソート結果から、`module` と `wire` 定義を持つ Structural Verilog コードを自動生成。
4. **`.circ` (Logisim XML)**:
   * **出力**: JSONから Logisim XMLの `<comp>` と `<wire>` タグを生成。
   * **入力**: XMLをPythonの `xml.etree.ElementTree` でパースし、React Flow用の基本ゲートJSONに変換。
5. **`.qide` (ネイティブ)**: Zustandの `{nodes, edges}` JSONの完全な保存と読み込み。

---

## 🛠️ 3. 段階的開発フェーズ（詳細設計・Step-by-Step Execution）

### 【Phase 0: 環境構築と基盤生成】
- **バックエンド (`/backend`)**:
  - `python -m venv venv` 実行。
  - `requirements.txt` を作成（`fastapi`, `uvicorn`, `qiskit`, `qiskit-aer`, `pydantic`）。
  - `pip install -r requirements.txt` 実行。
- **フロントエンド (`/frontend`)**:
  - Vite (React + TS) のセットアップ。
  - `npm install reactflow zustand lucide-react tailwindcss` 等の実行。

### 【Phase 1: 絶対に崩れないUIレイアウトの構築】
- **対象ファイル**: `App.tsx`, `MainLayout.tsx`
- **仕様**: 画面全体を `h-screen w-screen flex flex-col overflow-hidden` とする。
  - ヘッダー: `h-14 flex-none`
  - メイン領域: `flex-1 flex flex-row overflow-hidden`
    - 左サイド（パレット）: `w-64 flex-none overflow-y-auto`
    - 中央（キャンバス）: `flex-1 relative`
    - 右サイド（モニタ）: `w-80 flex-none overflow-y-auto`
  - コンソール（波形用）: メイン領域の「真下」に `h-64 flex-none border-t` として配置。

### 【Phase 2: Zustand × React Flow の完全同期 (最重要コア)】
- **対象ファイル**: `useCircuitStore.ts`, `CircuitCanvas.tsx`
- **仕様**: `nodes`, `edges`, `onNodesChange`, `onEdgesChange`, `onConnect`, `deleteElements` を定義。`onNodesChange` 内で React Flow の `applyNodeChanges` を確実に実行すること。計算ロジックはここに入れない。
- **[テスト条件]**: ダミーノードを置き、ドラッグ移動と Delete/Backspace キーでの完全な削除が動作することを確認して停止する。

### 【Phase 3: CustomGateNode の実装】
- **対象ファイル**: `CustomGateNode.tsx`
- **仕様**: React Flow の `Handle` コンポーネントを使用し、`data.handles.inputs` の数だけ左側に、`outputs` の数だけ右側に等間隔で配置する計算式を書く。
- **仕様**: `data.isGhost === true` の場合、`<NodeToolbar isVisible>` を返し、Check(承認) と X(破棄) のアイコンボタンを配置。

### 【Phase 4: ゲートパレットとドラッグ＆ドロップ】
- **対象ファイル**: `GatePalette.tsx`, `CircuitCanvas.tsx`
- **仕様**: パレットに 論理ゲート (AND, OR, NOT, NAND, XOR, Switch, LED, Clock, 7-Seg) と 量子ゲート (H, X, Y, Z, S, T, CX, CCX, Measure) を作成。D&Dでキャンバスに `addNode` (`type: 'customGate'`) する処理を実装。

### 【Phase 5: FastAPIスキーマ定義とシミュレーション基盤】
- **対象ファイル**: `backend/models.py`, `backend/simulator.py`, `backend/main.py`, `useCircuitStore.ts`
- **バックエンド**: Pydanticで `CircuitGraphRequest` を定義。トポロジカルソートと真理値計算、Qiskitを用いた状態ベクトル計算を実装し、`{"edgeStates": {...}, "quantumState": {...}, "timingData": {...}}` を返す `/api/simulate` を作成。
- **フロントエンド**: Zustand内に `simulateCircuit` を作成。キャンバス変更時に **500msのDebounce** を経て POST 送信する。

### 【Phase 6: SVGタイミングチャートの独自描画】
- **対象ファイル**: `TimingChart.tsx` (下部コンソール内)
- **仕様**: 外部ライブラリ禁止。バックエンドからの `timingData` (例: `{"nodeId_A": [0,1,1,0]}`) を受け取り、Reactの `<svg>` と `<polyline>` タグを用いて、X軸=時間、Y軸=High/Low の矩形波を動的描画する。

### 【Phase 7: AIアシスタントとゴーストゲートの実体化】
- **対象ファイル**: `backend/ai_agent.py`, `ChatPanel.tsx`
- **仕様**: バックエンド側でシステムプロンプトを「あなたは日本語話者の量子・論理回路の専門家です。提案はJSON形式で `{ message: string, suggestion: GateData }` を返してください」と強制。
- **仕様**: フロントは `suggestion` を受け取ったら、別配列ではなくメインの `nodes` に `isGhost: true` として即座に `addNode` する。

### 【Phase 8: 入出力エコシステム (QASM/Py/Verilog/Logisim) と 最終最適化】
- **対象ファイル**: `backend/converters.py`, `ExportPanel.tsx`
- **仕様**: FastAPIに `/api/export/qasm`, `/api/export/verilog`, `/api/export/logisim` 等のエンドポイントを作成。フロント側は Blob を用いてファイルダウンロードを実行させる。
- **仕様**: エッジのハイライト（`edgeStates` が 1 の場合、React Flowの Edge スタイルを `animated: true, stroke: 'red'` に変更する処理）を実装。


**以上の指示を完全に理解しましたか？理解した場合は、「指示を完全に理解しました。Phase 0 の環境構築から開始します。よろしいですか？」とだけ返答してください。**