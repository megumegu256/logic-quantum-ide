# Logic Quantum IDE (論理・量子ハイブリッド回路シミュレータ)

## 概要
Logic Quantum IDEは、ブラウザ上で動作するプロ仕様の論理回路および量子回路シミュレータです。
フロントエンドにReact (Vite + TypeScript + React Flow + Zustand)、バックエンドにFastAPIとQiskitを採用し、直感的なUIでの回路設計と、バックエンドでの高度な統合シミュレーションを提供します。

### 主な機能
- **論理回路シミュレーション**: AND/ORなどの論理ゲートをキャンバスで設計可能。
- **量子回路シミュレーション**: H/X/CXなどの量子ゲートをキャンバスで設計可能。
- **タイミングチャート生成**: シミュレーション結果を元に、回路内の各信号の波形をリアルタイムに描画。
---

## ローカル環境での実行方法

本プロジェクトをクローンした直後は、Git管理から除外されている依存パッケージ（`node_modules`）や仮想環境（`venv`）が含まれていません。
初めて実行する際は、以下の手順に従ってフロントエンドおよびバックエンドの環境をセットアップしてください。

### 前提条件
- **Node.js** (v18以降を推奨) および **npm**
- **Python** (3.9以降を推奨)

### 1. バックエンド環境のセットアップ (FastAPI + Qiskit)
ターミナルでプロジェクトのルートディレクトリを開き、バックエンドディレクトリに移動してPythonの仮想環境を作成し、依存ライブラリをインストールします。

```bash
cd backend
python3 -m venv venv

# 仮想環境のアクティベート
# Windows の場合:
venv\Scripts\activate
# Mac/Linux の場合:
source venv/bin/activate

# 依存パッケージのインストール
pip install -r requirements.txt
```

### 2. フロントエンド環境のセットアップ (Vite + React)
続いて、フロントエンドディレクトリに移動し、npmパッケージをインストールします。

```bash
cd ../frontend
npm install
```

---

## アプリケーションの起動方法

初期セットアップが完了した後は、プロジェクトルートに用意されているバッチファイルを実行するだけで、フロントエンドとバックエンドの両方を一度に起動できます。

```bash
# プロジェクトルートディレクトリ (logic-quantum-ide)に戻って実行
cd ..
run_project.bat
```

バッチファイルを実行すると、新たに2つのコマンドプロンプトウィンドウが立ち上がり、以下のURLでサーバーが起動します。
- **フロントエンド (UI)**: [http://localhost:5173](http://localhost:5173) （ブラウザでこちらにアクセスしてください）
- **バックエンド (API)**: [http://localhost:8000](http://localhost:8000)

※ `run_project.bat` は内部で仮想環境（`venv`）のアクティベートとViteの開発サーバー起動を自動で行います。

### 個別に起動する場合 (手動)
バッチファイルを使わず、それぞれの開発サーバーを手動で起動する場合は以下のコマンドを実行してください。

**バックエンドの起動:**
```bash
cd backend

# 仮想環境のアクティベート
# Windows の場合:
venv\Scripts\activate
# Mac/Linux の場合:
source venv/bin/activate

uvicorn main:app --reload --port 8000
```

**フロントエンドの起動:**
```bash
cd frontend
npm run dev
```
