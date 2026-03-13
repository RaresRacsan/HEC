import React, { useState } from 'react';
import { API_BASE } from './api';

export default function Auth({ onAuthSuccess }: { onAuthSuccess: (user: any) => void }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin ? `${API_BASE}/api/login` : `${API_BASE}/api/register`;

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                const data = await res.text();
                throw new Error(data || 'Authentication failed');
            }

            const data = await res.json();
            onAuthSuccess(data.user);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center', alignItems: 'center',
            minHeight: '100vh', width: '100vw',
            backgroundColor: 'var(--bg-base)',
            backgroundImage: 'radial-gradient(ellipse at 60% 10%, rgba(14,165,233,0.12) 0%, transparent 60%)',
            color: 'var(--text-primary)',
            padding: 24,
        }}>
            {/* Logo / wordmark */}
            <div style={{ marginBottom: 36, textAlign: 'center' }}>
                <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    marginBottom: 6,
                }}>
                    <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: 'linear-gradient(135deg, var(--accent) 0%, #38bdf8 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 800, color: 'white',
                        boxShadow: '0 0 20px var(--accent-glow)',
                    }}>b</div>
                    <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
                        blypp
                    </span>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    Fast voice & chat for your crew
                </p>
            </div>

            {/* Card */}
            <form onSubmit={handleSubmit} style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                padding: '36px 40px',
                borderRadius: 16,
                boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
                width: '100%', maxWidth: 420,
            }}>
                <h2 style={{ textAlign: 'center', marginBottom: 6, fontSize: 22, fontWeight: 700 }}>
                    {isLogin ? 'Sign in to blypp' : 'Create your account'}
                </h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 28, fontSize: 14 }}>
                    {isLogin ? 'Good to see you again.' : 'Join your friends on blypp.'}
                </p>

                {error && (
                    <div style={{
                        backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                        color: '#fca5a5', borderRadius: 8,
                        marginBottom: 20, fontSize: 13, padding: '10px 14px',
                    }}>{error}</div>
                )}

                <div style={{ marginBottom: 18 }}>
                    <label style={{
                        display: 'block', marginBottom: 6,
                        color: 'var(--text-secondary)', fontSize: 12,
                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        autoFocus
                        placeholder="your_username"
                        style={{
                            width: '100%', padding: '11px 14px',
                            backgroundColor: 'var(--bg-input)',
                            border: '1px solid var(--border)',
                            borderRadius: 8, color: 'var(--text-primary)',
                            outline: 'none', fontSize: 15,
                            transition: 'border-color 0.15s',
                            boxSizing: 'border-box',
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    />
                </div>

                <div style={{ marginBottom: 28 }}>
                    <label style={{
                        display: 'block', marginBottom: 6,
                        color: 'var(--text-secondary)', fontSize: 12,
                        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        style={{
                            width: '100%', padding: '11px 14px',
                            backgroundColor: 'var(--bg-input)',
                            border: '1px solid var(--border)',
                            borderRadius: 8, color: 'var(--text-primary)',
                            outline: 'none', fontSize: 15,
                            transition: 'border-color 0.15s',
                            boxSizing: 'border-box',
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: '100%', padding: '12px',
                        background: loading
                            ? 'var(--bg-elevated)'
                            : 'linear-gradient(135deg, var(--accent) 0%, #38bdf8 100%)',
                        color: 'white', border: 'none', borderRadius: 8,
                        fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: 15, letterSpacing: '0.02em',
                        boxShadow: loading ? 'none' : '0 4px 16px var(--accent-glow)',
                        transition: 'opacity 0.15s, box-shadow 0.15s',
                        marginBottom: 18,
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                    {loading ? 'Please wait…' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>

                <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' }}>
                    {isLogin ? 'New to blypp? ' : 'Already have an account? '}
                    <span
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                    >
                        {isLogin ? 'Create one' : 'Sign in'}
                    </span>
                </div>
            </form>

            <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-muted)' }}>
                blypp — open source personal voice &amp; chat
            </p>
        </div>
    );
}
