class SessionManager {
    constructor() {
        this.sessions = new Map();
    }

    createSession(userId, token, timeout) {
        const expiration = Date.now() + timeout;  
        this.sessions.set(userId, { token, expiration });  
    }

    validateSession(userId, token) {
        const session = this.sessions.get(userId);
        if (!session) return false;
        if (session.token !== token) return false;
        if (Date.now() > session.expiration) {
            this.sessions.delete(userId);
            return false;
        }
        return true;
    }

    endSession(userId) {
        this.sessions.delete(userId);
    }
}

module.exports = new SessionManager();