import { useState, useEffect } from 'react';

export function SettingsModal({
    onClose,
    onLogout,
    selectedAudioDevice,
    selectedVideoDevice,
    selectedOutputDevice,
    masterVolume,
    onDeviceChange,
}: {
    onClose: () => void;
    onLogout: () => void;
    selectedAudioDevice: string;
    selectedVideoDevice: string;
    selectedOutputDevice: string;
    masterVolume: number;
    onDeviceChange: (audioId: string, videoId: string, outputId: string, volume: number) => void;
}) {
    const [activeTab, setActiveTab] = useState<'voice_video'>('voice_video');
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedAudio, setSelectedAudio] = useState(selectedAudioDevice);
    const [selectedVideo, setSelectedVideo] = useState(selectedVideoDevice);
    const [selectedOutput, setSelectedOutput] = useState(selectedOutputDevice);
    const [volume, setVolume] = useState(masterVolume);

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(setDevices);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const selectStyle: React.CSSProperties = {
        width: '100%', padding: '10px 12px',
        backgroundColor: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 8, color: 'var(--text-primary)',
        outline: 'none', appearance: 'auto',
        fontSize: 14,
    };

    const labelStyle: React.CSSProperties = {
        display: 'block', marginBottom: 8,
        color: 'var(--text-secondary)', fontSize: 12,
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: 'var(--bg-base)',
            display: 'flex', zIndex: 9999, animation: 'fadeIn 0.15s ease-out',
        }}>
            {/* ── Left Sidebar ── */}
            <div style={{
                width: '32%', minWidth: 200, maxWidth: 320,
                backgroundColor: 'var(--bg-sidebar)',
                borderRight: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                paddingTop: 64, paddingRight: 12,
            }}>
                <div style={{ width: 196 }}>
                    {/* blypp wordmark */}
                    <div style={{ padding: '0 10px 16px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 8,
                            background: 'linear-gradient(135deg, var(--accent) 0%, #38bdf8 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, fontWeight: 800, color: 'white',
                        }}>b</div>
                        <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>blypp</span>
                    </div>

                    <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                        Settings
                    </div>

                    <div
                        onClick={() => setActiveTab('voice_video')}
                        style={{
                            padding: '7px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                            backgroundColor: activeTab === 'voice_video' ? 'var(--bg-elevated)' : 'transparent',
                            color: activeTab === 'voice_video' ? 'var(--text-primary)' : 'var(--text-secondary)',
                            fontWeight: 500, fontSize: 14,
                            borderLeft: activeTab === 'voice_video' ? '2px solid var(--accent)' : '2px solid transparent',
                            transition: 'all 0.15s',
                        }}
                    >
                        🎙 Voice &amp; Video
                    </div>

                    <div style={{ margin: '10px 10px', height: 1, backgroundColor: 'var(--border)' }} />

                    <div
                        onClick={onLogout}
                        style={{
                            padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                            color: 'var(--danger)', fontWeight: 500, fontSize: 14,
                            transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239,68,68,0.1)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                    >
                        Sign Out
                    </div>
                </div>
            </div>

            {/* ── Right Content Area ── */}
            <div style={{ flex: 1, backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', paddingTop: 64, paddingLeft: 48, position: 'relative', overflowY: 'auto' }}>
                <div style={{ maxWidth: 680, width: '100%', paddingRight: 48 }}>
                    <h2 style={{ color: 'var(--text-primary)', fontSize: 20, fontWeight: 700, margin: '0 0 24px' }}>
                        {activeTab === 'voice_video' && 'Voice & Video Settings'}
                    </h2>

                    {activeTab === 'voice_video' && (
                        <div style={{ color: 'var(--text-primary)', fontSize: 14 }}>
                            <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Microphone</label>
                                    <select
                                        value={selectedAudio}
                                        onChange={e => { setSelectedAudio(e.target.value); onDeviceChange(e.target.value, selectedVideo, selectedOutput, volume); }}
                                        style={selectStyle}
                                    >
                                        {devices.filter(d => d.kind === 'audioinput').map(d => (
                                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>
                                        ))}
                                        {devices.filter(d => d.kind === 'audioinput').length === 0 && <option value="">No microphones found</option>}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Camera</label>
                                    <select
                                        value={selectedVideo}
                                        onChange={e => { setSelectedVideo(e.target.value); onDeviceChange(selectedAudio, e.target.value, selectedOutput, volume); }}
                                        style={selectStyle}
                                    >
                                        {devices.filter(d => d.kind === 'videoinput').map(d => (
                                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
                                        ))}
                                        {devices.filter(d => d.kind === 'videoinput').length === 0 && <option value="">No cameras found</option>}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 20, marginBottom: 32, paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={labelStyle}>Speaker / Output</label>
                                    <select
                                        value={selectedOutput}
                                        onChange={e => { setSelectedOutput(e.target.value); onDeviceChange(selectedAudio, selectedVideo, e.target.value, volume); }}
                                        style={selectStyle}
                                    >
                                        {devices.filter(d => d.kind === 'audiooutput').map(d => (
                                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 5)}`}</option>
                                        ))}
                                        {devices.filter(d => d.kind === 'audiooutput').length === 0 && <option value="">No speakers found</option>}
                                        <option value="default">Default System Audio</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Master Volume</span>
                                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{volume}%</span>
                                    </label>
                                    <input
                                        type="range" min="0" max="100" value={volume}
                                        onChange={e => { const v = Number(e.target.value); setVolume(v); onDeviceChange(selectedAudio, selectedVideo, selectedOutput, v); }}
                                        style={{ width: '100%', marginTop: 10, accentColor: 'var(--accent)' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Close button */}
                <div
                    style={{ position: 'absolute', top: 64, right: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', color: 'var(--text-muted)' }}
                    onClick={onClose}
                >
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        border: '2px solid var(--text-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, transition: 'all 0.15s',
                    }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                    >✕</div>
                    <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6, color: 'var(--text-muted)' }}>ESC</div>
                </div>
            </div>
        </div>
    );
}
