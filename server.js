require('dotenv').config();

const net = require('net');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

class TCPWebRTCBridge {
    constructor() {
        this.connections = new Map();
        this.tcpClients = new Map();
        this.setupWebSocketServer();
        this.setupHTTPServer();
    }

    setupWebSocketServer() {
        this.wss = new WebSocket.Server({ port: 8081 });
        console.log('WebSocket signaling server running on port 8081');

        this.wss.on('connection', (ws) => {
            console.log('New WebSocket connection');
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleWebSocketMessage(ws, message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                console.log('WebSocket connection closed');
                this.removeConnection(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });
    }

    setupHTTPServer() {
        const server = http.createServer((req, res) => {
            let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
            const extname = path.extname(filePath);
            
            let contentType = 'text/html';
            switch (extname) {
                case '.css': contentType = 'text/css'; break;
                case '.js': contentType = 'text/javascript'; break;
                case '.json': contentType = 'application/json'; break;
            }

            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(404);
                    res.end('File not found');
                } else {
                    res.writeHead(200, { 'Content-Type': contentType });
                    res.end(content);
                }
            });
        });

        server.listen(3000, () => {
            console.log('HTTP server running on http://localhost:3000');
        });
    }

    handleWebSocketMessage(ws, message) {
        switch (message.type) {
            case 'join':
                this.handleJoin(ws, message);
                break;
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                this.relaySignalingMessage(ws, message);
                break;
            case 'tcp-bridge':
                this.handleTCPBridge(ws, message);
                break;
        }
    }

    handleJoin(ws, message) {
        const { room, username, isHost } = message;
        
        if (!this.connections.has(room)) {
            this.connections.set(room, []);
        }
        
        const roomConnections = this.connections.get(room);
        roomConnections.push({ ws, username, isHost });
        
        ws.room = room;
        ws.username = username;
        ws.isHost = isHost;

        console.log(`${username} joined room ${room} as ${isHost ? 'host' : 'client'}`);

        // Notify others in the room
        roomConnections.forEach(conn => {
            if (conn.ws !== ws) {
                conn.ws.send(JSON.stringify({
                    type: 'user-joined',
                    username,
                    isHost,
                    room
                }));
            }
        });

        // Setup TCP server if this is a host
        if (isHost) {
            this.setupTCPServer(room);
        }
    }

    relaySignalingMessage(senderWs, message) {
        const room = message.room || senderWs.room;
        if (!room || !this.connections.has(room)) return;

        const roomConnections = this.connections.get(room);
        roomConnections.forEach(conn => {
            if (conn.ws !== senderWs && conn.ws.readyState === WebSocket.OPEN) {
                conn.ws.send(JSON.stringify(message));
            }
        });
    }

    setupTCPServer(room) {
        const [ip, port] = room.split(':');
        const tcpPort = parseInt(port);

        if (this.tcpClients.has(room)) {
            return; // Already setup
        }

        const tcpServer = net.createServer((socket) => {
            console.log(`TCP client connected to ${room}`);
            
            socket.on('data', (data) => {
                // Forward TCP data to WebRTC clients
                this.forwardToWebRTC(room, data.toString());
            });

            socket.on('close', () => {
                console.log(`TCP client disconnected from ${room}`);
            });

            socket.on('error', (error) => {
                console.error(`TCP socket error for ${room}:`, error);
            });

            // Store the socket for this room
            this.tcpClients.set(room, socket);
        });

        tcpServer.listen(tcpPort, ip, () => {
            console.log(`TCP server listening on ${ip}:${tcpPort}`);
        });

        tcpServer.on('error', (error) => {
            console.error(`TCP server error for ${room}:`, error);
        });
    }

    forwardToWebRTC(room, data) {
        if (!this.connections.has(room)) return;

        const message = {
            type: 'tcp-message',
            sender: 'TCP Client',
            content: data.trim(),
            timestamp: new Date().toISOString()
        };

        const roomConnections = this.connections.get(room);
        roomConnections.forEach(conn => {
            if (conn.ws.readyState === WebSocket.OPEN) {
                conn.ws.send(JSON.stringify(message));
            }
        });
    }

    removeConnection(ws) {
        if (ws.room && this.connections.has(ws.room)) {
            const roomConnections = this.connections.get(ws.room);
            const index = roomConnections.findIndex(conn => conn.ws === ws);
            if (index !== -1) {
                roomConnections.splice(index, 1);
                if (roomConnections.length === 0) {
                    this.connections.delete(ws.room);
                    // Clean up TCP server if needed
                    if (this.tcpClients.has(ws.room)) {
                        this.tcpClients.get(ws.room).destroy();
                        this.tcpClients.delete(ws.room);
                    }
                }
            }
        }
    }
}

// Start the bridge server
new TCPWebRTCBridge();
