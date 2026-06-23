# backend/simulator.py
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
from qiskit.quantum_info import partial_trace, Pauli
import matplotlib.pyplot as plt
import io
import base64
import logging

plt.switch_backend('Agg')
logging.basicConfig(level=logging.INFO)

def run_simulation(circuit_definition: list, shots: int = 1024, num_qubits: int = 2) -> dict:
    try:
        safe_num_qubits = max(num_qubits, 2)
        num_classical_bits = safe_num_qubits
        qc = QuantumCircuit(safe_num_qubits, num_classical_bits)
        measure_explicitly_added = False

        logging.info(f"Creating circuit with {safe_num_qubits} qubits.")

        saved_state = False
        for op in circuit_definition:
            gate = op['gate']
            all_op_qubits = []
            if 'qubit' in op: all_op_qubits.append(op['qubit'])
            if 'qubits' in op: all_op_qubits.extend(op['qubits'])
            if 'controls' in op: all_op_qubits.extend(op['controls'])
            if 'target' in op: all_op_qubits.append(op['target'])
            if any(q >= safe_num_qubits for q in all_op_qubits): continue

            if gate == 'measure' and not saved_state:
                qc.save_statevector()
                saved_state = True

            if gate == 'h': qc.h(op['qubit'])
            elif gate == 'x': qc.x(op['qubit'])
            elif gate == 'y': qc.y(op['qubit'])
            elif gate == 'z': qc.z(op['qubit'])
            elif gate == 'cx': qc.cx(op['qubits'][0], op['qubits'][1])
            elif gate == 'cz': qc.cz(op['qubits'][0], op['qubits'][1])
            elif gate == 'ccx': qc.ccx(op['qubits'][0], op['qubits'][1], op['qubits'][2])
            elif gate == 'ccz':
                qc.h(op['qubits'][2])
                qc.ccx(op['qubits'][0], op['qubits'][1], op['qubits'][2])
                qc.h(op['qubits'][2])
            elif gate == 'mcx':
                qc.mcx(op['controls'], op['target'])
            elif gate == 'mcz':
                qc.h(op['target'])
                qc.mcx(op['controls'], op['target'])
                qc.h(op['target'])
            elif gate == 'measure':
                qc.measure(op['qubit'], op['qubit']) 
                measure_explicitly_added = True
        
        if not saved_state:
            qc.save_statevector()

        fig = None
        try:
            fig = qc.draw(output='mpl', style='iqp')
        except Exception:
            try:
                fig = qc.draw(output='mpl', style='clifford')
            except Exception:
                try:
                    fig = qc.draw(output='mpl')
                except Exception:
                    fig = None

        if fig:
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
            buf.seek(0)
            img_str = base64.b64encode(buf.read()).decode('utf-8')
            plt.close(fig)
        else:
            img_str = None
        
        if not measure_explicitly_added and len(circuit_definition) > 0:
            qc.measure_all()

    except Exception as e:
        logging.error(f"Error building circuit: {e}")
        return {'error': f'Error building circuit: {str(e)}'}

    try:
        try:
            num_shots = int(shots)
            if num_shots <= 0: num_shots = 1024
        except (ValueError, TypeError):
            num_shots = 1024
        
        simulator = AerSimulator()
        compiled_circuit = transpile(qc, simulator)
        job = simulator.run(compiled_circuit, shots=num_shots) 
        result = job.result()
        counts = result.get_counts(qc)
        
        statevector_obj = result.data().get('statevector')
        statevector_list = []
        bloch_vectors = []

        if statevector_obj:
            statevector_list = [f"{complex(v):.3f}" for v in statevector_obj.data]
            for i in range(safe_num_qubits):
                try:
                    trace_over = [q for q in range(safe_num_qubits) if q != i]
                    rho_i = partial_trace(statevector_obj, trace_over)
                    x = rho_i.expectation_value(Pauli('X')).real
                    y = rho_i.expectation_value(Pauli('Y')).real
                    z = rho_i.expectation_value(Pauli('Z')).real
                    bloch_vectors.append([x, y, z])
                except Exception as e_bloch:
                    logging.warning(f"Failed to calc bloch vector for q{i}: {e_bloch}")
                    bloch_vectors.append([0, 0, 0])

        return {
            'counts': counts,
            'statevector': statevector_list,
            'circuit_diagram': img_str,
            'bloch_vectors': bloch_vectors
        }

    except Exception as e:
        logging.error(f"Error during simulation: {e}")
        return {'error': f'Error during simulation: {str(e)}'}