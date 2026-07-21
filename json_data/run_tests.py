import json
import sys
import os

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.append(backend_path)

try:
    from quantum_simulator import run_simulation
except ImportError as e:
    print(f"Error importing quantum_simulator: {e}")
    sys.exit(1)

def convert_grid_to_circuit(grid, num_qubits, num_slots):
    circuit = []
    for sIndex in range(num_slots):
        groups = {}
        independent = []
        for qIndex in range(num_qubits):
            cell = grid[qIndex][sIndex]
            if not cell:
                continue
            
            if 'pairId' in cell and cell['pairId'] is not None:
                pid = cell['pairId']
                if pid not in groups:
                    groups[pid] = {'controls': [], 'targets': []}
                
                if cell.get('role') == 'control' or cell.get('type', '').upper() == 'CTRL':
                    groups[pid]['controls'].append(qIndex)
                elif cell.get('role') == 'target' or cell.get('type', '').upper() in ['CX', 'CZ']:
                    groups[pid]['targets'].append({'q': qIndex, 'type': cell.get('type', '').lower()})
                else:
                    independent.append({'q': qIndex, 'type': cell.get('type', '').lower()})
            else:
                ctype = cell.get('type', '').upper()
                if ctype == 'CTRL':
                    continue
                if ctype in ['CX_TARGET', 'CX']:
                    independent.append({'q': qIndex, 'type': 'x'})
                elif ctype in ['CZ_TARGET', 'CZ']:
                    independent.append({'q': qIndex, 'type': 'z'})
                else:
                    independent.append({'q': qIndex, 'type': cell.get('type', '').lower()})
                    
        for ind in independent:
            circuit.append({'gate': ind['type'], 'qubit': ind['q'], 'slot': sIndex})
            
        for pid, g in groups.items():
            for tgt in g['targets']:
                if tgt['q'] in g['controls']:
                    continue
                num_ctrls = len(g['controls'])
                if num_ctrls == 0:
                    base_type = 'z' if tgt['type'] in ('cz', 'z') else 'x'
                    circuit.append({'gate': base_type, 'qubit': tgt['q'], 'slot': sIndex, 'original_type': tgt['type']})
                elif num_ctrls == 1:
                    gate_type = 'cz' if tgt['type'] in ('cz', 'z') else 'cx'
                    circuit.append({'gate': gate_type, 'qubits': [g['controls'][0], tgt['q']], 'slot': sIndex})
                elif num_ctrls == 2:
                    gate_type = 'ccz' if tgt['type'] in ('cz', 'z') else 'ccx'
                    circuit.append({'gate': gate_type, 'qubits': [g['controls'][0], g['controls'][1], tgt['q']], 'slot': sIndex})
                else:
                    gate_type = 'mcz' if tgt['type'] in ('cz', 'z') else 'mcx'
                    circuit.append({'gate': gate_type, 'controls': g['controls'], 'target': tgt['q'], 'slot': sIndex})
                    
    # Sort by slot
    circuit.sort(key=lambda x: x.get('slot', 0))
    return circuit

def test_all_files():
    files = [f for f in os.listdir('.') if f.endswith('.json')]
    for file in sorted(files):
        print(f"--- Testing {file} ---")
        with open(file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        qd = data.get('quantumData', {})
        grid = qd.get('grid', [])
        num_qubits = qd.get('numQubits', 2)
        num_slots = qd.get('numSlots', 30)
        
        circuit = convert_grid_to_circuit(grid, num_qubits, num_slots)
        
        # Call backend simulator
        result = run_simulation(circuit, shots=1024, num_qubits=num_qubits)
        
        if 'error' in result:
            print(f"Error in {file}: {result['error']}")
        else:
            print(f"Counts: {result.get('counts')}")
            # print(f"Statevector: {result.get('statevector')}") # too noisy
            print("Successfully simulated!")
        print("\n")

if __name__ == "__main__":
    test_all_files()
