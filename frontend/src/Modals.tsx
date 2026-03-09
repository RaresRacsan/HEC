import React, { useState } from 'react';
import { API_BASE } from './api';

const API = API_BASE;

// ─── Shared modal wrapper ──────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={onClose}>
            <div style={{
                backgroundColor: '#2f3136', borderRadius: 8, padding: '24px 28px', width: 440,
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)', position: 'relative',
            }} onClick={e => e.stopPropagation()}>
                <h2 style={{ margin: '0 0 20px', color: 'white', fontSize: 20 }}>{title}</h2>
                {children}
                <button onClick={onClose} style={{
                    position: 'absolute', top: 14, right: 16, background: 'none', border: 'none',
                    color: '#8e9297', fontSize: 20, cursor: 'pointer', lineHeight: 1,
                }}>✕</button>
            </div>
        </div>
    );
}

function Input({ label, value, onChange, placeholder, type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: '#b9bbbe', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                {label}
            </label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                style={{ width: '100%', padding: '10px 12px', backgroundColor: '#202225', border: 'none', borderRadius: 4, color: 'white', outline: 'none', boxSizing: 'border-box' }} />
        </div>
    );
}

function SubmitBtn({ label }: { label: string }) {
    return (
        <button type="submit" style={{
            width: '100%', padding: '12px', backgroundColor: '#5865F2', color: 'white',
            border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer', marginTop: 8, fontSize: 15,
        }}>{label}</button>
    );
}

function ErrMsg({ msg }: { msg: string }) {
    return msg ? <div style={{ color: '#ed4245', marginBottom: 12, fontSize: 13 }}>{msg}</div> : null;
}

