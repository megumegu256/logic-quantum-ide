# ai_agent.py — ルールベースAIチャットエージェント
import re
from typing import Optional

GATE_HANDLES = {
    'AND':{'inputs':2,'outputs':1},'OR':{'inputs':2,'outputs':1},
    'NOT':{'inputs':1,'outputs':1},'NAND':{'inputs':2,'outputs':1},
    'XOR':{'inputs':2,'outputs':1},'Switch':{'inputs':0,'outputs':1},
    'LED':{'inputs':1,'outputs':0},'Clock':{'inputs':0,'outputs':1},
    'SevenSeg':{'inputs':4,'outputs':0},'H':{'inputs':1,'outputs':1},
    'X':{'inputs':1,'outputs':1},'Y':{'inputs':1,'outputs':1},
    'Z':{'inputs':1,'outputs':1},'S':{'inputs':1,'outputs':1},
    'T':{'inputs':1,'outputs':1},'CX':{'inputs':2,'outputs':2},
    'CCX':{'inputs':3,'outputs':3},'Measure':{'inputs':1,'outputs':1},
}

GATE_PATTERNS = [
    (r'AND|論理積|アンド','AND'),
    (r'(?<![NC])OR(?!der)|論理和|オア','OR'),
    (r'NOT|否定|ノット|インバータ','NOT'),
    (r'NAND|否定論理積','NAND'),
    (r'XOR|排他|エクスオア','XOR'),
    (r'スイッチ|Switch','Switch'),
    (r'LED|発光','LED'),
    (r'クロック|Clock|CLK','Clock'),
    (r'7seg|七セグ|セグメント','SevenSeg'),
    (r'アダマール|Hadamard|Hゲート','H'),
    (r'Pauli.?X|パウリX|Xゲート','X'),
    (r'Pauli.?Y|Yゲート','Y'),
    (r'Pauli.?Z|Zゲート','Z'),
    (r'Sゲート|位相S','S'),
    (r'Tゲート|π/4|位相T','T'),
    (r'CNOT|CX|制御NOT','CX'),
    (r'Toffoli|CCX|トフォリ','CCX'),
    (r'測定|Measure|観測','Measure'),
]

EXPLANATIONS = {
    'AND':'ANDゲートを提案します。2入力がともにHighのとき出力がHighになります。',
    'OR':'ORゲートを提案します。いずれか入力がHighなら出力はHighです。',
    'NOT':'NOTゲート（インバータ）を提案します。入力を反転させます。',
    'NAND':'NANDゲートを提案します。ANDの出力反転です。',
    'XOR':'XORゲートを提案します。入力が異なるときHighを出力します。',
    'Switch':'Switchゲートを提案します。クリックでHigh/Lowを手動切り替えできます。',
    'LED':'LEDゲートを提案します。入力状態を視覚的に確認できます。',
    'Clock':'Clockゲートを提案します。一定周期でHigh/Lowを繰り返します。',
    'SevenSeg':'7セグメントディスプレイを提案します。4ビット入力をBCD表示します。',
    'H':'アダマールゲートを提案します。|0⟩と|1⟩の等確率重ね合わせを生成します。',
    'X':'Pauli-Xゲート（量子NOT）を提案します。|0⟩↔|1⟩を反転させます。',
    'Y':'Pauli-Yゲートを提案します。X+Z方向の回転を行います。',
    'Z':'Pauli-Zゲートを提案します。|1⟩に位相反転を適用します。',
    'S':'Sゲートを提案します。π/2の位相回転を行います。',
    'T':'Tゲートを提案します。π/4の位相回転を行います。',
    'CX':'CNOTゲートを提案します。制御クビットが|1⟩のとき対象を反転します。',
    'CCX':'Toffoliゲートを提案します。2制御クビットが共に|1⟩のとき対象を反転します。',
    'Measure':'測定ゲートを提案します。量子クビットを古典ビットに変換します。',
}

GENERAL = [
    (r'こんにちは|はじめまして','こんにちは！量子・論理回路の専門家アシスタントです。ゲート追加の提案や回路設計の質問など何でもどうぞ。'),
    (r'ありがとう|感謝','お役に立てて嬉しいです！'),
    (r'量子回路|量子コンピュータ','量子回路ではH・CX・測定ゲートが基本です。まずHゲートで重ね合わせを作り、CNOTで量子もつれを生成するBell回路から試してみましょう。'),
    (r'半加算器|全加算器|加算','XOR（和）とAND（繰り上がり）で半加算器を構成できます。XORゲートとANDゲートを追加してみてください。'),
    (r'ヘルプ|使い方','ゲートをパレットからドラッグ→ハンドルを接続→「▶チャート生成」でシミュレーションです。「ANDを追加して」のようにゲート名を言えば提案もできます！'),
]

def _detect_gate(text: str) -> Optional[str]:
    for pattern, gate in GATE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return gate
    return None

def generate_response(message: str, circuit_context: dict) -> dict:
    detected = _detect_gate(message)
    if detected:
        return {
            'message': EXPLANATIONS[detected],
            'suggestion': {'gateType': detected, 'handles': GATE_HANDLES[detected]},
        }
    for pattern, reply in GENERAL:
        if re.search(pattern, message, re.IGNORECASE):
            return {'message': reply, 'suggestion': None}
    n = circuit_context.get('nodeCount', 0)
    if n == 0:
        return {'message': 'キャンバスにゲートがありません。「ANDゲートを追加して」のようにゲート名を言えば提案できます！', 'suggestion': None}
    types = list(set(circuit_context.get('nodeTypes', [])))[:4]
    return {'message': f'現在{n}個のゲートがあります（{"・".join(types)} など）。追加したいゲートや疑問点があれば教えてください。', 'suggestion': None}
