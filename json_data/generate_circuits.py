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


    # 8. Superdense Coding (2 qubits)
    g8 = empty_grid(2)
    g8[0][0] = make_gate('H')
    pid80 = 800
    g8[0][1] = make_gate('CTRL', role='control', pair_id=pid80)
    g8[1][1] = make_gate('X', role='target', pair_id=pid80)
    g8[0][2] = make_gate('Z')
    g8[0][3] = make_gate('X')
    pid81 = 801
    g8[0][4] = make_gate('CTRL', role='control', pair_id=pid81)
    g8[1][4] = make_gate('X', role='target', pair_id=pid81)
    g8[0][5] = make_gate('H')
    g8[0][6] = make_gate('Measure')
    g8[1][6] = make_gate('Measure')
    save_project("8_superdense_coding.json", g8, 2)

    # 9. Phase Identity Check (Y, Z, S, T)
    g9 = empty_grid(3)
    g9[0][0] = make_gate('H')
    g9[1][0] = make_gate('H')
    g9[2][0] = make_gate('H')
    
    g9[0][1] = make_gate('Y')
    g9[0][2] = make_gate('Z')
    g9[0][3] = make_gate('X')
    
    g9[1][1] = make_gate('S')
    g9[1][2] = make_gate('S')
    g9[1][3] = make_gate('Z')
    
    g9[2][1] = make_gate('T')
    g9[2][2] = make_gate('T')
    g9[2][3] = make_gate('T')
    g9[2][4] = make_gate('T')
    g9[2][5] = make_gate('Z')
    
    g9[0][6] = make_gate('H')
    g9[1][6] = make_gate('H')
    g9[2][6] = make_gate('H')
    g9[0][7] = make_gate('Measure')
    g9[1][7] = make_gate('Measure')
    g9[2][7] = make_gate('Measure')
    save_project("9_identity_gates.json", g9, 3)

    # 10. Bernstein-Vazirani (101)
    g10 = empty_grid(4)
    g10[3][0] = make_gate('X')
    for i in range(4): g10[i][1] = make_gate('H')
    pid10_0 = 1000
    g10[0][2] = make_gate('CTRL', role='control', pair_id=pid10_0)
    g10[3][2] = make_gate('X', role='target', pair_id=pid10_0)
    pid10_1 = 1001
    g10[2][3] = make_gate('CTRL', role='control', pair_id=pid10_1)
    g10[3][3] = make_gate('X', role='target', pair_id=pid10_1)
    for i in range(3): g10[i][4] = make_gate('H')
    for i in range(3): g10[i][5] = make_gate('Measure')
    save_project("10_bernstein_vazirani.json", g10, 4)

    # 11. Quantum Half-Adder (1 + 1)
    g11 = empty_grid(4)
    g11[0][0] = make_gate('X')
    g11[1][0] = make_gate('X')
    pid11_0 = 1100
    g11[0][1] = make_gate('CTRL', role='control', pair_id=pid11_0)
    g11[2][1] = make_gate('X', role='target', pair_id=pid11_0)
    pid11_1 = 1101
    g11[1][2] = make_gate('CTRL', role='control', pair_id=pid11_1)
    g11[2][2] = make_gate('X', role='target', pair_id=pid11_1)
    pid11_2 = 1102
    g11[0][3] = make_gate('CTRL', role='control', pair_id=pid11_2)
    g11[1][3] = make_gate('CTRL', role='control', pair_id=pid11_2)
    g11[3][3] = make_gate('X', role='target', pair_id=pid11_2)
    for i in range(4): g11[i][4] = make_gate('Measure')
    save_project("11_half_adder.json", g11, 4)

    # 12. Bit-flip Error Correction
    g12 = empty_grid(3)
    g12[0][0] = make_gate('X')
    pid12_0 = 1200
    g12[0][1] = make_gate('CTRL', role='control', pair_id=pid12_0)
    g12[1][1] = make_gate('X', role='target', pair_id=pid12_0)
    pid12_1 = 1201
    g12[0][2] = make_gate('CTRL', role='control', pair_id=pid12_1)
    g12[2][2] = make_gate('X', role='target', pair_id=pid12_1)
    g12[1][3] = make_gate('X') # Error!
    pid12_2 = 1202
    g12[0][4] = make_gate('CTRL', role='control', pair_id=pid12_2)
    g12[1][4] = make_gate('X', role='target', pair_id=pid12_2)
    pid12_3 = 1203
    g12[0][5] = make_gate('CTRL', role='control', pair_id=pid12_3)
    g12[2][5] = make_gate('X', role='target', pair_id=pid12_3)
    pid12_4 = 1204
    g12[1][6] = make_gate('CTRL', role='control', pair_id=pid12_4)
    g12[2][6] = make_gate('CTRL', role='control', pair_id=pid12_4)
    g12[0][6] = make_gate('X', role='target', pair_id=pid12_4)
    for i in range(3): g12[i][7] = make_gate('Measure')
    save_project("12_qec_bit_flip.json", g12, 3)

    # 13. Full Quantum Teleportation
    g13 = empty_grid(3)
    g13[0][0] = make_gate('H')
    g13[0][1] = make_gate('S')
    g13[1][2] = make_gate('H')
    pid13_0 = 1300
    g13[1][3] = make_gate('CTRL', role='control', pair_id=pid13_0)
    g13[2][3] = make_gate('X', role='target', pair_id=pid13_0)
    pid13_1 = 1301
    g13[0][4] = make_gate('CTRL', role='control', pair_id=pid13_1)
    g13[1][4] = make_gate('X', role='target', pair_id=pid13_1)
    g13[0][5] = make_gate('H')
    pid13_2 = 1302
    g13[1][6] = make_gate('CTRL', role='control', pair_id=pid13_2)
    g13[2][6] = make_gate('X', role='target', pair_id=pid13_2)
    pid13_3 = 1303
    g13[0][7] = make_gate('CTRL', role='control', pair_id=pid13_3)
    g13[2][7] = make_gate('Z', role='target', pair_id=pid13_3)
    for _ in range(3): g13[2][8+_] = make_gate('S')
    g13[2][11] = make_gate('H')
    for i in range(3): g13[i][12] = make_gate('Measure')
    save_project("13_full_teleportation.json", g13, 3)

    # 14. GHZ X-basis Measurement
    g14 = empty_grid(3)
    g14[0][0] = make_gate('H')
    pid14_0 = 1400
    g14[0][1] = make_gate('CTRL', role='control', pair_id=pid14_0)
    g14[1][1] = make_gate('X', role='target', pair_id=pid14_0)
    pid14_1 = 1401
    g14[1][2] = make_gate('CTRL', role='control', pair_id=pid14_1)
    g14[2][2] = make_gate('X', role='target', pair_id=pid14_1)
    for i in range(3): g14[i][3] = make_gate('H')
    for i in range(3): g14[i][4] = make_gate('Measure')
    save_project("14_ghz_x_basis.json", g14, 3)

    # 15. Entanglement Swapping
    g15 = empty_grid(4)
    g15[0][0] = make_gate('H')
    g15[2][0] = make_gate('H')
    pid15_0 = 1500
    g15[0][1] = make_gate('CTRL', role='control', pair_id=pid15_0)
    g15[1][1] = make_gate('X', role='target', pair_id=pid15_0)
    pid15_1 = 1501
    g15[2][2] = make_gate('CTRL', role='control', pair_id=pid15_1)
    g15[3][2] = make_gate('X', role='target', pair_id=pid15_1)
    pid15_2 = 1502
    g15[1][3] = make_gate('CTRL', role='control', pair_id=pid15_2)
    g15[2][3] = make_gate('X', role='target', pair_id=pid15_2)
    g15[1][4] = make_gate('H')
    pid15_3 = 1503
    g15[2][5] = make_gate('CTRL', role='control', pair_id=pid15_3)
    g15[3][5] = make_gate('X', role='target', pair_id=pid15_3)
    pid15_4 = 1504
    g15[1][6] = make_gate('CTRL', role='control', pair_id=pid15_4)
    g15[3][6] = make_gate('Z', role='target', pair_id=pid15_4)
    pid15_5 = 1505
    g15[0][7] = make_gate('CTRL', role='control', pair_id=pid15_5)
    g15[3][7] = make_gate('X', role='target', pair_id=pid15_5)
    g15[0][8] = make_gate('H')
    for i in range(4): g15[i][9] = make_gate('Measure')
    save_project("15_entanglement_swapping.json", g15, 4)

if __name__ == "__main__":
    generate()
    print("Generated 15 JSON project files.")
