import sympy as sp
from sympy.physics.quantum import TensorProduct

# --- 基本行列の定義 ---
I_mat = sp.Matrix([[1, 0], [0, 1]])
X_mat = sp.Matrix([[0, 1], [1, 0]])
Y_mat = sp.Matrix([[0, -sp.I], [sp.I, 0]])
Z_mat = sp.Matrix([[1, 0], [0, -1]])
H_mat = (1 / sp.sqrt(2)) * sp.Matrix([[1, 1], [1, -1]])

# 位相ゲート
S_mat = sp.Matrix([[1, 0], [0, sp.I]])
Sdg_mat = sp.Matrix([[1, 0], [0, -sp.I]])
T_mat = sp.Matrix([[1, 0], [0, sp.exp(sp.I * sp.pi / 4)]])
Tdg_mat = sp.Matrix([[1, 0], [0, sp.exp(-sp.I * sp.pi / 4)]])

# プロジェクター（制御ゲート構築用）
P0 = sp.Matrix([[1, 0], [0, 0]])  # |0><0|
P1 = sp.Matrix([[0, 0], [0, 1]])  # |1><1|

# パラメータ付きゲート
def Rx_mat(theta):
    return sp.Matrix([
        [sp.cos(theta / 2), -sp.I * sp.sin(theta / 2)],
        [-sp.I * sp.sin(theta / 2), sp.cos(theta / 2)]
    ])

def Ry_mat(theta):
    return sp.Matrix([
        [sp.cos(theta / 2), -sp.sin(theta / 2)],
        [sp.sin(theta / 2), sp.cos(theta / 2)]
    ])

def Rz_mat(theta):
    return sp.Matrix([
        [sp.exp(-sp.I * theta / 2), 0],
        [0, sp.exp(sp.I * theta / 2)]
    ])

# 1量子ビットゲートの辞書
SINGLE_QUBIT_GATES = {
    'id': I_mat, 'x': X_mat, 'y': Y_mat, 'z': Z_mat, 'h': H_mat,
    's': S_mat, 'sdg': Sdg_mat, 't': T_mat, 'tdg': Tdg_mat
}

# --- ヘルパー関数 ---
def tensor_product_big_endian(matrices: list) -> sp.Matrix:
    """リスト内の行列をビッグエンディアン順（インデックス0から）でテンソル積展開する"""
    op = matrices[0]
    for i in range(1, len(matrices)):
        op = TensorProduct(op, matrices[i])
    return op

