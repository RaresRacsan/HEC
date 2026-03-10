import { useState, useEffect, useRef } from 'react';
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
} from '@livekit/components-react';
import '@livekit/components-styles';
import './App.css';
import { API_BASE, WS_BASE } from './api';

import Chat from './Chat';
import Auth from './Auth';
import {
  CreateServerModal,
  CreateChannelModal,
  InviteModal,
  JoinServerModal,
  StartDmModal,
} from './Modals';

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

// Resolve a DM channel's display name (extract the other user's ID, then look up)
function dmDisplayName(ch: Channel, myId: number, memberCache: Map<number, string>): string {
  if (!ch.is_dm) return ch.name;
  // name pattern: "dm-A-B"
  const parts = ch.name.split('-'); // ["dm", "A", "B"]
  if (parts.length === 3) {
    const a = parseInt(parts[1], 10);
    const b = parseInt(parts[2], 10);
    const otherId = a === myId ? b : a;
    return memberCache.get(otherId) ?? `User ${otherId}`;
  }
  return ch.name;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function stringToColor(s: string): string {
  const palette = ['#5865F2', '#3ba55d', '#faa61a', '#eb459e', '#ed4245', '#9b59b6', '#1abc9c', '#e67e22'];
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function ServerIcon({ name, active, onClick }: { name: string; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} title={name} style={{
      width: 48, height: 48, borderRadius: active ? '16px' : '50%',
      backgroundColor: active ? '#5865F2' : '#36393f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', color: 'white', fontWeight: 700, fontSize: 18,
      transition: 'border-radius 0.15s, background-color 0.15s', flexShrink: 0, userSelect: 'none',
      boxShadow: active ? '0 0 0 3px #5865F2, 0 0 0 5px #202225' : '0 0 0 2px #202225',
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

type ModalType = 'createServer' | 'joinServer' | 'createChannel' | 'invite' | 'startDm' | null;

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  // Storage for global WebSocket stuff
  const [globalWs, setGlobalWs] = useState<WebSocket | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [lastChatMessage, setLastChatMessage] = useState<ChatMessage | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [voiceParticipants, setVoiceParticipants] = useState<Record<string, string[]>>({});

  // LiveKit — URL uses same host as the page so voice goes through Vite's proxy
  const [token, setToken] = useState('');
  const [livekitUrl, setLivekitUrl] = useState(WS_BASE);

  // Navigation
  const [view, setView] = useState<'dms' | 'server'>('dms');
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [serverMembers, setServerMembers] = useState<User[]>([]);

  // Channels & DMs
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  // User ID cache for resolving DM names (userId → username)
  const [userCache, setUserCache] = useState<Map<number, string>>(new Map());

  // Modals
  const [modal, setModal] = useState<ModalType>(null);

  // Logout popup
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Fetch servers when user logs in ────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    fetchServers();
    // Prime cache with self
    setUserCache(prev => new Map(prev).set(user.id, user.username));
  }, [user]);

  const fetchServers = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/users/${user.id}/servers`);
      const data = await res.json();
      setServers(Array.isArray(data) ? data : []);
    } catch { }
  };

  // ── Fetch channels & members when server changes ──────────────────────
  useEffect(() => {
    if (!activeServer) return;
    setActiveChannel(null);
    (async () => {
      try {
        const [chRes, memRes] = await Promise.all([
          fetch(`${API_BASE}/api/servers/${activeServer.id}/channels`),
          fetch(`${API_BASE}/api/servers/${activeServer.id}/members`),
        ]);
        const [chData, memData] = await Promise.all([chRes.json(), memRes.json()]);
        setChannels(Array.isArray(chData) ? chData : []);
        const members: User[] = Array.isArray(memData) ? memData : [];
        setServerMembers(members);
        // Cache usernames for DM name resolution
        setUserCache(prev => {
          const next = new Map(prev);
          members.forEach(m => next.set(m.id, m.username));
          return next;
        });
      } catch { }
    })();
  }, [activeServer]);

  // ── Poll voice participants ──────────────────────────────────────────────
  useEffect(() => {
    if (!activeServer || view !== 'server') return;
    let timer: number;
    const fetchParticipants = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/servers/${activeServer.id}/voice-participants`);
        if (res.ok) {
          const data = await res.json();
          setVoiceParticipants(data);
        }
      } catch { }
      timer = window.setTimeout(fetchParticipants, 5000);
    };
    fetchParticipants();
    return () => clearTimeout(timer);
  }, [activeServer, view]);

  // ── Fetch DMs ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'dms' || !user) return;
    setActiveServer(null);
    setActiveChannel(null);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/users/${user.id}/dms`);
        const data = await res.json();
        const dms: Channel[] = Array.isArray(data) ? data : [];
        setChannels(dms);
        // Pre-fetch usernames for DM partners
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
            const res = await fetch(`${API_BASE}/api/users/${id}`);
            if (res.ok) {
              const u: { id: number; username: string } = await res.json();
              setUserCache(prev => {
                const next = new Map(prev);
                next.set(u.id, u.username);
                return next;
              });
            }
          } catch { }
        });
      } catch { }
    })();
  }, [view, user]);

  // ── Global WebSocket ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const ws = new WebSocket(`${WS_BASE}/api/ws?user_id=${user.id}`);
    ws.onopen = () => setWsStatus('open');
    ws.onclose = () => setWsStatus('closed');
    ws.onerror = (err) => { console.error('WS Error', err); setWsStatus('closed'); };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'presence') {
          setOnlineUsers(data.online_users || []);
        } else if (data.channel_id) {
          setLastChatMessage(data as ChatMessage);
        }
      } catch (e) { /* ignore */ }
    };
    setGlobalWs(ws);
    return () => {
      ws.close();
      setGlobalWs(null);
    };
  }, [user]);

  // ── Join voice ────────────────────────────────────────────────────────
  const joinVoice = async (ch: Channel) => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/api/livekit/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: ch.name, participant_identity: user.username, participant_name: user.username }),
      });
      if (!res.ok) { console.error('Token fetch failed:', await res.text()); return; }
      const data = await res.json();
      if (data.token && data.livekit_url?.startsWith('ws')) {
        setLivekitUrl(data.livekit_url);
        setToken(data.token);
      } else {
        console.error('Invalid token response', data);
      }
    } catch (e) { console.error(e); }
  };

  const handleSelectChannel = (ch: Channel) => {
    setActiveChannel(ch);
    if (ch.channel_type === 'voice') joinVoice(ch);
    else setToken('');
  };

  if (!user) return <Auth onAuthSuccess={(u) => setUser(u)} />;

  const textChannels = channels.filter(c => !c.channel_type || c.channel_type === 'text');
  const voiceChannels = channels.filter(c => c.channel_type === 'voice');
  const isVoice = activeChannel?.channel_type === 'voice';
  const isText = activeChannel && !isVoice;
  const showMemberList = activeServer && !activeChannel;

  const channelDisplayName = activeChannel
    ? (activeChannel.is_dm ? dmDisplayName(activeChannel, user.id, userCache) : activeChannel.name)
    : '';

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#36393f' }}>

      {/* ── 1. Nav Rail ──────────────────────────────────────────────── */}
      <div style={{
        width: 72, backgroundColor: '#202225', display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '12px 0', gap: 8, flexShrink: 0, overflowY: 'auto',
      }}>
        <NavBtn emoji="💬" active={view === 'dms'} title="Direct Messages" onClick={() => setView('dms')} />
        <Divider />
        {servers.map(s => (
          <ServerIcon key={s.id} name={s.name} active={view === 'server' && activeServer?.id === s.id}
            onClick={() => { setView('server'); setActiveServer(s); }} />
        ))}
        <Divider />
        <NavBtn emoji="🏠" title="Create a Server" onClick={() => setModal('createServer')} color="#3ba55d" />
        <NavBtn emoji="🔗" title="Join a Server via Code" onClick={() => setModal('joinServer')} color="#5865F2" />
      </div>

      {/* ── 2. Extension Panel ────────────────────────────────────────── */}
      <div style={{
        width: 240, backgroundColor: '#2f3136', display: 'flex', flexDirection: 'column',
        flexShrink: 0, overflowY: 'auto',
      }}>
        <div style={{
          padding: '0 16px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontWeight: 700, fontSize: 15, color: 'white', borderBottom: '1px solid #202225', flexShrink: 0,
        }}>
          <span>{view === 'dms' ? 'Direct Messages' : (activeServer?.name ?? 'Select a Server')}</span>
          {view === 'dms' && <IconBtn title="New DM" onClick={() => setModal('startDm')}>✏️</IconBtn>}
          {view === 'server' && activeServer && (
            <div style={{ display: 'flex', gap: 4 }}>
              <IconBtn title="Create Channel" onClick={() => setModal('createChannel')}>+</IconBtn>
              <IconBtn title="Invite People" onClick={() => setModal('invite')}>👥</IconBtn>
            </div>
          )}
        </div>

        {view === 'server' && activeServer && (
          <>
            {textChannels.length > 0 && (
              <ChannelSection label="Text Channels">
                {textChannels.map(ch => (
                  <ChannelItem key={ch.id} ch={ch} active={activeChannel?.id === ch.id} onClick={() => handleSelectChannel(ch)} />
                ))}
              </ChannelSection>
            )}
            {voiceChannels.length > 0 && (
              <ChannelSection label="Voice Channels">
                {voiceChannels.map(ch => (
                  <div key={ch.id}>
                    <ChannelItem ch={ch} active={activeChannel?.id === ch.id} onClick={() => handleSelectChannel(ch)} isVoice />
                    {voiceParticipants[ch.name] && voiceParticipants[ch.name].length > 0 && (
                      <div style={{ paddingLeft: 40, paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {voiceParticipants[ch.name].map(p => (
                          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', backgroundColor: stringToColor(p), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 10 }}>
                              {p.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ color: '#8e9297', fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </ChannelSection>
            )}
            {channels.length === 0 && (
              <div style={{ padding: 16, color: '#72767d', fontSize: 14 }}>
                No channels yet.{' '}
                <span onClick={() => setModal('createChannel')} style={{ color: '#00aff4', cursor: 'pointer' }}>Create one!</span>
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
                <ChannelItem
                  key={ch.id}
                  ch={{ ...ch, name: displayName }}
                  active={activeChannel?.id === ch.id}
                  onClick={() => handleSelectChannel(ch)}
                  isDm
                  showOnline={true}
                  isOnline={partnerId ? onlineUsers.includes(partnerId) : false}
                />
              );
            })}
            {channels.length === 0 && (
              <div style={{ padding: 16, color: '#72767d', fontSize: 14 }}>
                No DMs yet.{' '}
                <span onClick={() => setModal('startDm')} style={{ color: '#00aff4', cursor: 'pointer' }}>Start one!</span>
              </div>
            )}
          </>
        )}

        <div style={{ flexGrow: 1 }} />

        {/* User bar with logout popup */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          {showUserMenu && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              backgroundColor: '#18191c', borderRadius: '8px 8px 0 0', padding: 8,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
              zIndex: 100,
            }}>
              <button
                onClick={() => { setUser(null); setShowUserMenu(false); setServers([]); setChannels([]); setActiveServer(null); setActiveChannel(null); }}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 4, cursor: 'pointer',
                  backgroundColor: 'transparent', color: '#ed4245', textAlign: 'left',
                  fontWeight: 600, fontSize: 14,
                  transition: 'background-color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#ed424520')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                🚪 Log Out
              </button>
            </div>
          )}
          <div
            onClick={() => setShowUserMenu(prev => !prev)}
            style={{
              padding: '8px 12px', backgroundColor: '#292b2f', display: 'flex', alignItems: 'center', gap: 8,
              cursor: 'pointer', transition: 'background-color 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#34373c')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#292b2f')}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%', backgroundColor: '#5865F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0, position: 'relative',
            }}>
              {user.username.charAt(0).toUpperCase()}
              {/* Online indicator dot */}
              <div style={{
                position: 'absolute', bottom: -1, right: -1, width: 12, height: 12,
                borderRadius: '50%', backgroundColor: '#3ba55d', border: '2px solid #292b2f',
              }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'white', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.username}</div>
              <div style={{ color: '#3ba55d', fontSize: 11 }}>● Online</div>
            </div>
            <div style={{ color: '#b9bbbe', fontSize: 14 }}>⚙️</div>
          </div>
        </div>
      </div>

      {/* ── 3. Main Content ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {activeChannel && (
          <div style={{ padding: '0 16px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #202225', flexShrink: 0, backgroundColor: '#36393f' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#8e9297', fontSize: 20 }}>{isVoice ? '🔊' : activeChannel.is_dm ? '👤' : '#'}</span>
              <span style={{ color: 'white', fontWeight: 700 }}>{channelDisplayName}</span>
            </div>
            {activeServer && (
              <div style={{ display: 'flex', gap: 8 }}>
                {serverMembers.find(m => m.id === user?.id)?.role === 'owner' && (
                  <button
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete ${activeServer.name}? This action cannot be undone.`)) {
                        const res = await fetch(`${API_BASE}/api/servers/${activeServer.id}?user_id=${user?.id}`, { method: 'DELETE' });
                        if (res.ok) {
                          window.location.reload();
                        } else {
                          const err = await res.text();
                          alert('Failed to delete server: ' + err);
                        }
                      }
                    }}
                    style={{ background: '#ed4245', color: 'white', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                  >
                    🗑️ Delete Server
                  </button>
                )}
                <button
                  onClick={() => setModal('invite')}
                  style={{ background: '#5865F2', color: 'white', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                >👥 Invite People</button>
              </div>
            )}
          </div>
        )}

        {!activeChannel && !showMemberList && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#8e9297' }}>
            <div style={{ fontSize: 48 }}>👋</div>
            <div style={{ fontSize: 18, marginTop: 12 }}>Pick a channel or server to get started!</div>
          </div>
        )}

        {showMemberList && (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: '#8e9297', gap: 12 }}>
              <div style={{ fontSize: 64 }}>{activeServer!.name.charAt(0).toUpperCase()}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>Welcome to {activeServer!.name}!</div>
              <div>Select a channel on the left to start chatting.</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button onClick={() => setModal('createChannel')} style={{ background: '#5865F2', color: 'white', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                  + Create Channel
                </button>
                <button onClick={() => setModal('invite')} style={{ background: '#3ba55d', color: 'white', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
                  👥 Invite People
                </button>
              </div>
            </div>
            <MemberList members={serverMembers} currentUserId={user.id} onlineUsers={onlineUsers} />
          </div>
        )}

        {isText && (
          <Chat
            userId={user.id}
            username={user.username}
            channelId={activeChannel!.id}
            channelName={channelDisplayName}
            ws={globalWs}
            wsStatus={wsStatus}
            incomingMsg={lastChatMessage}
          />
        )}

        {isVoice && token && livekitUrl.startsWith('ws') && (
          <LiveKitRoom
            video audio
            token={token}
            serverUrl={livekitUrl}
            data-lk-theme="default"
            style={{
              flex: 1,
              minHeight: 0,          // allow flex child to shrink
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',    // prevent controls from escaping viewport
            }}
          >
            <VideoConference />
            <RoomAudioRenderer />
          </LiveKitRoom>
        )}
        {isVoice && !token && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8e9297' }}>
            Connecting to voice…
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {modal === 'createServer' && (
        <CreateServerModal userId={user.id} onClose={() => setModal(null)} onCreated={(s) => {
          setServers(prev => [...prev, s]);
          setView('server');
          setActiveServer(s);
        }} />
      )}
      {modal === 'joinServer' && (
        <JoinServerModal userId={user.id} onClose={() => setModal(null)} onJoined={(s) => {
          setServers(prev => prev.some(x => x.id === s.id) ? prev : [...prev, s]);
          setView('server');
          setActiveServer(s);
        }} />
      )}
      {modal === 'createChannel' && activeServer && (
        <CreateChannelModal serverId={activeServer.id} onClose={() => setModal(null)} onCreated={(ch) => {
          setChannels(prev => [...prev, { ...ch, is_dm: false, server_id: activeServer.id }]);
        }} />
      )}
      {modal === 'invite' && activeServer && (
        <InviteModal serverId={activeServer.id} serverName={activeServer.name} onClose={() => setModal(null)} />
      )}
      {modal === 'startDm' && (
        <StartDmModal
          userId={user.id}
          onClose={() => setModal(null)}
          onStarted={(ch, partnerUsername) => {
            setChannels(prev => prev.some(c => c.id === ch.id) ? prev : [...prev, ch]);
            // Cache the partner's username right away so the DM name shows immediately
            const parts = ch.name.split('-');
            if (parts.length === 3) {
              const a = parseInt(parts[1], 10), b = parseInt(parts[2], 10);
              const partnerId = a === user.id ? b : a;
              setUserCache(prev => { const m = new Map(prev); m.set(partnerId, partnerUsername); return m; });
            }
            setActiveChannel(ch);
          }}
        />
      )}
    </div>
  );
}

// ─── Helper components ──────────────────────────────────────────────────────
function NavBtn({ emoji, title, onClick, active, color }: { emoji: string; title: string; onClick: () => void; active?: boolean; color?: string }) {
  return (
    <div onClick={onClick} title={title} style={{
      width: 48, height: 48, borderRadius: active ? '16px' : '50%',
      backgroundColor: active ? '#5865F2' : '#36393f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      cursor: 'pointer', fontSize: 22, flexShrink: 0,
      transition: 'border-radius 0.15s, background-color 0.15s',
      boxShadow: active ? '0 0 0 3px #5865F2, 0 0 0 5px #202225' : '0 0 0 2px #202225',
      color: color ?? 'white',
    }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderRadius = '16px'; if (color) (e.currentTarget as HTMLElement).style.backgroundColor = color; } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.borderRadius = '50%'; (e.currentTarget as HTMLElement).style.backgroundColor = '#36393f'; } }}
    >{emoji}</div>
  );
}

