# backend/simulator.py
from qiskit import QuantumCircuit, transpile
from qiskit_aer import AerSimulator
from qiskit.quantum_info import partial_trace, Pauli, Statevector
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

        current_qc = QuantumCircuit(safe_num_qubits)
        calc_steps = []
        
        from qiskit.circuit.library import HGate, XGate, YGate, ZGate, SGate, TGate
        local_svs = [Statevector.from_label('0') for _ in range(safe_num_qubits)]

        def apply_local_gate(gate, op):
            q = op.get('qubit')
            if gate == 'h': local_svs[q] = local_svs[q].evolve(HGate())
            elif gate == 'x': local_svs[q] = local_svs[q].evolve(XGate())
            elif gate == 'y': local_svs[q] = local_svs[q].evolve(YGate())
            elif gate == 'z': local_svs[q] = local_svs[q].evolve(ZGate())
            elif gate == 's': local_svs[q] = local_svs[q].evolve(SGate())
            elif gate == 't': local_svs[q] = local_svs[q].evolve(TGate())
            elif gate == 'cx':
                c, t = op['qubits'][0], op['qubits'][1]
                if local_svs[c].probabilities()[1] > 0.999:
                    local_svs[t] = local_svs[t].evolve(XGate())
                if abs(local_svs[t].data[0] - 1/(2**0.5)) < 0.01 and abs(local_svs[t].data[1] + 1/(2**0.5)) < 0.01:
                    local_svs[c] = local_svs[c].evolve(ZGate())
            elif gate == 'cz':
                c, t = op['qubits'][0], op['qubits'][1]
                if local_svs[c].probabilities()[1] > 0.999:
                    local_svs[t] = local_svs[t].evolve(ZGate())
                elif local_svs[t].probabilities()[1] > 0.999:
                    local_svs[c] = local_svs[c].evolve(ZGate())

        def record_step(label):
            sv = Statevector(current_qc)
            qubits_state = []
            for i in range(safe_num_qubits):
                try:
                    trace_over = [q for q in range(safe_num_qubits) if q != i]
                    rho_i = partial_trace(sv, trace_over)
                    x = rho_i.expectation_value(Pauli('X')).real
                    y = rho_i.expectation_value(Pauli('Y')).real
                    z = rho_i.expectation_value(Pauli('Z')).real
                    
                    if (x*x + y*y + z*z) < 0.99:
                        qubits_state.append("ENTANGLED")
                    else:
                        qubits_state.append([f"{complex(v):.3f}" for v in local_svs[i].data])
                except Exception:
                    qubits_state.append("Unknown")

            calc_steps.append({
                'label': label,
                'statevector': [f"{complex(v):.3f}" for v in sv.data],
                'qubits_state': qubits_state
            })
        
        record_step('初期状態')

        saved_state = False
        measured_qubits = []
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
                
            slot = op.get('slot', 0) + 1

            if gate == 'h':
                qc.h(op['qubit']); current_qc.h(op['qubit'])
                apply_local_gate(gate, op)
                record_step(f"q{op['qubit']} → H    (q{op['qubit']}, {slot})")
            elif gate == 'x':
                qc.x(op['qubit']); current_qc.x(op['qubit'])
                apply_local_gate(gate, op)
                display_gate = op.get('original_type', 'X').upper()
                record_step(f"q{op['qubit']} → {display_gate}    (q{op['qubit']}, {slot})")
            elif gate == 'y':
                qc.y(op['qubit']); current_qc.y(op['qubit'])
                apply_local_gate(gate, op)
                record_step(f"q{op['qubit']} → Y    (q{op['qubit']}, {slot})")
            elif gate == 'z':
                qc.z(op['qubit']); current_qc.z(op['qubit'])
                apply_local_gate(gate, op)
                display_gate = op.get('original_type', 'Z').upper()
                record_step(f"q{op['qubit']} → {display_gate}    (q{op['qubit']}, {slot})")
            elif gate == 's':
                qc.s(op['qubit']); current_qc.s(op['qubit'])
                apply_local_gate(gate, op)
                record_step(f"q{op['qubit']} → S    (q{op['qubit']}, {slot})")
            elif gate == 't':
                qc.t(op['qubit']); current_qc.t(op['qubit'])
                apply_local_gate(gate, op)
                record_step(f"q{op['qubit']} → T    (q{op['qubit']}, {slot})")
            elif gate == 'cx':
                qc.cx(op['qubits'][0], op['qubits'][1]); current_qc.cx(op['qubits'][0], op['qubits'][1])
                apply_local_gate(gate, op)
                record_step(f"q{op['qubits'][0]} (ctrl), q{op['qubits'][1]} (tgt) → CX    (ctrl: q{op['qubits'][0]}, tgt: q{op['qubits'][1]}, {slot})")
            elif gate == 'cz':
                qc.cz(op['qubits'][0], op['qubits'][1]); current_qc.cz(op['qubits'][0], op['qubits'][1])
                apply_local_gate(gate, op)
                record_step(f"q{op['qubits'][0]} (ctrl), q{op['qubits'][1]} (tgt) → CZ    (ctrl: q{op['qubits'][0]}, tgt: q{op['qubits'][1]}, {slot})")
            elif gate == 'ccx':
                qc.ccx(op['qubits'][0], op['qubits'][1], op['qubits'][2])
                current_qc.ccx(op['qubits'][0], op['qubits'][1], op['qubits'][2])
                record_step(f"q{op['qubits'][0]}, q{op['qubits'][1]} (ctrl), q{op['qubits'][2]} (tgt) → CCX    (ctrls: q{op['qubits'][0]}, q{op['qubits'][1]}, tgt: q{op['qubits'][2]}, {slot})")
            elif gate == 'ccz':
                qc.h(op['qubits'][2])
                qc.ccx(op['qubits'][0], op['qubits'][1], op['qubits'][2])
                qc.h(op['qubits'][2])
                current_qc.h(op['qubits'][2])
                current_qc.ccx(op['qubits'][0], op['qubits'][1], op['qubits'][2])
                current_qc.h(op['qubits'][2])
                record_step(f"q{op['qubits'][0]}, q{op['qubits'][1]} (ctrl), q{op['qubits'][2]} (tgt) → CCZ    (ctrls: q{op['qubits'][0]}, q{op['qubits'][1]}, tgt: q{op['qubits'][2]}, {slot})")
            elif gate == 'mcx':
                qc.mcx(op['controls'], op['target'])
                current_qc.mcx(op['controls'], op['target'])
                ctrl_str = ', '.join([f"q{c}" for c in op['controls']])
                record_step(f"{ctrl_str} (ctrl), q{op['target']} (tgt) → MCX    (ctrls: {ctrl_str}, tgt: q{op['target']}, {slot})")
            elif gate == 'mcz':
                qc.h(op['target'])
                qc.mcx(op['controls'], op['target'])
                qc.h(op['target'])
                current_qc.h(op['target'])
                current_qc.mcx(op['controls'], op['target'])
                current_qc.h(op['target'])
                ctrl_str = ', '.join([f"q{c}" for c in op['controls']])
                record_step(f"{ctrl_str} (ctrl), q{op['target']} (tgt) → MCZ    (ctrls: {ctrl_str}, tgt: q{op['target']}, {slot})")
            elif gate == 'measure':
                qc.measure(op['qubit'], op['qubit']) 
                measure_explicitly_added = True
                if op['qubit'] not in measured_qubits:
                    measured_qubits.append(op['qubit'])
        
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
        
        try:
            counts = result.get_counts(qc)
            if not measure_explicitly_added:
                counts = {}
        except Exception:
            counts = {}
        
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
            'bloch_vectors': bloch_vectors,
            'measured_qubits': measured_qubits,
            'calc_steps': calc_steps
        }

    except Exception as e:
        logging.error(f"Error during simulation: {e}")
        return {'error': f'Error during simulation: {str(e)}'}