
const express = require('express');
const WebSocket = require('ws');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (adjust for production)
app.use(cors({
    origin: ['https://zesty-licorice-70a7d5.netlify.app/', 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'WebRTC P2P Signaling Server Running',
        timestamp: new Date().toISOString(),
        connectedPeers: peers.size
    });
});

// Create HTTP server
const server = require('http').createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected peers
const peers = new Map();

class SignalingServer {
    constructor() {
        this.setupWebSocketServer();
        console.log('WebRTC P2P Signaling Server initialized');
    }

    setupWebSocketServer() {
        wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection from:', req.socket.remoteAddress);
            
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);
                    this.handleMessage(ws, message);
                } catch (error) {
                    console.error('Invalid JSON message:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: 'Invalid message format'
                    }));
                }
            });
            
            ws.on('close', () => {
                this.handleDisconnection(ws);
                console.log('WebSocket connection closed');
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.handleDisconnection(ws);
            });
        });
    }

    handleMessage(ws, message) {
        console.log('Received message:', message.type, message.localAddress || '');
        
        switch (message.type) {
            case 'register':
                this.handleRegister(ws, message);
                break;
                
            case 'offer':
                this.handleOffer(message);
                break;
                
            case 'answer':
                this.handleAnswer(message);
                break;
                
            case 'ice-candidate':
                this.handleIceCandidate(message);
                break;
                
            default:
                console.warn('Unknown message type:', message.type);
                ws.send(JSON.stringify({
                    type: 'error',
                    message: 'Unknown message type'
                }));
        }
    }

    handleRegister(ws, message) {
        const { localAddress, targetAddress, username, mode } = message;
        
        if (!localAddress || !targetAddress || !username || !mode) {
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Missing required registration parameters'
            }));
            return;
        }
        
        // Store peer information
        const peerInfo = {
            ws,
            localAddress,
            targetAddress,
            username,
            mode,
            connected: false
        };
        
        peers.set(localAddress, peerInfo);
        
        console.log(`Peer registered: ${username} (${mode}) at ${localAddress} -> ${targetAddress}`);
        
        // Confirm registration
        ws.send(JSON.stringify({
            type: 'registered',
            localAddress,
            targetAddress
        }));
        
        // Look for matching peer
        this.findMatchingPeer(peerInfo);
    }

    findMatchingPeer(peerInfo) {
        const { localAddress, targetAddress } = peerInfo;
        
        // Look for a peer whose local address matches our target address
        // and whose target address matches our local address
        for (const [address, peer] of peers) {
            if (address === targetAddress && peer.targetAddress === localAddress && !peer.connected) {
                console.log(`Found matching peer pair: ${localAddress} <-> ${targetAddress}`);
                
                // Mark both peers as connected
                peerInfo.connected = true;
                peer.connected = true;
                
                // Notify both peers
                peerInfo.ws.send(JSON.stringify({
                    type: 'peer-found',
                    peerAddress: targetAddress,
                    peerUsername: peer.username,
                    peerMode: peer.mode
                }));
                
                peer.ws.send(JSON.stringify({
                    type: 'peer-found',
                    peerAddress: localAddress,
                    peerUsername: peerInfo.username,
                    peerMode: peerInfo.mode
                }));
                
                return;
            }
        }
        
        console.log(`No matching peer found for ${localAddress} -> ${targetAddress}`);
    }

    handleOffer(message) {
        const { offer, targetAddress } = message;
        const targetPeer = peers.get(targetAddress);
        
        if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            console.log(`Forwarding offer to ${targetAddress}`);
            targetPeer.ws.send(JSON.stringify({
                type: 'offer',
                offer
            }));
        } else {
            console.warn(`Target peer ${targetAddress} not found or not connected`);
        }
    }

    handleAnswer(message) {
        const { answer, targetAddress } = message;
        const targetPeer = peers.get(targetAddress);
        
        if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            console.log(`Forwarding answer to ${targetAddress}`);
            targetPeer.ws.send(JSON.stringify({
                type: 'answer',
                answer
            }));
        } else {
            console.warn(`Target peer ${targetAddress} not found or not connected`);
        }
    }

    handleIceCandidate(message) {
        const { candidate, targetAddress } = message;
        const targetPeer = peers.get(targetAddress);
        
        if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
            console.log(`Forwarding ICE candidate to ${targetAddress}`);
            targetPeer.ws.send(JSON.stringify({
                type: 'ice-candidate',
                candidate
            }));
        } else {
            console.warn(`Target peer ${targetAddress} not found or not connected`);
        }
    }

    handleDisconnection(ws) {
        // Find and remove the disconnected peer
        for (const [address, peer] of peers) {
            if (peer.ws === ws) {
                console.log(`Peer disconnected: ${address}`);
                
                // Notify the connected peer if any
                if (peer.connected) {
                    const targetPeer = peers.get(peer.targetAddress);
                    if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
                        targetPeer.ws.send(JSON.stringify({
                            type: 'peer-disconnected',
                            peerAddress: address
                        }));
                        targetPeer.connected = false;
                    }
                }
                
                peers.delete(address);
                break;
            }
        }
    }
}

// Initialize signaling server
new SignalingServer();

// Start the server
server.listen(PORT, () => {
    console.log(`WebRTC P2P Signaling Server running on port ${PORT}`);
    console.log(`WebSocket endpoint: ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});