function Divider() { return <div style={{ width: 32, height: 2, backgroundColor: '#36393f', borderRadius: 1 }} />; }

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{ color: '#b9bbbe', cursor: 'pointer', fontSize: 18, padding: '2px 6px', borderRadius: 4, transition: 'color 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.color = 'white')}
      onMouseLeave={e => (e.currentTarget.style.color = '#b9bbbe')}
    >{children}</button>
  );
}

function ChannelSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ padding: '12px 16px 4px', fontSize: 11, fontWeight: 700, color: '#8e9297', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
      {children}
    </div>
  );
}

function ChannelItem({ ch, active, onClick, isVoice, isDm, showOnline, isOnline }: {
  ch: Channel; active: boolean; onClick: () => void; isVoice?: boolean; isDm?: boolean; showOnline?: boolean; isOnline?: boolean;
}) {
  return (
    <div onClick={onClick} style={{
      padding: '4px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      borderRadius: 4, margin: '1px 8px',
      backgroundColor: active ? '#393c43' : 'transparent',
      color: active ? 'white' : '#8e9297',
      transition: 'background-color 0.1s',
    }}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = '#32353b'; (e.currentTarget as HTMLElement).style.color = '#dcddde'; } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#8e9297'; } }}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{isDm ? '👤' : isVoice ? '🔊' : '#'}</span>
        {showOnline && isOnline && (
          <div style={{
            position: 'absolute', bottom: -2, right: -4, width: 10, height: 10,
            backgroundColor: '#3ba55d', border: '2px solid #2f3136', borderRadius: '50%',
          }} />
        )}
      </div>
      <span style={{ fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.name}</span>
    </div>
  );
}

