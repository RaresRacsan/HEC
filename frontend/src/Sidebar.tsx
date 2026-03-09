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

                // Auto-select the first channel if none is selected
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
            backgroundColor: '#202225',
            color: '#dcddde',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            maxHeight: '100vh',
            borderRight: '1px solid #18191c'
        }}>
            <div style={{
                padding: '16px',
                fontWeight: 'bold',
                borderBottom: '1px solid #18191c',
                fontSize: '18px',
                backgroundColor: '#2f3136',
                color: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
            }}>
                RustKit Server
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#8e9297', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Channels
                </div>
                {channels.filter(c => !c.is_dm).map(channel => (
                    <div
                        key={channel.id}
                        onClick={() => onSelectChannel(channel)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 8px',
                            margin: '2px 0',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: activeChannelId === channel.id ? '#fff' : '#8e9297',
                            backgroundColor: activeChannelId === channel.id ? '#393c43' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                            if (activeChannelId !== channel.id) {
                                e.currentTarget.style.backgroundColor = '#32353b';
                                e.currentTarget.style.color = '#dcddde';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeChannelId !== channel.id) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#8e9297';
                            }
                        }}
                    >
                        <Hash size={18} style={{ marginRight: '8px' }} />
                        <span>{channel.name}</span>
                        {/* Mock Audio Indicator */}
                        {channel.name === 'general' && <Phone size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                    </div>
                ))}

                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#8e9297', marginTop: '24px', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Direct Messages
                </div>
                {channels.filter(c => c.is_dm).map(channel => (
                    <div
                        key={channel.id}
                        onClick={() => onSelectChannel(channel)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '8px 8px',
                            margin: '2px 0',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            color: activeChannelId === channel.id ? '#fff' : '#8e9297',
                            backgroundColor: activeChannelId === channel.id ? '#393c43' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                            if (activeChannelId !== channel.id) {
                                e.currentTarget.style.backgroundColor = '#32353b';
                                e.currentTarget.style.color = '#dcddde';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeChannelId !== channel.id) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = '#8e9297';
                            }
                        }}
                    >
                        <Users size={18} style={{ marginRight: '8px' }} />
                        <span>{channel.name}</span>
                    </div>
                ))}
            </div>

            {/* User Profile Bar */}
            <div style={{
                padding: '12px',
                backgroundColor: '#292b2f',
                display: 'flex',
                alignItems: 'center',
                borderTop: '1px solid #18191c'
            }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#5865F2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                    U{userId}
                </div>
                <div style={{ marginLeft: '12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>User {userId}</div>
                    <div style={{ fontSize: '12px', color: '#b9bbbe' }}>Online</div>
                </div>
            </div>
        </div>
    );
}
