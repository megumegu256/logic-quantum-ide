import sympy as sp

def state_to_dirac_latex(state_matrix: sp.Matrix, num_qubits: int) -> str:
    """状態ベクトルをブラケット記法の和に変換する"""
    terms = []
    for i in range(2**num_qubits):
        amp = sp.simplify(state_matrix[i, 0])
        if amp != 0:
            bit_string = format(i, f'0{num_qubits}b')
            amp_latex = sp.latex(amp)
            if amp == 1:
                term = f"|{bit_string}\\rangle"
            elif amp == -1:
                term = f"-|{bit_string}\\rangle"
            else:
                term = f"{amp_latex}|{bit_string}\\rangle"
            terms.append(term)

    if not terms:
        return "0"
        
    result = " + ".join(terms).replace("+ -", "- ")
    
    if len(terms) > 1:
        return f"\\left( {result} \\right)"
    return result

def operator_to_dirac_latex(info: dict, num_qubits: int) -> str:
    """演算子をテンソル積と射影演算子で展開したLaTeX文字列を生成する"""
    name = info['name'].upper()
    qargs = info['qargs']
    
    if len(qargs) == 1:
        targ = qargs[0]
        ops = ["I"] * num_qubits
        ops[targ] = name
        return " \\otimes ".join(reversed(ops))
        
    elif len(qargs) == 2:
        ctrl, targ = qargs[0], qargs[1]
        target_gate = "X" if name == 'CX' else "Z" if name == 'CZ' else name
            
        term0 = ["I"] * num_qubits
        term0[ctrl] = "|0\\rangle\\langle0|"
        
        term1 = ["I"] * num_qubits
        term1[ctrl] = "|1\\rangle\\langle1|"
        term1[targ] = target_gate
        
        str0 = " \\otimes ".join(reversed(term0))
        str1 = " \\otimes ".join(reversed(term1))
        return f"\\left( {str0} + {str1} \\right)"
        
    elif len(qargs) == 3 and name == 'CCX':
        ctrl1, ctrl2, targ = qargs[0], qargs[1], qargs[2]
        ops_list = []
        for c1_val in [0, 1]:
            for c2_val in [0, 1]:
                ops = ["I"] * num_qubits
                ops[ctrl1] = f"|{c1_val}\\rangle\\langle{c1_val}|"
                ops[ctrl2] = f"|{c2_val}\\rangle\\langle{c2_val}|"
                if c1_val == 1 and c2_val == 1:
                    ops[targ] = "X"
                ops_list.append(" \\otimes ".join(reversed(ops)))
        return f"\\left( {' + '.join(ops_list)} \\right)"
        
    return f"\\text{{{name}}}"


def intermediate_dirac_latex(info: dict, old_state: sp.Matrix, num_qubits: int) -> str:
    """各量子ビットの演算子を個別のケットに作用させた途中式のLaTeX文字列を生成する"""
    name = info['name'].upper()
    qargs = info['qargs']

    # 1. 演算子の各項(テンソル積の要素)を展開したリストを作成
    op_terms = []
    if len(qargs) == 1:
        targ = qargs[0]
        ops = ["I"] * num_qubits
        ops[targ] = name
        op_terms.append(list(reversed(ops)))
        
    elif len(qargs) == 2:
        ctrl, targ = qargs[0], qargs[1]
        target_gate = "X" if name == 'CX' else "Z" if name == 'CZ' else name
        
        term0 = ["I"] * num_qubits
        term0[ctrl] = "|0\\rangle\\langle0|"
        
        term1 = ["I"] * num_qubits
        term1[ctrl] = "|1\\rangle\\langle1|"
        term1[targ] = target_gate
        
        op_terms.append(list(reversed(term0)))
        op_terms.append(list(reversed(term1)))
        
    elif len(qargs) == 3 and name == 'CCX':
        ctrl1, ctrl2, targ = qargs[0], qargs[1], qargs[2]
        for c1_val in [0, 1]:
            for c2_val in [0, 1]:
                ops = ["I"] * num_qubits
                ops[ctrl1] = f"|{c1_val}\\rangle\\langle{c1_val}|"
                ops[ctrl2] = f"|{c2_val}\\rangle\\langle{c2_val}|"
                if c1_val == 1 and c2_val == 1:
                    ops[targ] = "X"
                op_terms.append(list(reversed(ops)))
    else:
        ops = ["I"] * num_qubits
        op_terms.append(list(reversed(ops)))

    # 2. 現在の状態ベクトルの各基底状態に対して演算子を分配
    state_terms = []
    for i in range(2**num_qubits):
        amp = sp.simplify(old_state[i, 0])
        if amp != 0:
            bit_string = format(i, f'0{num_qubits}b')
            amp_latex = sp.latex(amp)
            state_terms.append((amp, amp_latex, bit_string))
            
    if not state_terms:
        return "0"
        
    result_parts = []
    for amp, amp_latex, bit_string in state_terms:
        # bit_string は q_{n-1} ... q_0 の順序
        state_kets = [f"|{b}\\rangle" for b in bit_string]
        
        distributed_op_terms = []
        for op_term in op_terms:
            combined = []
            for o, k in zip(op_term, state_kets):
                combined.append(f"{o}{k}")
            distributed_op_terms.append(" \\otimes ".join(combined))
            
        # 項が複数(CXなど)の場合は括弧でまとめる
        if len(distributed_op_terms) > 1:
            state_action = f"\\left( {' + '.join(distributed_op_terms)} \\right)"
        else:
            state_action = distributed_op_terms[0]
            
        # 振幅係数を付与
        if amp == 1:
            result_parts.append(state_action)
        elif amp == -1:
            result_parts.append(f"- {state_action}")
        else:
            result_parts.append(f"{amp_latex} {state_action}")
            
    return " + ".join(result_parts).replace("+ -", "- ")
