import json
import os
import time
import random

DIR = r"c:\Users\BlueM\デスクトップ\別途\教材\5_卒研\logic-quantum-ide\json_data"

def empty_grid(num_qubits=4, num_slots=30):
    return [[None for _ in range(num_slots)] for _ in range(num_qubits)]

def make_gate(gate_type, role=None, pair_id=None):
    g = { "type": gate_type, "id": int(time.time() * 1000) + random.randint(0, 10000) }
    if role: g["role"] = role
    if pair_id: g["pairId"] = pair_id
    return g

def save_project(filename, grid, num_qubits=4):
    filepath = os.path.join(DIR, filename)
    data = {
        "type": "quantum_ide_project",
        "mode": "quantum",
        "quantumData": {
            "grid": grid,
            "numQubits": num_qubits,
            "numSlots": len(grid[0])
        }
    }
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

def generate():
    # 1. Bell State
    g1 = empty_grid(2)
    g1[0][0] = make_gate('H')
    pid1 = 100
    g1[0][1] = make_gate('CTRL', role='control', pair_id=pid1)
    g1[1][1] = make_gate('X', role='target', pair_id=pid1)
    g1[0][2] = make_gate('Measure')
    g1[1][2] = make_gate('Measure')
    save_project("1_bell_state.json", g1, 2)

    # 2. GHZ State
    g2 = empty_grid(3)
    g2[0][0] = make_gate('H')
    pid2 = 200
    g2[0][1] = make_gate('CTRL', role='control', pair_id=pid2)
    g2[1][1] = make_gate('X', role='target', pair_id=pid2)
    pid3 = 201
    g2[1][2] = make_gate('CTRL', role='control', pair_id=pid3)
    g2[2][2] = make_gate('X', role='target', pair_id=pid3)
    g2[0][3] = make_gate('Measure')
    g2[1][3] = make_gate('Measure')
    g2[2][3] = make_gate('Measure')
    save_project("2_ghz_state.json", g2, 3)

    # 3. Quantum Teleportation (prep)
    g3 = empty_grid(3)
    g3[0][0] = make_gate('X')
    g3[0][1] = make_gate('H')
    g3[1][0] = make_gate('H')
    pid4 = 300
    g3[1][1] = make_gate('CTRL', role='control', pair_id=pid4)
    g3[2][1] = make_gate('X', role='target', pair_id=pid4)
    pid5 = 301
    g3[0][2] = make_gate('CTRL', role='control', pair_id=pid5)
    g3[1][2] = make_gate('X', role='target', pair_id=pid5)
    g3[0][3] = make_gate('H')
    g3[0][4] = make_gate('Measure')
    g3[1][4] = make_gate('Measure')
    save_project("3_teleportation_prep.json", g3, 3)

    # 4. Toffoli (CCX) and CZ
    g4 = empty_grid(3)
    g4[0][0] = make_gate('H')
    g4[1][0] = make_gate('H')
    pid6 = 400
    g4[0][1] = make_gate('CTRL', role='control', pair_id=pid6)
    g4[1][1] = make_gate('CTRL', role='control', pair_id=pid6)
    g4[2][1] = make_gate('X', role='target', pair_id=pid6)
    g4[2][2] = make_gate('Measure')
    save_project("4_toffoli.json", g4, 3)

    # 5. Grover's Algorithm (2-qubit |11>)
    g5 = empty_grid(2)
    g5[0][0] = make_gate('H')
    g5[1][0] = make_gate('H')
    # Oracle
    pid7 = 500
    g5[0][1] = make_gate('CTRL', role='control', pair_id=pid7)
    g5[1][1] = make_gate('Z', role='target', pair_id=pid7)
    # Diffusion
    g5[0][2] = make_gate('H')
    g5[1][2] = make_gate('H')
    g5[0][3] = make_gate('X')
    g5[1][3] = make_gate('X')
    pid8 = 501
    g5[0][4] = make_gate('CTRL', role='control', pair_id=pid8)
    g5[1][4] = make_gate('Z', role='target', pair_id=pid8)
    g5[0][5] = make_gate('X')
    g5[1][5] = make_gate('X')
    g5[0][6] = make_gate('H')
    g5[1][6] = make_gate('H')
    g5[0][7] = make_gate('Measure')
    g5[1][7] = make_gate('Measure')
    save_project("5_grovers_2q.json", g5, 2)

    # 6. Interference Circuit
    g6 = empty_grid(3)
    g6[0][0] = make_gate('H')
    g6[1][0] = make_gate('H')
    g6[2][0] = make_gate('H')
    pid9 = 600
    g6[0][1] = make_gate('CTRL', role='control', pair_id=pid9)
    g6[1][1] = make_gate('Z', role='target', pair_id=pid9)
    g6[1][2] = make_gate('H')
    pid10 = 601
    g6[1][3] = make_gate('CTRL', role='control', pair_id=pid10)
    g6[2][3] = make_gate('Z', role='target', pair_id=pid10)
    g6[2][4] = make_gate('H')
    g6[0][5] = make_gate('Measure')
    g6[1][5] = make_gate('Measure')
    g6[2][5] = make_gate('Measure')
    save_project("6_interference.json", g6, 3)

    # 7. Multi-Control (MCX, MCZ)
    g7 = empty_grid(4)
    for i in range(3): g7[i][0] = make_gate('H')
    pid11 = 700
    g7[0][1] = make_gate('CTRL', role='control', pair_id=pid11)
    g7[1][1] = make_gate('CTRL', role='control', pair_id=pid11)
    g7[2][1] = make_gate('CTRL', role='control', pair_id=pid11)
    g7[3][1] = make_gate('X', role='target', pair_id=pid11)
    
    pid12 = 701
    g7[0][2] = make_gate('CTRL', role='control', pair_id=pid12)
    g7[1][2] = make_gate('CTRL', role='control', pair_id=pid12)
    g7[2][2] = make_gate('CTRL', role='control', pair_id=pid12)
    g7[3][2] = make_gate('Z', role='target', pair_id=pid12)
    
    for i in range(4): g7[i][3] = make_gate('Measure')
    save_project("7_multi_control.json", g7, 4)

if __name__ == "__main__":
    generate()
    print("Generated 7 JSON project files.")
