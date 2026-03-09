import { useState, useEffect, useRef } from 'react';

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
    channelName?: string; // Display name (resolved from DM mapping if needed)
}

export default function Chat({ userId, username, channelId, channelName }: Props) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
    const socketRef = useRef<WebSocket | null>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);

    // Connect WebSocket
    useEffect(() => {
        const ws = new WebSocket('ws://127.0.0.1:3000/api/ws');
        ws.onopen = () => setWsStatus('open');
        ws.onclose = () => setWsStatus('closed');
        ws.onerror = (err) => { console.error('WS Error', err); setWsStatus('closed'); };
        ws.onmessage = (event) => {
            try {
                const data: ChatMessage = JSON.parse(event.data);
                if (data.channel_id === channelId) {
                    setMessages((prev) => [...prev, data]);
                }
            } catch (e) { /* ignore */ }
        };
        socketRef.current = ws;
        return () => ws.close();
    }, [channelId]);

    // Scroll to bottom on new message
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Load history
    useEffect(() => {
        setMessages([]);
        fetch(`http://127.0.0.1:3000/api/channels/${channelId}/messages`)
            .then(r => r.json()).then(data => { if (Array.isArray(data)) setMessages(data); })
            .catch(() => { });
    }, [channelId]);

    const send = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || socketRef.current?.readyState !== WebSocket.OPEN) return;
        const msg: ChatMessage = { channel_id: channelId, user_id: userId, username, content: input };
        socketRef.current!.send(JSON.stringify(msg));
        setInput('');
    };

    // group consecutive messages from same user
    const grouped = messages.reduce<{ msg: ChatMessage; first: boolean }[]>((acc, msg, i) => {
        const prev = messages[i - 1];
        acc.push({ msg, first: !prev || prev.user_id !== msg.user_id });
        return acc;
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', backgroundColor: '#36393f', minWidth: 0 }}>
            {/* Status bar */}
            {wsStatus === 'closed' && (
                <div style={{ backgroundColor: '#f04747', color: 'white', fontSize: 12, padding: '4px 16px', textAlign: 'center' }}>
                    ⚠ Disconnected from chat server
                </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column' }}>
                {messages.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#72767d' }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>👋</div>
                        <div style={{ fontWeight: 700, fontSize: 22, color: 'white' }}>
                            {channelName ? `Welcome to #${channelName}!` : 'No messages yet'}
                        </div>
                        <div style={{ fontSize: 14, marginTop: 4 }}>This is the start of the conversation.</div>
                    </div>
                )}

                {grouped.map(({ msg, first }, i) => (
                    <MessageRow key={i} msg={msg} first={first} isOwn={msg.user_id === userId} />
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={send} style={{ margin: '0 16px 16px', position: 'relative' }}>
                <div style={{
                    display: 'flex', alignItems: 'center', backgroundColor: '#40444b',
                    borderRadius: 8, padding: '0 12px',
                }}>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={`Message ${channelName ? '#' + channelName : '...'}`}
                        style={{
                            flex: 1, background: 'none', border: 'none', outline: 'none',
                            color: '#dcddde', fontSize: 15, padding: '14px 0',
                            caretColor: '#dcddde',
                        }}
                    />
                    <button type="submit" style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                        color: input.trim() ? '#5865F2' : '#4f545c',
                        fontSize: 22, display: 'flex', alignItems: 'center', transition: 'color 0.1s',
                    }}>
                        ➤
                    </button>
                </div>
            </form>
        </div>
    );
}

function MessageRow({ msg, first, isOwn }: { msg: ChatMessage; first: boolean; isOwn: boolean }) {
    // Generate a consistent colour from username
    const avatarColor = stringToColor(msg.username);

    return (
        <div style={{
            padding: first ? '16px 16px 2px' : '2px 16px',
            display: 'flex', gap: 16, alignItems: 'flex-start',
        }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
        >
            {/* Avatar column */}
            <div style={{ width: 40, flexShrink: 0 }}>
                {first ? (
                    <div style={{
                        width: 40, height: 40, borderRadius: '50%', backgroundColor: avatarColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 16, userSelect: 'none',
                    }}>
                        {msg.username.charAt(0).toUpperCase()}
                    </div>
                ) : null}
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                {first && (
                    <div style={{ marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: isOwn ? '#5865F2' : '#fff', marginRight: 8 }}>
                            {msg.username}
                        </span>
                        <span style={{ fontSize: 11, color: '#72767d' }}>Today</span>
                    </div>
                )}
                <div style={{ color: '#dcddde', fontSize: 15, wordBreak: 'break-word', lineHeight: 1.4 }}>
                    {msg.content}
                </div>
            </div>
        </div>
    );
}

function stringToColor(s: string): string {
    const palette = ['#5865F2', '#3ba55d', '#faa61a', '#eb459e', '#ed4245', '#9b59b6', '#1abc9c', '#e67e22'];
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
    return palette[Math.abs(hash) % palette.length];
}