# --- シミュレータ本体 ---
class SymbolicSimulator:
    def __init__(self, num_qubits: int):
        self.num_qubits = num_qubits
        self.current_state = self._get_initial_state()
        self.history = []

    def _get_initial_state(self) -> sp.Matrix:
        """すべての量子ビットが0の初期状態ベクトル(列ベクトル)を生成する"""
        dim = 2 ** self.num_qubits
        state = sp.zeros(dim, 1)
        state[0, 0] = 1
        return state

    def apply_qiskit_circuit(self, qc) -> list:
        """Qiskitの回路を受け取り、ステップごとに演算を行って履歴を返す"""
        gate_infos = self._extract_gate_info(qc)
        print(qc)
        # Step 0 として初期状態の数式と確率も履歴に保存する
        self.history.append({
            "step": 0,
            "name": "initial",
            "qargs": [],
            "params": [],
            "equation_latex": sp.latex(self.current_state),
            "probabilities": self._calculate_probabilities(self.current_state)
        })
        
        for step, info in enumerate(gate_infos, 1):
            global_op = self._build_global_matrix(info)
            old_state = self.current_state
            
            self.current_state = global_op * old_state
            equation_latex = self._generate_equation_latex(global_op, old_state, self.current_state)
            
            self.history.append({
                "step": step,
                "name": info["name"],
                "qargs": info["qargs"],
                "params": info.get("params", []),
                "equation_latex": equation_latex,
                "probabilities": self._calculate_probabilities(self.current_state) # 各ステップの確率を追加
            })
            
        return self.history

    def _extract_gate_info(self, qc) -> list:
        """Qiskit回路からゲート情報を抽出する"""
        gate_infos = []
        for instruction in qc.data:
            op = instruction.operation
            if op.name == 'save_statevector':
                continue
            # Qiskit 1.0以降の記法（インデックスの取得）
            qargs = [qc.find_bit(q).index for q in instruction.qubits]
            gate_infos.append({
                'name': op.name,
                'qargs': qargs,
                'params': op.params
            })
        return gate_infos

    def _build_global_matrix(self, info: dict) -> sp.Matrix:
        """ゲート情報から、システム全体のユニタリ行列(ビッグエンディアン)を生成する"""
        name = info['name']
        qargs = info['qargs']
        params = info.get('params', [])
        
        num = self.num_qubits

        # --- 1量子ビットゲート ---
        if len(qargs) == 1:
            target = qargs[0]
            if name in SINGLE_QUBIT_GATES:
                gate_mat = SINGLE_QUBIT_GATES[name]
            elif name == 'rx':
                gate_mat = Rx_mat(params[0])
            elif name == 'ry':
                gate_mat = Ry_mat(params[0])
            elif name == 'rz':
                gate_mat = Rz_mat(params[0])
            else:
                raise NotImplementedError(f"未対応の1量子ビットゲート: {name}")
                
            matrices = [I_mat] * num
            matrices[target] = gate_mat
            return tensor_product_big_endian(matrices)
            
        # --- 2量子ビットゲート ---
        elif len(qargs) == 2:
            ctrl = qargs[0]
            targ = qargs[1]
            
            if name == 'cx':
                return self._build_controlled_matrix(num, ctrl, targ, X_mat)
            elif name == 'cz':
                return self._build_controlled_matrix(num, ctrl, targ, Z_mat)
            elif name == 'swap':
                # SWAPゲートは CX(c, t) * CX(t, c) * CX(c, t) として構成する
                cx1 = self._build_controlled_matrix(num, ctrl, targ, X_mat)
                cx2 = self._build_controlled_matrix(num, targ, ctrl, X_mat)
                return cx1 * cx2 * cx1
            else:
                raise NotImplementedError(f"未対応の2量子ビットゲート: {name}")
                
        # --- 3量子ビットゲート ---
        elif len(qargs) == 3:
            if name == 'ccx':
                ctrl1, ctrl2, targ = qargs[0], qargs[1], qargs[2]
                return self._build_ccx_matrix(num, ctrl1, ctrl2, targ)
            else:
                raise NotImplementedError(f"未対応の3量子ビットゲート: {name}")
                
        else:
            raise ValueError("サポートされていないビット数のゲートです。")

    def _build_controlled_matrix(self, num_qubits: int, ctrl: int, targ: int, target_gate: sp.Matrix) -> sp.Matrix:
        """任意の1制御ビット・1標的ビットゲートの全体行列を構築する"""
        # 制御ビットが0の項
        mats_0 = [I_mat] * num_qubits
        mats_0[ctrl] = P0
        op0 = tensor_product_big_endian(mats_0)
        
        # 制御ビットが1の項
        mats_1 = [I_mat] * num_qubits
        mats_1[ctrl] = P1
        mats_1[targ] = target_gate
        op1 = tensor_product_big_endian(mats_1)
        
        return op0 + op1

    def _build_ccx_matrix(self, num_qubits: int, ctrl1: int, ctrl2: int, targ: int) -> sp.Matrix:
        """CCX(トフォリ)ゲートの全体行列を構築する"""
        ops = []
        for c1_val in [0, 1]:
            for c2_val in [0, 1]:
                mats = [I_mat] * num_qubits
                mats[ctrl1] = P1 if c1_val == 1 else P0
                mats[ctrl2] = P1 if c2_val == 1 else P0
                
                # 両方の制御ビットが1のときのみ標的にXを作用
                if c1_val == 1 and c2_val == 1:
                    mats[targ] = X_mat
                    
                ops.append(tensor_product_big_endian(mats))
                
        return sum(ops, sp.zeros(2**num_qubits, 2**num_qubits))

    def _generate_equation_latex(self, op: sp.Matrix, old: sp.Matrix, new: sp.Matrix) -> str:
        """LaTeXの方程式文字列を生成する"""
        op_latex = sp.latex(op,fold_short_frac=True)
        old_latex = sp.latex(old,fold_short_frac=True)
        new_latex = sp.latex(new,fold_short_frac=True)
        return f"{op_latex} {old_latex} = {new_latex}"

    def reset(self):
        """シミュレータの状態を初期化する"""
        self.current_state = self._get_initial_state()
        self.history = []

    def _calculate_probabilities(self, state_matrix: sp.Matrix) -> list:
        """状態ベクトルから各基底状態の確率分布を計算する"""
        probabilities = []
        for i in range(2**self.num_qubits):
            amp = complex(state_matrix[i, 0])
            prob = abs(amp)**2
            bit_string = format(i, f'0{self.num_qubits}b')
            probabilities.append({
                "state": f"|{bit_string}⟩",
                "probability": round(prob, 4)
            })
        return probabilities

