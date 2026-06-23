// ChatPanel.tsx — AIチャットパネル
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import useCircuitStore from '../store/useCircuitStore';
import type { GateType } from '../store/useCircuitStore';

const API_BASE = 'http://localhost:8000';

interface Msg { role:'user'|'ai'; text:string; hasGhost?:boolean; }

const ChatPanel: React.FC = () => {
  const nodes         = useCircuitStore((s) => s.nodes);
  const addGhostNode  = useCircuitStore((s) => s.addGhostNode);

  const [messages, setMessages] = useState<Msg[]>([
    { role:'ai', text:'こんにちは！量子・論理回路の専門家アシスタントです。「ANDゲートを追加して」のようにゲート名を言えば提案（ゴーストノード）をキャンバスに配置します。' }
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role:'user', text }]);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          message: text,
          circuitContext: {
            nodeCount: nodes.length,
            nodeTypes: nodes.map(n => n.data.gateType),
          },
        }),
      });

      const data: { message:string; suggestion:{ gateType:string; handles:{inputs:number;outputs:number} }|null } = await res.json();

      let hasGhost = false;
      if (data.suggestion) {
        const { gateType, handles } = data.suggestion;
        addGhostNode(gateType as GateType, handles, gateType);
        hasGhost = true;
      }
      setMessages(prev => [...prev, { role:'ai', text: data.message, hasGhost }]);

    } catch {
      setMessages(prev => [...prev, { role:'ai', text:'⚠ バックエンドへの接続に失敗しました。サーバーが起動しているか確認してください。' }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, nodes, addGhostNode]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const bubble = (msg: Msg, i: number) => {
    const isAI = msg.role === 'ai';
    return (
      <div key={i} style={{ display:'flex', gap:'8px', padding:'6px 10px', alignItems:'flex-start',
        flexDirection: isAI ? 'row' : 'row-reverse' }}>
        {/* アバター */}
        <div style={{ width:'24px', height:'24px', borderRadius:'50%', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          backgroundColor: isAI ? 'rgba(168,85,247,0.2)' : 'rgba(91,141,246,0.2)',
          border:`1px solid ${isAI ? 'rgba(168,85,247,0.4)' : 'rgba(91,141,246,0.4)'}` }}>
          {isAI ? <Bot size={13} style={{ color:'#c084fc' }} /> : <User size={13} style={{ color:'#7eb3fa' }} />}
        </div>
        {/* バブル */}
        <div style={{
          maxWidth:'80%', padding:'6px 10px', borderRadius:'8px', fontSize:'11px', lineHeight:1.6,
          backgroundColor: isAI ? 'rgba(168,85,247,0.08)' : 'rgba(91,141,246,0.10)',
          border:`1px solid ${isAI ? 'rgba(168,85,247,0.2)' : 'rgba(91,141,246,0.2)'}`,
          color:'var(--color-text-primary)',
        }}>
          {msg.text}
          {msg.hasGhost && (
            <div style={{ marginTop:'4px', fontSize:'10px', color:'#c084fc', fontStyle:'italic' }}>
              ✨ ゴーストノードをキャンバスに配置しました（✅で承認 / ❌で破棄）
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
      {/* メッセージリスト */}
      <div style={{ flex:1, overflowY:'auto', paddingTop:'4px' }}>
        {messages.map((m, i) => bubble(m, i))}
        {loading && (
          <div style={{ display:'flex', gap:'8px', padding:'6px 10px', alignItems:'center' }}>
            <div style={{ width:'24px', height:'24px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', backgroundColor:'rgba(168,85,247,0.2)', border:'1px solid rgba(168,85,247,0.4)' }}>
              <Bot size={13} style={{ color:'#c084fc' }} />
            </div>
            <Loader2 size={14} style={{ color:'#c084fc', animation:'spin 1s linear infinite' }} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 入力欄 */}
      <div style={{ padding:'8px 10px', borderTop:'1px solid var(--color-border)', display:'flex', gap:'6px' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder="例: ANDゲートを追加して、量子回路を教えて..."
          rows={2}
          style={{
            flex:1, resize:'none', padding:'6px 8px',
            fontSize:'11px', fontFamily:'var(--font-mono)',
            color:'var(--color-text-primary)',
            backgroundColor:'rgba(255,255,255,0.05)',
            border:'1px solid var(--color-border)', borderRadius:'6px',
            outline:'none', lineHeight:1.5,
          }}
          onFocus={e => { (e.target as HTMLElement).style.borderColor = 'rgba(168,85,247,0.5)'; }}
          onBlur={e  => { (e.target as HTMLElement).style.borderColor = 'var(--color-border)'; }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || loading}
          style={{
            width:'36px', height:'36px', flexShrink:0, alignSelf:'flex-end',
            display:'flex', alignItems:'center', justifyContent:'center',
            borderRadius:'8px', border:'1px solid rgba(168,85,247,0.4)',
            backgroundColor: input.trim() && !loading ? 'rgba(168,85,247,0.2)' : 'rgba(168,85,247,0.05)',
            color: input.trim() && !loading ? '#c084fc' : '#475569',
            cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
            transition:'all 0.15s',
          }}
        >
          <Send size={14} />
        </button>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
};

export default ChatPanel;
