# Remote Access API Endpoints

## 1. POST /api/tunnels/create  
Creates SSH/HTTP tunnels. This endpoint allows users to establish secure connections to specified endpoints.

## 2. GET /api/tunnels/list  
Lists all currently active tunnels. This is useful for monitoring the tunneling services in real-time.

## 3. POST /api/tunnels/start  
Starts a tunnel session. Users can activate their respective tunnels via this endpoint.

## 4. POST /api/tunnels/stop  
Stops an active tunnel. This endpoint is used to deactivate tunnels that are no longer needed.

## 5. GET /api/tunnels/:id/status  
Fetches the current status of a specific tunnel identified by its ID. This helps in tracking the tunnel's activity.

## 6. GET /api/tunnels/:id/logs  
Retrieves audit logs for a specific tunnel. This is essential for reviewing previous session activities.

## 7. DELETE /api/tunnels/:id  
Deletes the configuration of a specified tunnel. This endpoint removes all settings related to that tunnel.

## 8. POST /api/sessions/validate  
Validates a session. This endpoint is used to ensure that the session tokens are authentic and valid.

## 9. GET /api/sessions/list  
Lists all active sessions. This is useful for monitoring user activity and session management.

## 10. POST /api/credentials/store  
Stores encrypted device credentials securely. This endpoint is crucial for managing sensitive information without compromising security.