import { useState, useEffect, useRef } from 'react';
import { API_BASE } from './api';

type ChatMessage = {
    channel_id: number;
    user_id: number;
    username: string;
    content: string;
};

interface Props {
    userId: number;
    username: string;
    channelId: number;
    channelName?: string;
    ws: WebSocket | null;
    wsStatus: 'connecting' | 'open' | 'closed';
    incomingMsg: ChatMessage | null;
}

export default function Chat({ userId, username, channelId, channelName, ws, wsStatus, incomingMsg }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const bottomRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (incomingMsg && incomingMsg.channel_id === channelId) {
            setMessages((prev) => [...prev, incomingMsg]);
        }
    }, [incomingMsg, channelId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        setMessages([]);
        fetch(`${API_BASE}/api/channels/${channelId}/messages`)
            .then(r => r.json()).then(data => { if (Array.isArray(data)) setMessages(data); })
            .catch(() => { });
    }, [channelId]);

    const send = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || ws?.readyState !== WebSocket.OPEN) return;
        const msg: ChatMessage = { channel_id: channelId, user_id: userId, username, content: input };
        ws.send(JSON.stringify(msg));
        setInput('');
    };

    const grouped = messages.reduce<{ msg: ChatMessage; first: boolean }[]>((acc, msg, i) => {
        const prev = messages[i - 1];
        acc.push({ msg, first: !prev || prev.user_id !== msg.user_id });
        return acc;
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', backgroundColor: 'var(--bg-base)', minWidth: 0 }}>
            {/* Offline banner */}
            {wsStatus === 'closed' && (
                <div style={{
                    backgroundColor: 'rgba(239,68,68,0.15)', color: '#fca5a5',
                    border: '1px solid rgba(239,68,68,0.3)',
                    fontSize: 12, padding: '6px 16px', textAlign: 'center',
                }}>
                    ⚠ Disconnected — messages won't send until reconnected
                </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column' }}>
                {messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: 10 }}>
                        <div style={{ fontSize: 44 }}>💬</div>
                        <div style={{ fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>
                            {channelName ? `Start of #${channelName}` : 'No messages yet'}
                        </div>
                        <div style={{ fontSize: 14 }}>Be the first to say something!</div>
                    </div>
                )}
                {grouped.map(({ msg, first }, i) => (
                    <MessageRow key={i} msg={msg} first={first} isOwn={msg.user_id === userId} />
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <form onSubmit={send} style={{ margin: '0 16px 16px' }}>
                <div style={{
                    display: 'flex', alignItems: 'center',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10, padding: '0 14px',
                    transition: 'border-color 0.15s',
                }}
                    onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
                    onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Message ${channelName ? '#' + channelName : '...'}`}
                        style={{
                            flex: 1, background: 'none', border: 'none', outline: 'none',
                            color: 'var(--text-primary)', fontSize: 15, padding: '14px 0',
                            caretColor: 'var(--accent)',
                        }}
                    />
                    <button type="submit" style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                        color: input.trim() ? 'var(--accent)' : 'var(--text-muted)',
                        fontSize: 20, display: 'flex', alignItems: 'center', transition: 'color 0.1s',
                    }}>➤</button>
                </div>
            </form>
        </div>
    );
}

function MessageRow({ msg, first, isOwn }: { msg: ChatMessage; first: boolean; isOwn: boolean }) {
    const avatarColor = stringToColor(msg.username);

    return (
        <div
            style={{ padding: first ? '14px 16px 2px' : '2px 16px', display: 'flex', gap: 14, alignItems: 'flex-start' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255,255,255,0.02)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
        >
            <div style={{ width: 38, flexShrink: 0 }}>
                {first ? (
                    <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: `linear-gradient(135deg, ${avatarColor} 0%, ${stringToColor(msg.username + '1')} 100%)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 15, userSelect: 'none',
                    }}>
                        {msg.username.charAt(0).toUpperCase()}
                    </div>
                ) : null}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                {first && (
                    <div style={{ marginBottom: 3 }}>
                        <span style={{ fontWeight: 600, color: isOwn ? 'var(--accent)' : 'var(--text-primary)', marginRight: 8 }}>
                            {msg.username}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Today</span>
                    </div>
                )}
                <div style={{ color: 'var(--text-secondary)', fontSize: 15, wordBreak: 'break-word', lineHeight: 1.5 }}>
                    {msg.content}
                </div>
            </div>
        </div>
    );
}

function stringToColor(s: string): string {
    const palette = ['#0ea5e9', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}