// ─── 1. Create Server Modal ────────────────────────────────────────────────
export function CreateServerModal({ userId, onClose, onCreated }: {
    userId: number;
    onClose: () => void;
    onCreated: (server: { id: number; name: string }) => void;
}) {
    const [name, setName] = useState('');
    const [err, setErr] = useState('');

    const handle = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr('');
        try {
            const res = await fetch(`${API}/api/servers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, user_id: userId }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            onCreated(data);
            onClose();
        } catch (e: any) { setErr(e.message); }
    };

    return (
        <Modal title="Create Your Server" onClose={onClose}>
            <p style={{ color: '#b9bbbe', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
                Give your new server a name. You can always change it later.
            </p>
            <form onSubmit={handle}>
                <ErrMsg msg={err} />
                <Input label="Server Name" value={name} onChange={setName} placeholder="My Awesome Server" />
                <SubmitBtn label="Create Server" />
            </form>
        </Modal>
    );
}

// ─── 2. Create Channel Modal ───────────────────────────────────────────────
export function CreateChannelModal({ serverId, onClose, onCreated }: {
    serverId: number;
    onClose: () => void;
    onCreated: (ch: { id: number; name: string; channel_type: string }) => void;
}) {
    const [name, setName] = useState('');
    const [type, setType] = useState<'text' | 'voice'>('text');
    const [err, setErr] = useState('');

    const handle = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr('');
        if (!name.trim()) { setErr('Channel name cannot be empty'); return; }
        try {
            const res = await fetch(`${API}/api/servers/${serverId}/channels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, channel_type: type }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            onCreated(data);
            onClose();
        } catch (e: any) { setErr(e.message); }
    };

    return (
        <Modal title="Create Channel" onClose={onClose}>
            <form onSubmit={handle}>
                <ErrMsg msg={err} />
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, color: '#b9bbbe', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Channel Type</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {(['text', 'voice'] as const).map(t => (
                            <div key={t} onClick={() => setType(t)} style={{
                                flex: 1, padding: '12px', borderRadius: 4, cursor: 'pointer',
                                backgroundColor: type === t ? '#393c43' : '#202225',
                                border: `2px solid ${type === t ? '#5865F2' : 'transparent'}`,
                                color: 'white', display: 'flex', alignItems: 'center', gap: 8,
                            }}>
                                <span>{t === 'text' ? '#' : '🔊'}</span>
                                <div>
                                    <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{t}</div>
                                    <div style={{ fontSize: 12, color: '#b9bbbe' }}>{t === 'text' ? 'Send messages' : 'Jump in and talk'}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <Input label="Channel Name" value={name} onChange={setName} placeholder={type === 'text' ? 'new-channel' : 'General'} />
                <SubmitBtn label="Create Channel" />
            </form>
        </Modal>
    );
}

// ─── 3. Invite People Modal ────────────────────────────────────────────────
export function InviteModal({ serverId, serverName, onClose }: {
    serverId: number; serverName: string; onClose: () => void;
}) {
    const [invite, setInvite] = useState<{ code: string; invite_url: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [err, setErr] = useState('');

    // Fetch the permanent code automatically when the modal opens
    React.useEffect(() => {
        fetch(`${API}/api/servers/${serverId}/invite`)
            .then(r => r.ok ? r.json() : Promise.reject('Failed to load invite'))
            .then(data => setInvite(data))
            .catch(e => setErr(String(e)));
    }, [serverId]);

    const copy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Modal title={`Invite people to ${serverName}`} onClose={onClose}>
            <ErrMsg msg={err} />
            {!invite ? (
                <div style={{ color: '#b9bbbe', textAlign: 'center', padding: 16 }}>
                    {err || 'Loading invite…'}
                </div>
            ) : (
                <>
                    <p style={{ color: '#b9bbbe', marginTop: 0, fontSize: 13 }}>Share this link with your friends to invite them to your server.</p>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 6, color: '#b9bbbe', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Invite Link</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input readOnly value={invite.invite_url} style={{
                                flex: 1, padding: '10px 12px', backgroundColor: '#202225', border: 'none',
                                borderRadius: 4, color: 'white', outline: 'none',
                            }} />
                            <button onClick={() => copy(invite.invite_url)} style={{
                                padding: '10px 16px', backgroundColor: copied ? '#3ba55d' : '#5865F2',
                                color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600, transition: 'background-color 0.2s',
                            }}>
                                {copied ? '✓ Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: 6, color: '#b9bbbe', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Invite Code</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <code style={{ flex: 1, padding: '10px 12px', backgroundColor: '#202225', borderRadius: 4, color: '#00aff4', fontFamily: 'monospace', fontSize: 16, letterSpacing: 2 }}>
                                {invite.code}
                            </code>
                            <button onClick={() => copy(invite.code)} style={{
                                padding: '10px 16px', backgroundColor: copied ? '#3ba55d' : '#4f545c',
                                color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600,
                            }}>
                                {copied ? '✓' : 'Copy'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </Modal>
    );
}

// ─── 4. Join via Code Modal ────────────────────────────────────────────────
export function JoinServerModal({ userId, onClose, onJoined }: {
    userId: number;
    onClose: () => void;
    onJoined: (server: { id: number; name: string }) => void;
}) {
    const [code, setCode] = useState('');
    const [err, setErr] = useState('');

    const handle = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr('');
        try {
            const res = await fetch(`${API}/api/invites/${code.trim()}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, name: '' }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            onJoined(data);
            onClose();
        } catch (e: any) { setErr(e.message); }
    };

    return (
        <Modal title="Join a Server" onClose={onClose}>
            <p style={{ color: '#b9bbbe', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
                Enter an invite code or link to join a server.
            </p>
            <form onSubmit={handle}>
                <ErrMsg msg={err} />
                <Input label="Invite Code" value={code} onChange={setCode} placeholder="Enter invite code (e.g. 1A2B3C4D)" />
                <SubmitBtn label="Join Server" />
            </form>
        </Modal>
    );
}

// ─── 5. Start DM Modal ─────────────────────────────────────────────────────
export function StartDmModal({ userId, onClose, onStarted }: {
    userId: number;
    onClose: () => void;
    onStarted: (channel: { id: number; name: string; is_dm: boolean; channel_type?: string }, partnerUsername: string) => void;
}) {
    const [username, setUsername] = useState('');
    const [err, setErr] = useState('');

    const handle = async (e: React.FormEvent) => {
        e.preventDefault();
        setErr('');
        try {
            const res = await fetch(`${API}/api/dms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from_user_id: userId, to_username: username }),
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            onStarted(data, username);
            onClose();
        } catch (e: any) { setErr(e.message); }
    };

    return (
        <Modal title="Open Direct Message" onClose={onClose}>
            <p style={{ color: '#b9bbbe', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
                Enter a username to start or open a direct message conversation.
            </p>
            <form onSubmit={handle}>
                <ErrMsg msg={err} />
                <Input label="Username" value={username} onChange={setUsername} placeholder="Enter username" />
                <SubmitBtn label="Open DM" />
            </form>
        </Modal>
    );
}
