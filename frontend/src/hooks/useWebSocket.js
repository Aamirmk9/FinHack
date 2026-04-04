import { useEffect, useRef, useState, useCallback } from 'react';

export default function useWebSocket() {
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In dev mode, Vite proxies /api but not /ws — connect directly to backend
    const host = window.location.hostname;
    const wsUrl = `${protocol}//${host}:8000/ws`;

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
      // Reconnect after 2s
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
