import React, { useState } from 'react';
import { API_BASE } from './api';

const API = API_BASE;

// ─── Shared modal wrapper ──────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            backdropFilter: 'blur(4px)',
        }} onClick={onClose}>
            <div style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 14, padding: '28px 32px', width: 440,
                boxShadow: '0 24px 64px rgba(0,0,0,0.5)', position: 'relative',
                animation: 'fadeIn 0.15s ease-out',
            }} onClick={e => e.stopPropagation()}>
                <h2 style={{ margin: '0 0 20px', color: 'var(--text-primary)', fontSize: 19, fontWeight: 700 }}>{title}</h2>
                {children}
                <button onClick={onClose} style={{
                    position: 'absolute', top: 14, right: 16, background: 'none', border: 'none',
                    color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1,
                    transition: 'color 0.15s',
                }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >✕</button>
            </div>
        </div>
    );
}

function Input({ label, value, onChange, placeholder, type = 'text' }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
    return (
        <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {label}
            </label>
            <input
                type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                style={{
                    width: '100%', padding: '10px 14px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border)',
                    borderRadius: 8, color: 'var(--text-primary)', outline: 'none',
                    boxSizing: 'border-box', fontSize: 15, transition: 'border-color 0.15s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            />
        </div>
    );
}

function SubmitBtn({ label }: { label: string }) {
    return (
        <button type="submit" style={{
            width: '100%', padding: '11px',
            background: 'linear-gradient(135deg, var(--accent) 0%, #38bdf8 100%)',
            color: 'white', border: 'none', borderRadius: 8,
            fontWeight: 700, cursor: 'pointer', marginTop: 8, fontSize: 15,
            boxShadow: '0 4px 12px var(--accent-glow)',
            transition: 'opacity 0.15s',
        }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >{label}</button>
    );
}

function ErrMsg({ msg }: { msg: string }) {
    return msg ? (
        <div style={{
            backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#fca5a5', borderRadius: 8, marginBottom: 14, fontSize: 13, padding: '9px 13px',
        }}>{msg}</div>
    ) : null;
}

// ─── 1. Create Space Modal ────────────────────────────────────────────────
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
                credentials: 'include',
            });
            if (!res.ok) throw new Error(await res.text());
            onCreated(await res.json());
            onClose();
        } catch (e: any) { setErr(e.message); }
    };

    return (
        <Modal title="Create a Space" onClose={onClose}>
            <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
                Give your new space a name. You can always change it later.
            </p>
            <form onSubmit={handle}>
                <ErrMsg msg={err} />
                <Input label="Space Name" value={name} onChange={setName} placeholder="My Awesome Space" />
                <SubmitBtn label="Create Space" />
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
                credentials: 'include',
            });
            if (!res.ok) throw new Error(await res.text());
            onCreated(await res.json());
            onClose();
        } catch (e: any) { setErr(e.message); }
    };

    return (
        <Modal title="Create Channel" onClose={onClose}>
            <form onSubmit={handle}>
                <ErrMsg msg={err} />
                <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Channel Type
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {(['text', 'voice'] as const).map(t => (
                            <div key={t} onClick={() => setType(t)} style={{
                                flex: 1, padding: '12px', borderRadius: 8, cursor: 'pointer',
                                backgroundColor: type === t ? 'rgba(14,165,233,0.15)' : 'var(--bg-input)',
                                border: `1.5px solid ${type === t ? 'var(--accent)' : 'var(--border)'}`,
                                color: type === t ? 'var(--accent)' : 'var(--text-secondary)',
                                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                            }}>
                                <span>{t === 'text' ? '#' : '🔊'}</span>
                                <div>
                                    <div style={{ fontWeight: 600, textTransform: 'capitalize', color: type === t ? 'var(--text-primary)' : 'inherit' }}>{t}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t === 'text' ? 'Send messages' : 'Jump in and talk'}</div>
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

// ─── 3. Invite Modal ────────────────────────────────────────────────────────
export function InviteModal({ serverId, serverName, onClose }: {
    serverId: number; serverName: string; onClose: () => void;
}) {
    const [invite, setInvite] = useState<{ code: string; invite_url: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [err, setErr] = useState('');

    React.useEffect(() => {
        fetch(`${API}/api/servers/${serverId}/invite`, { credentials: 'include' })
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
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                    {err || 'Loading invite link…'}
                </div>
            ) : (
                <>
                    <p style={{ color: 'var(--text-muted)', marginTop: 0, fontSize: 13 }}>
                        Share this link with friends to invite them to your space.
                    </p>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invite Link</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input readOnly value={invite.invite_url} style={{
                                flex: 1, padding: '10px 12px', backgroundColor: 'var(--bg-input)',
                                border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', outline: 'none',
                            }} />
                            <button onClick={() => copy(invite.invite_url)} style={{
                                padding: '10px 18px',
                                background: copied ? 'var(--online)' : 'var(--accent)',
                                color: 'white', border: 'none', borderRadius: 8,
                                cursor: 'pointer', fontWeight: 600, transition: 'background 0.2s', fontSize: 14,
                            }}>
                                {copied ? '✓ Copied' : 'Copy'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Invite Code</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <code style={{
                                flex: 1, padding: '10px 14px', backgroundColor: 'var(--bg-input)',
                                border: '1px solid var(--border)', borderRadius: 8,
                                color: 'var(--accent)', fontFamily: 'monospace', fontSize: 17, letterSpacing: 3,
                            }}>
                                {invite.code}
                            </code>
                            <button onClick={() => copy(invite.code)} style={{
                                padding: '10px 16px', backgroundColor: 'var(--bg-elevated)',
                                color: 'var(--text-primary)', border: '1px solid var(--border)',
                                borderRadius: 8, cursor: 'pointer', fontWeight: 600,
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
                credentials: 'include',
            });
            if (!res.ok) throw new Error(await res.text());
            onJoined(await res.json());
            onClose();
        } catch (e: any) { setErr(e.message); }
    };

    return (
        <Modal title="Join a Space" onClose={onClose}>
            <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
                Enter an invite code or link to join a space.
            </p>
            <form onSubmit={handle}>
                <ErrMsg msg={err} />
                <Input label="Invite Code" value={code} onChange={setCode} placeholder="Enter invite code (e.g. 1A2B3C4D)" />
                <SubmitBtn label="Join Space" />
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
                credentials: 'include',
            });
            if (!res.ok) throw new Error(await res.text());
            onStarted(await res.json(), username);
            onClose();
        } catch (e: any) { setErr(e.message); }
    };

    return (
        <Modal title="New Direct Message" onClose={onClose}>
            <p style={{ color: 'var(--text-muted)', marginTop: 0, marginBottom: 20, fontSize: 14 }}>
                Enter a username to start a private conversation.
            </p>
            <form onSubmit={handle}>
                <ErrMsg msg={err} />
                <Input label="Username" value={username} onChange={setUsername} placeholder="Enter username" />
                <SubmitBtn label="Open DM" />
            </form>
        </Modal>
    );
}
