import React, { useState } from 'react';

export default function Auth({ onAuthSuccess }: { onAuthSuccess: (user: any) => void }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const endpoint = isLogin ? '/api/login' : '/api/register';

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
        }
    };

    return (
        <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            height: '100vh', width: '100vw', backgroundColor: '#36393f', color: 'white'
        }}>
            <form onSubmit={handleSubmit} style={{
                backgroundColor: '#2f3136', padding: '32px', borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)', width: '100%', maxWidth: '400px'
            }}>
                <h2 style={{ textAlign: 'center', marginBottom: '8px' }}>
                    {isLogin ? 'Welcome back!' : 'Create an account'}
                </h2>
                <p style={{ textAlign: 'center', color: '#b9bbbe', marginBottom: '24px' }}>
                    {isLogin ? 'We\'re so excited to see you again!' : 'Join our community!'}
                </p>

                {error && <div style={{ color: '#ed4245', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#b9bbbe', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        Username
                    </label>
                    <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        required
                        style={{
                            width: '90%', padding: '10px', backgroundColor: '#202225',
                            border: 'none', borderRadius: '4px', color: 'white', outline: 'none'
                        }}
                    />
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#b9bbbe', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                        Password
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        style={{
                            width: '90%', padding: '10px', backgroundColor: '#202225',
                            border: 'none', borderRadius: '4px', color: 'white', outline: 'none'
                        }}
                    />
                </div>

                <button type="submit" style={{
                    width: '100%', padding: '12px', backgroundColor: '#5865F2',
                    color: 'white', border: 'none', borderRadius: '4px',
                    fontWeight: 'bold', cursor: 'pointer', marginBottom: '16px'
                }}>
                    {isLogin ? 'Log In' : 'Register'}
                </button>

                <div style={{ fontSize: '14px', color: '#b9bbbe' }}>
                    {isLogin ? 'Need an account? ' : 'Already have an account? '}
                    <span
                        onClick={() => setIsLogin(!isLogin)}
                        style={{ color: '#00aff4', cursor: 'pointer' }}
                    >
                        {isLogin ? 'Register' : 'Log In'}
                    </span>
                </div>
            </form>
        </div>
    );
}
