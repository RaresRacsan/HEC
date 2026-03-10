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

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div style={{
            position: 'fixed', inset: 0, backgroundColor: '#36393f',
            display: 'flex', zIndex: 9999, animation: 'fadeIn 0.15s ease-out',
        }}>
            {/* ── Left Sidebar ── */}
            <div style={{
                width: '35%', minWidth: 200, maxWidth: 350, backgroundColor: '#2f3136',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
                paddingTop: 60, paddingRight: 10,
            }}>
                <div style={{ width: 192 }}>
                    <div style={{ padding: '6px 10px', fontSize: 12, fontWeight: 700, color: '#8e9297', textTransform: 'uppercase', marginBottom: 4 }}>
                        User Settings
                    </div>

                    <div
                        onClick={() => setActiveTab('voice_video')}
                        style={{
                            padding: '6px 10px', borderRadius: 4, cursor: 'pointer', marginBottom: 2,
                            backgroundColor: activeTab === 'voice_video' ? '#393c43' : 'transparent',
                            color: activeTab === 'voice_video' ? 'white' : '#b9bbbe',
                            fontWeight: 500, fontSize: 15,
                        }}
                    >
                        Voice & Video
                    </div>

                    <div style={{ margin: '8px 10px', height: 1, backgroundColor: '#3f4147' }} />

                    <div
                        onClick={onLogout}
                        style={{
                            padding: '6px 10px', borderRadius: 4, cursor: 'pointer',
                            color: '#ed4245', fontWeight: 500, fontSize: 15,
                        }}
                    >
                        Log Out
                    </div>
                </div>
            </div>

            {/* ── Right Content Area ── */}
            <div style={{ flex: 1, backgroundColor: '#36393f', display: 'flex', flexDirection: 'column', paddingTop: 60, paddingLeft: 40, position: 'relative' }}>
                <div style={{ maxWidth: 740, width: '100%', paddingRight: 40 }}>
                    <h2 style={{ color: 'white', fontSize: 20, fontWeight: 700, margin: '0 0 20px 0' }}>
                        {activeTab === 'voice_video' && 'Voice & Video Settings'}
                    </h2>

                    {activeTab === 'voice_video' && (
                        <div style={{ color: '#dcddde', fontSize: 14 }}>
                            <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: 8, color: '#b9bbbe', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Input Device (Microphone)</label>
                                    <select
                                        value={selectedAudio}
                                        onChange={e => { setSelectedAudio(e.target.value); onDeviceChange(e.target.value, selectedVideo, selectedOutput, volume); }}
                                        style={{ width: '100%', padding: '10px 12px', backgroundColor: '#1e1f22', border: '1px solid #1e1f22', borderRadius: 4, color: 'white', outline: 'none', appearance: 'auto' }}>
                                        {devices.filter(d => d.kind === 'audioinput').map(d => (
                                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>
                                        ))}
                                        {devices.filter(d => d.kind === 'audioinput').length === 0 && <option value="">No microphones found</option>}
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: 8, color: '#b9bbbe', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Camera</label>
                                    <select
                                        value={selectedVideo}
                                        onChange={e => { setSelectedVideo(e.target.value); onDeviceChange(selectedAudio, e.target.value, selectedOutput, volume); }}
                                        style={{ width: '100%', padding: '10px 12px', backgroundColor: '#1e1f22', border: '1px solid #1e1f22', borderRadius: 4, color: 'white', outline: 'none', appearance: 'auto' }}>
                                        {devices.filter(d => d.kind === 'videoinput').map(d => (
                                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
                                        ))}
                                        {devices.filter(d => d.kind === 'videoinput').length === 0 && <option value="">No cameras found</option>}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 20, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #3f4147' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', marginBottom: 8, color: '#b9bbbe', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Output Device (Speaker)</label>
                                    <select
                                        value={selectedOutput}
                                        onChange={e => { setSelectedOutput(e.target.value); onDeviceChange(selectedAudio, selectedVideo, e.target.value, volume); }}
                                        style={{ width: '100%', padding: '10px 12px', backgroundColor: '#1e1f22', border: '1px solid #1e1f22', borderRadius: 4, color: 'white', outline: 'none', appearance: 'auto' }}>
                                        {devices.filter(d => d.kind === 'audiooutput').map(d => (
                                            <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 5)}`}</option>
                                        ))}
                                        {devices.filter(d => d.kind === 'audiooutput').length === 0 && <option value="">No speakers found</option>}
                                        <option value="default">Default System Audio</option>
                                    </select>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: '#b9bbbe', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                                        <span>Master Volume</span>
                                        <span>{volume}%</span>
                                    </label>
                                    <input
                                        type="range" min="0" max="100" value={volume}
                                        onChange={e => { const v = Number(e.target.value); setVolume(v); onDeviceChange(selectedAudio, selectedVideo, selectedOutput, v); }}
                                        style={{ width: '100%', marginTop: 8 }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Close Button */}
                <div style={{ position: 'absolute', top: 60, right: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', color: '#b9bbbe' }} onClick={onClose}>
                    <div style={{
                        width: 36, height: 36, borderRadius: '50%', border: '2px solid #b9bbbe',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                        fontWeight: 300, transition: 'all 0.15s ease'
                    }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'white'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#b9bbbe'; e.currentTarget.style.borderColor = '#b9bbbe'; }}
                    >
                        ✕
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>ESC</div>
                </div>
            </div>
        </div>
    );
}
