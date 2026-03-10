// API base URLs — use relative paths so all requests go through Vite's proxy for web,
// but for the Tauri desktop app, use the production URLs directly.
const isTauri = window.location.protocol === 'tauri:' || (window as any).__TAURI_INTERNALS__ !== undefined;

export const API_BASE = isTauri ? 'https://blypp.tech' : '';

// WebSocket: connect back to the same host/port as the page, or the prod server if Tauri
export const WS_BASE = isTauri ? 'wss://blypp.tech' : `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`;
