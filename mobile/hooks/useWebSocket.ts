import { useEffect, useRef, useState, useCallback } from 'react';

export type WsStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface GpsUpdate {
    device_id: string;
    latitude: number;
    longitude: number;
    speed: number;
    altitude: number;
    timestamp: string;
}

export interface AlertMessage {
    device_id: string;
    type: string;
    severity: string;
    message: string;
    created_at: string;
}

interface UseWebSocketOptions {
    url: string;
    onGpsUpdate?: (data: GpsUpdate) => void;
    onAlert?: (data: AlertMessage) => void;
    reconnectDelay?: number;
    maxReconnectDelay?: number;
}

export function useWebSocket({
    url,
    onGpsUpdate,
    onAlert,
    reconnectDelay = 1000,
    maxReconnectDelay = 30000,
}: UseWebSocketOptions) {
    const [status, setStatus] = useState<WsStatus>('disconnected');
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectDelayRef = useRef<number>(reconnectDelay);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unmountedRef = useRef(false);

    const connect = useCallback(() => {
        if (unmountedRef.current) return;
        setStatus('connecting');

        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            if (unmountedRef.current) return;
            setStatus('connected');
            reconnectDelayRef.current = reconnectDelay;
        };

        ws.onmessage = (event) => {
            if (unmountedRef.current) return;
            try {
                const message = JSON.parse(event.data);
                switch (message.type) {
                    case 'gps_update':
                        onGpsUpdate?.(message.data);
                        break;
                    case 'alert':
                        onAlert?.(message.data);
                        break;
                }
            } catch {
                // Ignore malformed messages
            }
        };

        ws.onclose = () => {
            if (unmountedRef.current) return;
            setStatus('disconnected');
            wsRef.current = null;
            scheduleReconnect();
        };

        ws.onerror = () => {
            if (unmountedRef.current) return;
            setStatus('error');
            ws.close();
        };
    }, [url, onGpsUpdate, onAlert, reconnectDelay]);

    const scheduleReconnect = useCallback(() => {
        if (unmountedRef.current) return;
        reconnectTimerRef.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, maxReconnectDelay);
            connect();
        }, reconnectDelayRef.current);
    }, [connect, maxReconnectDelay]);

    useEffect(() => {
        unmountedRef.current = false;
        connect();
        return () => {
            unmountedRef.current = true;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
        };
    }, [connect]);

    return { status };
}
