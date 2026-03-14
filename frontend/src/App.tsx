import { useState, useEffect } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import './App.css';
import { API_BASE, WS_BASE } from './api';

import Chat from './Chat';
import Auth from './Auth';
import { CustomVideoConference } from './CustomVideoConference';
import {
  CreateServerModal,
  CreateChannelModal,
  InviteModal,
  JoinServerModal,
  StartDmModal,
} from './Modals';
import { SettingsModal } from './SettingsModal';

// ─── Types ─────────────────────────────────────────────────────────────────
interface User { id: number; username: string; role?: string; }
interface Server { id: number; name: string; }
interface Channel { id: number; name: string; is_dm: boolean; channel_type?: string; server_id?: number; }

export type ChatMessage = {
  channel_id: number;
  user_id: number;
  username: string;
  content: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function dmDisplayName(ch: Channel, myId: number, memberCache: Map<number, string>): string {
  if (!ch.is_dm) return ch.name;
  const parts = ch.name.split('-');
  if (parts.length === 3) {
    const a = parseInt(parts[1], 10);
    const b = parseInt(parts[2], 10);
    const otherId = a === myId ? b : a;
    return memberCache.get(otherId) ?? `User ${otherId}`;
  }
  return ch.name;
}

function stringToColor(s: string): string {
  const palette = ['#0ea5e9', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#8b5cf6'];
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// ─── Component: ServerIcon ───────────────────────────────────────────────────
function ServerIcon({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick} title={name}
      style={{
        width: 44, height: 44,
        borderRadius: active ? 14 : '50%',
        background: active
          ? 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)'
          : 'var(--bg-surface)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: active ? 'white' : 'var(--text-secondary)',
        fontWeight: 700, fontSize: 17,
        transition: 'border-radius 0.2s, background 0.2s',
        flexShrink: 0, userSelect: 'none',
        boxShadow: active ? '0 0 0 2px var(--accent), 0 4px 12px var(--accent-glow)' : 'none',
      }}
      onMouseEnter={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.borderRadius = '14px';
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.borderRadius = '50%';
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
        }
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

type ModalType = 'createServer' | 'joinServer' | 'createChannel' | 'invite' | 'startDm' | null;

// Standard fetch with credentials
const secureFetch = (url: string, options: RequestInit = {}) => {
  return fetch(url, { ...options, credentials: 'include' });
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);

  const [globalWs, setGlobalWs] = useState<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [lastChatMessage, setLastChatMessage] = useState<ChatMessage | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [voiceParticipants, setVoiceParticipants] = useState<Record<string, string[]>>({});
  const [token, setToken] = useState('');
  const [livekitUrl, setLivekitUrl] = useState(WS_BASE);
  const [view, setView] = useState<'dms' | 'server'>('dms');
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [serverMembers, setServerMembers] = useState<User[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [userCache, setUserCache] = useState<Map<number, string>>(new Map());
  const [modal, setModal] = useState<ModalType>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [selectedAudio, setSelectedAudio] = useState(() => localStorage.getItem('hec_audio') || '');
  const [selectedVideo, setSelectedVideo] = useState(() => localStorage.getItem('hec_video') || '');
  const [selectedOutput, setSelectedOutput] = useState(() => localStorage.getItem('hec_output') || '');
  const [masterVolume, setMasterVolume] = useState(() => {
    const v = localStorage.getItem('hec_volume');
    return v ? Number(v) : 100;
  });

  // 1. Session restoration & Invite parsing
  useEffect(() => {
    // Check invite code from URL
    const pathParts = window.location.pathname.split('/');
    const inviteIdx = pathParts.indexOf('invite');
    if (inviteIdx !== -1 && pathParts[inviteIdx + 1]) {
      setPendingInviteCode(pathParts[inviteIdx + 1]);
    }

    // Restore session
    secureFetch(`${API_BASE}/api/me`)
      .then(r => r.ok ? r.json() : Promise.reject('No session'))
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setCheckingSession(false));
  }, []);

  // 2. Handle joining pending invite
  useEffect(() => {
    if (user && pendingInviteCode) {
      const joinInvite = async () => {
        try {
          const res = await secureFetch(`${API_BASE}/api/invites/${pendingInviteCode}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: user.id, name: '' }),
          });
          if (res.ok) {
            const s = await res.json();
            setServers(prev => prev.some(x => x.id === s.id) ? prev : [...prev, s]);
            setActiveServer(s);
            setView('server');
            setPendingInviteCode(null);
            // Clean URL
            window.history.replaceState({}, '', '/');
          }
        } catch (e) { console.error('Auto-join failed', e); }
      };
      joinInvite();
    }
  }, [user, pendingInviteCode]);

  useEffect(() => {
    if (!user) return;
    fetchServers();
    setUserCache(prev => new Map(prev).set(user.id, user.username));
  }, [user]);

  const fetchServers = async () => {
    if (!user) return;
    try {
      const res = await secureFetch(`${API_BASE}/api/users/${user.id}/servers`);
      const data = await res.json();
      setServers(Array.isArray(data) ? data : []);
    } catch { }
  };

  useEffect(() => {
    if (!activeServer) return;
    setActiveChannel(null);
    (async () => {
      try {
        const [chRes, memRes] = await Promise.all([
          secureFetch(`${API_BASE}/api/servers/${activeServer.id}/channels`),
          secureFetch(`${API_BASE}/api/servers/${activeServer.id}/members`),
        ]);
        const [chData, memData] = await Promise.all([chRes.json(), memRes.json()]);
        setChannels(Array.isArray(chData) ? chData : []);
        const members: User[] = Array.isArray(memData) ? memData : [];
        setServerMembers(members);
        setUserCache(prev => {
          const next = new Map(prev);
          members.forEach(m => next.set(m.id, m.username));
          return next;
        });
      } catch { }
    })();
  }, [activeServer]);

  useEffect(() => {
    if (!activeServer || view !== 'server') return;
    let timer: number;
    const fetchParticipants = async () => {
      try {
        const res = await secureFetch(`${API_BASE}/api/servers/${activeServer.id}/voice-participants`);
        if (res.ok) setVoiceParticipants(await res.json());
      } catch { }
      timer = window.setTimeout(fetchParticipants, 5000);
    };
    fetchParticipants();
    return () => clearTimeout(timer);
  }, [activeServer, view]);

  useEffect(() => {
    if (view !== 'dms' || !user) return;
    setActiveServer(null);
    setActiveChannel(null);
    (async () => {
      try {
        const res = await secureFetch(`${API_BASE}/api/users/${user.id}/dms`);
        const data = await res.json();
        const dms: Channel[] = Array.isArray(data) ? data : [];
        setChannels(dms);
        const ids = new Set<number>();
        dms.forEach(ch => {
          const parts = ch.name.split('-');
          if (parts.length === 3) {
            const a = parseInt(parts[1], 10), b = parseInt(parts[2], 10);
            if (a !== user!.id) ids.add(a);
            if (b !== user!.id) ids.add(b);
          }
        });
        ids.forEach(async id => {
          try {
            const res = await secureFetch(`${API_BASE}/api/users/${id}`);
            if (res.ok) {
              const u: User = await res.json();
              setUserCache(prev => { const next = new Map(prev); next.set(u.id, u.username); return next; });
            }
          } catch { }
        });
      } catch { }
    })();
  }, [view, user]);

  useEffect(() => {
    if (!user) return;
    const ws = new WebSocket(`${WS_BASE}/api/ws?user_id=${user.id}`);
    ws.onopen = () => setWsStatus('open');
    ws.onclose = () => setWsStatus('closed');
    ws.onerror = (err) => { console.error('WS Error', err); setWsStatus('closed'); };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'presence') setOnlineUsers(data.online_users || []);
        else if (data.channel_id) setLastChatMessage(data as ChatMessage);
      } catch { }
    };
    setGlobalWs(ws);
    return () => { ws.close(); setGlobalWs(null); };
  }, [user]);

  const joinVoice = async (ch: Channel) => {
    if (!user) return;
    try {
      const res = await secureFetch(`${API_BASE}/api/livekit/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: ch.name, participant_identity: user.username, participant_name: user.username }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.token && data.livekit_url?.startsWith('ws')) {
        setLivekitUrl(data.livekit_url);
        setToken(data.token);
      }
    } catch { }
  };

  const handleLogout = async () => {
    await secureFetch(`${API_BASE}/api/logout`, { method: 'POST' });
    setUser(null);
    setShowSettings(false);
    setServers([]);
    setChannels([]);
    setActiveServer(null);
    setActiveChannel(null);
  };

  if (checkingSession) {
    return (
      <div style={{ display: 'flex', width: '100vw', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-base)', color: 'var(--accent)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>b</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Connecting to blypp…</div>
        </div>
      </div>
    );
  }

  if (!user) return <Auth onAuthSuccess={(u) => setUser(u)} pendingInviteCode={pendingInviteCode} />;

  const textChannels = channels.filter(c => !c.channel_type || c.channel_type === 'text');
  const voiceChannels = channels.filter(c => c.channel_type === 'voice');
  const isVoice = activeChannel?.channel_type === 'voice';
  const isText = activeChannel && !isVoice;
  const showMemberList = activeServer && !activeChannel;

  const channelDisplayName = activeChannel
    ? (activeChannel.is_dm ? dmDisplayName(activeChannel, user.id, userCache) : activeChannel.name)
    : '';

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-base)' }}>

      <div style={{
        width: 68, backgroundColor: 'var(--bg-rail)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '12px 0', gap: 6, flexShrink: 0, overflowY: 'auto',
        borderRight: '1px solid var(--border)',
      }}>
        <div title="blypp" style={{
          width: 44, height: 44, borderRadius: 14, marginBottom: 6,
          background: 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 800, color: 'white', flexShrink: 0,
          boxShadow: '0 0 16px var(--accent-glow)',
          letterSpacing: '-1px',
        }}>b</div>

        <RailDivider />
        <NavBtn emoji="💬" active={view === 'dms'} title="Direct Messages" onClick={() => setView('dms')} />
        <RailDivider />

        {servers.map(s => (
          <ServerIcon key={s.id} name={s.name} active={view === 'server' && activeServer?.id === s.id}
            onClick={() => { setView('server'); setActiveServer(s); }} />
        ))}

        <RailDivider />
        <NavBtn emoji="+" title="Create a Space" onClick={() => setModal('createServer')} accentOnHover />
        <NavBtn emoji="🔗" title="Join a Space via Code" onClick={() => setModal('joinServer')} accentOnHover />
      </div>

      <div style={{
        width: 240, backgroundColor: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column',
        flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--border)',
      }}>
        <div style={{
          padding: '0 16px', height: 52, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', fontWeight: 700, fontSize: 15,
          color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <span>{view === 'dms' ? 'Direct Messages' : (activeServer?.name ?? 'Select a Space')}</span>
          {view === 'dms' && <SidebarIconBtn title="New DM" onClick={() => setModal('startDm')}>✏️</SidebarIconBtn>}
          {view === 'server' && activeServer && (
            <div style={{ display: 'flex', gap: 4 }}>
              <SidebarIconBtn title="Create Channel" onClick={() => setModal('createChannel')}>+</SidebarIconBtn>
              <SidebarIconBtn title="Invite People" onClick={() => setModal('invite')}>👥</SidebarIconBtn>
            </div>
          )}
        </div>

        {view === 'server' && activeServer && (
          <>
            {textChannels.length > 0 && (
              <ChannelSection label="Text Channels">
                {textChannels.map(ch => (
                  <ChannelItem key={ch.id} ch={ch} active={activeChannel?.id === ch.id} onClick={() => setActiveChannel(ch)} />
                ))}
              </ChannelSection>
            )}
            {voiceChannels.length > 0 && (
              <ChannelSection label="Voice Channels">
                {voiceChannels.map(ch => (
                  <div key={ch.id}>
                    <ChannelItem ch={ch} active={activeChannel?.id === ch.id} onClick={() => { setActiveChannel(ch); joinVoice(ch); }} isVoice />
                    {voiceParticipants[ch.name]?.length > 0 && (
                      <div style={{ paddingLeft: 40, paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {voiceParticipants[ch.name].map(p => (
                          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: stringToColor(p), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 10 }}>{p.charAt(0).toUpperCase()}</div>
                            <span style={{ color: 'var(--text-muted)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </ChannelSection>
            )}
            {channels.length === 0 && (
              <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 14 }}>
                No channels yet.{' '}
                <span onClick={() => setModal('createChannel')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Create one!</span>
              </div>
            )}
          </>
        )}

        {view === 'dms' && (
          <>
            {channels.map(ch => {
              const displayName = dmDisplayName(ch, user.id, userCache);
              const partnerId = ch.name.split('-').map(Number).find(n => n !== user.id && !isNaN(n));
              return (
                <ChannelItem key={ch.id} ch={{ ...ch, name: displayName }} active={activeChannel?.id === ch.id} onClick={() => setActiveChannel(ch)} isDm showOnline isOnline={partnerId ? onlineUsers.includes(partnerId) : false} />
              );
            })}
            {channels.length === 0 && (
              <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 14 }}>
                No DMs yet.{' '}
                <span onClick={() => setModal('startDm')} style={{ color: 'var(--accent)', cursor: 'pointer' }}>Start one!</span>
              </div>
            )}
          </>
        )}

        <div style={{ flexGrow: 1 }} />

        <div style={{ padding: '10px 12px', backgroundColor: 'var(--bg-rail)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${stringToColor(user.username)} 0%, ${stringToColor(user.username + '1')} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>{user.username.charAt(0).toUpperCase()}</div>
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%', backgroundColor: wsStatus === 'open' ? 'var(--online)' : 'var(--offline)', border: '2px solid var(--bg-rail)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</div>
            <div style={{ fontSize: 11, color: wsStatus === 'open' ? 'var(--online)' : 'var(--offline)' }}>{wsStatus === 'open' ? '● Online' : '● Offline'}</div>
          </div>
          <div onClick={() => setShowSettings(true)} style={{ color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}>⚙️</div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {activeChannel && (
          <div style={{ padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexShrink: 0, backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--accent)', fontSize: 18 }}>{isVoice ? '🔊' : activeChannel.is_dm ? '👤' : '#'}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>{channelDisplayName}</span>
            </div>
            {activeServer && (
              <div style={{ display: 'flex', gap: 8 }}>
                {serverMembers.find(m => m.id === user?.id)?.role === 'owner' && (
                  <button
                    onClick={async () => {
                      if (confirm(`Delete "${activeServer.name}"?`)) {
                        const res = await secureFetch(`${API_BASE}/api/servers/${activeServer.id}?user_id=${user?.id}`, { method: 'DELETE' });
                        if (res.ok) window.location.reload();
                      }
                    }}
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  >🗑 Delete Space</button>
                )}
                <button onClick={() => setModal('invite')} style={{ background: 'var(--accent)', color: 'white', padding: '5px 14px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>👥 Invite</button>
              </div>
            )}
          </div>
        )}

        {!activeChannel && !showMemberList && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 56 }}>💬</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Welcome to blypp</div>
          </div>
        )}

        {showMemberList && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
              <div style={{ width: 72, height: 72, borderRadius: 22, background: `linear-gradient(135deg, ${stringToColor(activeServer!.name)} 000, #0ea5e9 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 36, fontWeight: 800 }}>{activeServer!.name.charAt(0).toUpperCase()}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Welcome to {activeServer!.name}!</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModal('createChannel')} style={{ background: 'var(--accent)', color: 'white', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>+ Create Channel</button>
                <button onClick={() => setModal('invite')} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '9px 20px', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>👥 Invite People</button>
              </div>
            </div>
            <MemberList members={serverMembers} currentUserId={user.id} onlineUsers={onlineUsers} />
          </div>
        )}

        {isText && <Chat userId={user.id} username={user.username} channelId={activeChannel!.id} channelName={channelDisplayName} ws={globalWs} wsStatus={wsStatus} incomingMsg={lastChatMessage} />}

        {isVoice && token && (
          <LiveKitRoom video={selectedVideo ? { deviceId: selectedVideo } : true} audio={selectedAudio ? { deviceId: selectedAudio } : true} options={{ audioOutput: selectedOutput ? { deviceId: selectedOutput } : undefined }} token={token} serverUrl={livekitUrl} data-lk-theme="default" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <CustomVideoConference />
            <RoomAudioRenderer volume={masterVolume / 100} />
          </LiveKitRoom>
        )}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onLogout={handleLogout} selectedAudioDevice={selectedAudio} selectedVideoDevice={selectedVideo} selectedOutputDevice={selectedOutput} masterVolume={masterVolume} onDeviceChange={(a, v, o, vol) => { setSelectedAudio(a); setSelectedVideo(v); setSelectedOutput(o); setMasterVolume(vol); localStorage.setItem('hec_audio', a || ''); localStorage.setItem('hec_video', v || ''); localStorage.setItem('hec_output', o || ''); localStorage.setItem('hec_volume', String(vol)); }} />}
      {modal === 'createServer' && <CreateServerModal userId={user.id} onClose={() => setModal(null)} onCreated={(s) => { setServers(prev => [...prev, s]); setView('server'); setActiveServer(s); }} />}
      {modal === 'joinServer' && <JoinServerModal userId={user.id} onClose={() => setModal(null)} onJoined={(s) => { setServers(prev => prev.some(x => x.id === s.id) ? prev : [...prev, s]); setView('server'); setActiveServer(s); }} />}
      {modal === 'createChannel' && activeServer && <CreateChannelModal serverId={activeServer.id} onClose={() => setModal(null)} onCreated={(ch) => { setChannels(prev => [...prev, { ...ch, is_dm: false, server_id: activeServer.id }]); }} />}
      {modal === 'invite' && activeServer && <InviteModal serverId={activeServer.id} serverName={activeServer.name} onClose={() => setModal(null)} />}
      {modal === 'startDm' && <StartDmModal userId={user.id} onClose={() => setModal(null)} onStarted={(ch, partnerUsername) => { setChannels(prev => prev.some(c => c.id === ch.id) ? prev : [...prev, ch]); const parts = ch.name.split('-'); if (parts.length === 3) { const a = parseInt(parts[1], 10), b = parseInt(parts[2], 10); const partnerId = a === user.id ? b : a; setUserCache(prev => { const m = new Map(prev); m.set(partnerId, partnerUsername); return m; }); } setActiveChannel(ch); }} />}
    </div>
  );
}

function NavBtn({ emoji, title, onClick, active, accentOnHover }: { emoji: string; title: string; onClick: () => void; active?: boolean; accentOnHover?: boolean; }) {
  return (
    <div onClick={onClick} title={title} style={{ width: 44, height: 44, borderRadius: active ? 14 : '50%', background: active ? 'linear-gradient(135deg, var(--accent) 0%, #38bdf8 100%)' : 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 20, flexShrink: 0, transition: 'border-radius 0.2s, background 0.2s', boxShadow: active ? '0 0 0 2px var(--accent), 0 4px 12px var(--accent-glow)' : 'none', color: active ? 'white' : 'var(--text-secondary)' }} onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderRadius = '14px'; (e.currentTarget as HTMLElement).style.background = accentOnHover ? 'var(--accent)' : 'var(--bg-elevated)'; (e.currentTarget as HTMLElement).style.color = 'white'; } }} onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderRadius = '50%'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; } }} >{emoji}</div>
  );
}

function RailDivider() { return <div style={{ width: 30, height: 1, backgroundColor: 'var(--border)', borderRadius: 1, margin: '2px 0' }} />; }
function SidebarIconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} title={title} style={{ color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18, padding: '3px 7px', borderRadius: 6, transition: 'color 0.15s, background 0.15s', border: 'none', background: 'none' }} onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }} >{children}</button>; }
function ChannelSection({ label, children }: { label: string; children: React.ReactNode }) { return ( <div> <div style={{ padding: '14px 16px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}> {label} </div> {children} </div> ); }
function ChannelItem({ ch, active, onClick, isVoice, isDm, showOnline, isOnline }: { ch: Channel; active: boolean; onClick: () => void; isVoice?: boolean; isDm?: boolean; showOnline?: boolean; isOnline?: boolean; }) { return ( <div onClick={onClick} style={{ padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, margin: '1px 8px', backgroundColor: active ? 'var(--bg-elevated)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'background 0.1s', borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent' }} onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; } }} onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; } }} > <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}> <span style={{ fontSize: 15, flexShrink: 0, color: active ? 'var(--accent)' : 'inherit' }}> {isDm ? '👤' : isVoice ? '🔊' : '#'} </span> {showOnline && isOnline && ( <div style={{ position: 'absolute', bottom: -2, right: -4, width: 9, height: 9, backgroundColor: 'var(--online)', border: '2px solid var(--bg-sidebar)', borderRadius: '50%' }} /> )} </div> <span style={{ fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400 }}> {ch.name} </span> </div> ); }
function MemberList({ members, currentUserId, onlineUsers }: { members: User[]; currentUserId: number; onlineUsers: number[] }) { return ( <div style={{ width: 220, backgroundColor: 'var(--bg-sidebar)', padding: '16px 8px', overflowY: 'auto', flexShrink: 0, borderLeft: '1px solid var(--border)' }}> <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, paddingLeft: 8 }}> Members — {members.length} </div> {members.map(m => ( <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, marginBottom: 2, cursor: 'default' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-surface)'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'} > <div style={{ position: 'relative', flexShrink: 0 }}> <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg, ${stringToColor(m.username)} 0%, ${stringToColor(m.username + '1')} 100%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}> {m.username.charAt(0).toUpperCase()} </div> <div style={{ position: 'absolute', bottom: -1, right: -1, width: 11, height: 11, borderRadius: '50%', backgroundColor: onlineUsers.includes(m.id) ? 'var(--online)' : 'var(--offline)', border: '2px solid var(--bg-sidebar)' }} /> </div> <div> <div style={{ color: m.id === currentUserId ? 'var(--accent)' : 'var(--text-primary)', fontSize: 14, fontWeight: 500 }}> {m.username}{m.id === currentUserId ? ' (you)' : ''} </div> <div style={{ fontSize: 11, color: onlineUsers.includes(m.id) ? 'var(--online)' : 'var(--offline)' }}> {onlineUsers.includes(m.id) ? 'Online' : 'Offline'} </div> </div> </div> ))} </div> ); }