function MemberList({ members, currentUserId, onlineUsers }: { members: User[]; currentUserId: number; onlineUsers: number[] }) {
  // Colour palette for avatars
  const avatarColor = (name: string) => {
    const palette = ['#5865F2', '#3ba55d', '#faa61a', '#eb459e', '#ed4245', '#9b59b6'];
    let h = 0;
    for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    return palette[Math.abs(h) % palette.length];
  };

  return (
    <div style={{ width: 240, backgroundColor: '#2f3136', padding: '16px 8px', overflowY: 'auto', flexShrink: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#8e9297', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingLeft: 8 }}>
        Online — {members.length}
      </div>
      {members.map(m => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 4, marginBottom: 2, cursor: 'default' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = '#35373c'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: avatarColor(m.username), display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13 }}>
              {m.username.charAt(0).toUpperCase()}
            </div>
            {/* Status dot */}
            {onlineUsers.includes(m.id) && (
              <div style={{
                position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: '50%',
                backgroundColor: '#3ba55d', border: '2px solid #2f3136',
              }} />
            )}
          </div>
          <div>
            <div style={{ color: m.id === currentUserId ? '#5865F2' : '#dcddde', fontSize: 14, fontWeight: 500 }}>
              {m.username}{m.id === currentUserId ? ' (you)' : ''}
            </div>
            <div style={{ color: '#3ba55d', fontSize: 11 }}>Online</div>
          </div>
        </div>
      ))}
      {members.length === 0 && <div style={{ color: '#72767d', fontSize: 14, paddingLeft: 8 }}>No members yet.</div>}
    </div>
  );
}
