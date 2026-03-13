import { useState, useEffect } from 'react';
import { Hash, Phone, Users } from 'lucide-react';

interface Channel {
    id: number;
    name: string;
    is_dm: boolean;
}

interface SidebarProps {
    userId: number;
    onSelectChannel: (channel: Channel) => void;
    activeChannelId?: number;
}

export default function Sidebar({ userId, onSelectChannel, activeChannelId }: SidebarProps) {
    const [channels, setChannels] = useState<Channel[]>([]);

    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const res = await fetch("http://127.0.0.1:3000/api/channels");
                const data = await res.json();
                setChannels(data);
                if (!activeChannelId && data.length > 0) {
                    onSelectChannel(data[0]);
                }
            } catch (e) {
                console.error("Failed to fetch channels", e);
            }
        };
        fetchChannels();
    }, [activeChannelId, onSelectChannel]);

    return (
        <div style={{
            width: '240px',
            backgroundColor: 'var(--bg-sidebar)',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: '100vh',
            borderRight: '1px solid var(--border)',
        }}>
            <div style={{
                padding: '16px',
                fontWeight: 'bold',
                borderBottom: '1px solid var(--border)',
                fontSize: '17px',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}>
                blypp
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Channels
                </div>
                {channels.filter(c => !c.is_dm).map(channel => (
                    <div
                        key={channel.id}
                        onClick={() => onSelectChannel(channel)}
                        style={{
                            display: 'flex', alignItems: 'center',
                            padding: '7px 8px', margin: '1px 0',
                            borderRadius: '6px', cursor: 'pointer',
                            color: activeChannelId === channel.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                            backgroundColor: activeChannelId === channel.id ? 'var(--bg-elevated)' : 'transparent',
                            borderLeft: activeChannelId === channel.id ? '2px solid var(--accent)' : '2px solid transparent',
                            transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => {
                            if (activeChannelId !== channel.id) {
                                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (activeChannelId !== channel.id) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                        }}
                    >
                        <Hash size={16} style={{ marginRight: '8px', color: activeChannelId === channel.id ? 'var(--accent)' : 'inherit' }} />
                        <span>{channel.name}</span>
                        {channel.name === 'general' && <Phone size={13} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                    </div>
                ))}

                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '24px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Direct Messages
                </div>
                {channels.filter(c => c.is_dm).map(channel => (
                    <div
                        key={channel.id}
                        onClick={() => onSelectChannel(channel)}
                        style={{
                            display: 'flex', alignItems: 'center',
                            padding: '7px 8px', margin: '1px 0',
                            borderRadius: '6px', cursor: 'pointer',
                            color: activeChannelId === channel.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                            backgroundColor: activeChannelId === channel.id ? 'var(--bg-elevated)' : 'transparent',
                            borderLeft: activeChannelId === channel.id ? '2px solid var(--accent)' : '2px solid transparent',
                        }}
                        onMouseEnter={e => {
                            if (activeChannelId !== channel.id) {
                                e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                                e.currentTarget.style.color = 'var(--text-primary)';
                            }
                        }}
                        onMouseLeave={e => {
                            if (activeChannelId !== channel.id) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = 'var(--text-secondary)';
                            }
                        }}
                    >
                        <Users size={16} style={{ marginRight: '8px' }} />
                        <span>{channel.name}</span>
                    </div>
                ))}
            </div>

            {/* User Profile Bar */}
            <div style={{
                padding: '12px',
                backgroundColor: 'var(--bg-rail)',
                display: 'flex', alignItems: 'center',
                borderTop: '1px solid var(--border)',
            }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--accent) 0%, #38bdf8 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 'bold', fontSize: 13,
                }}>
                    U{userId}
                </div>
                <div style={{ marginLeft: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>User {userId}</div>
                    <div style={{ fontSize: '11px', color: 'var(--online)' }}>● Online</div>
                </div>
            </div>
        </div>
    );
}
