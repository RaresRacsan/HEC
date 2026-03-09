// API base URLs — use relative paths so all requests go through Vite's proxy
// (works on all devices on the LAN — no firewall rule needed for port 3000)
export const API_BASE = '';

// WebSocket: connect back to the same host/port as the page, via the Vite proxy
export const WS_BASE = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
