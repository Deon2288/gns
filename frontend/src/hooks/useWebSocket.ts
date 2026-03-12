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

export interface DeviceStatusUpdate {
    device_id: string;
    status: 'active' | 'idle' | 'offline';
}

export interface AlertMessage {
    device_id: string;
    type: string;
    severity: string;
    message: string;
    created_at: string;
}

export interface WebSocketMessage {
    type: 'connected' | 'gps_update' | 'alert' | 'device_status' | 'pong' | 'error';
    data?: GpsUpdate | DeviceStatusUpdate | AlertMessage;
    message?: string;
    timestamp?: string;
}

interface UseWebSocketOptions {
    url: string;
    onGpsUpdate?: (data: GpsUpdate) => void;
    onAlert?: (data: AlertMessage) => void;
    onDeviceStatus?: (data: DeviceStatusUpdate) => void;
    reconnectDelay?: number;
    maxReconnectDelay?: number;
}

export function useWebSocket({
    url,
    onGpsUpdate,
    onAlert,
    onDeviceStatus,
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
                const message: WebSocketMessage = JSON.parse(event.data);
                switch (message.type) {
                    case 'gps_update':
                        onGpsUpdate?.(message.data as GpsUpdate);
                        break;
                    case 'alert':
                        onAlert?.(message.data as AlertMessage);
                        break;
                    case 'device_status':
                        onDeviceStatus?.(message.data as DeviceStatusUpdate);
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
    }, [url, onGpsUpdate, onAlert, onDeviceStatus, reconnectDelay]);

    const scheduleReconnect = useCallback(() => {
        if (unmountedRef.current) return;
        reconnectTimerRef.current = setTimeout(() => {
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, maxReconnectDelay);
            connect();
        }, reconnectDelayRef.current);
    }, [connect, maxReconnectDelay]);

    const sendMessage = useCallback((message: object) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
        }
    }, []);

    const subscribe = useCallback((deviceIds: string[]) => {
        sendMessage({ type: 'subscribe', deviceIds });
    }, [sendMessage]);

    useEffect(() => {
        unmountedRef.current = false;
        connect();
        return () => {
            unmountedRef.current = true;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
        };
    }, [connect]);

    return { status, sendMessage, subscribe };
}
