import { useEffect, useRef, useState, useCallback } from 'react';

export default function useWebSocket() {
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const failureCount = useRef(0);

  const connect = useCallback(() => {
    const backendUrl = import.meta.env.VITE_API_URL || '';
    const isProdSnapshot = !backendUrl && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isProdSnapshot) return; // static snapshot deploy — no live websocket

    let wsUrl;
    if (backendUrl) {
      // Remote backend — convert https://foo.com to wss://foo.com/ws
      wsUrl = backendUrl.replace(/^http/, 'ws') + '/ws';
    } else {
      // Local dev — use proxy through Vite
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host}/ws`;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      // Send keepalive every 30s
      const keepalive = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, 30000);
      ws._keepalive = keepalive;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastUpdate(data);
      } catch (e) {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      clearInterval(ws._keepalive);
      failureCount.current += 1;
      if (failureCount.current > 5) return; // give up after repeated failures
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  return { lastUpdate, connected };
}
