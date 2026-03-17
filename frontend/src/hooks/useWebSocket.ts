import { useEffect, useRef, useState, useCallback } from 'react';

export interface GpsUpdate {
    device_id: number;
    latitude: number;
    longitude: number;
    timestamp: string;
}

interface WebSocketMessage {
    type: string;
    data: GpsUpdate;
}

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export interface UseWebSocketResult {
    isConnected: boolean;
    lastUpdate: GpsUpdate | null;
}

/**
 * Custom hook that manages a WebSocket connection to the GPS tracking server.
 *
 * Features:
 * - Connects automatically on mount
 * - Exposes `isConnected` (true when the socket is open)
 * - Exposes `lastUpdate` with the most-recent GpsUpdate received
 * - Auto-reconnects up to MAX_RECONNECT_ATTEMPTS times after a disconnect
 * - Cleans up the socket and any pending reconnect timers on unmount
 *
 * @param url  WebSocket URL, e.g. "ws://localhost:8080"
 */
export function useWebSocket(url: string): UseWebSocketResult {
    const [isConnected, setIsConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<GpsUpdate | null>(null);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const connect = useCallback(() => {
        // Prevent opening a duplicate connection
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true);
            reconnectAttemptsRef.current = 0;
        };

        ws.onmessage = (event: MessageEvent) => {
            try {
                const message: WebSocketMessage = JSON.parse(event.data as string);
                if (message.type === 'gps_update') {
                    setLastUpdate(message.data);
                }
            } catch (err) {
                console.error('useWebSocket: failed to parse message', err);
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            wsRef.current = null;

            if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttemptsRef.current += 1;
                reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
            }
        };

        ws.onerror = () => {
            // onclose will fire immediately after onerror, so reconnect
            // logic lives there to avoid double-scheduling.
            console.error('useWebSocket: connection error');
        };
    }, [url]);

    useEffect(() => {
        connect();

        return () => {
            if (reconnectTimerRef.current !== null) {
                clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (wsRef.current) {
                // Prevent the onclose handler from scheduling a reconnect after unmount
                wsRef.current.onclose = null;
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);

    return { isConnected, lastUpdate };
}
