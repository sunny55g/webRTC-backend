
const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

// Enable CORS for all routes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients with their connection info
const clients = new Map();

// Basic HTTP endpoint for health check
app.get('/', (req, res) => {
    res.json({ 
        message: 'WebRTC Signaling Server',
        status: 'running',
        connectedClients: clients.size
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection from:', req.socket.remoteAddress);
    
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('Received message:', message.type, 'from client');
            
            handleSignalingMessage(ws, message);
        } catch (error) {
            console.error('Error parsing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected');
        // Remove client from clients map
        for (const [key, client] of clients) {
            if (client.ws === ws) {
                clients.delete(key);
                console.log(`Removed client with key: ${key}`);
                break;
            }
        }
    });
    
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

function handleSignalingMessage(ws, message) {
    switch (message.type) {
        case 'register':
            handleRegister(ws, message);
            break;
            
        case 'offer':
            handleOffer(ws, message);
            break;
            
        case 'answer':
            handleAnswer(ws, message);
            break;
            
        case 'ice-candidate':
            handleIceCandidate(ws, message);
            break;
            
        default:
            console.log('Unknown message type:', message.type);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Unknown message type'
            }));
    }
}

function handleRegister(ws, message) {
    const { username, targetAddress, mode } = message;
    const clientKey = `${username}@${targetAddress}`;
    
    console.log(`Registering client: ${clientKey} as ${mode}`);
    
    clients.set(clientKey, {
        ws: ws,
        username: username,
        targetAddress: targetAddress,
        mode: mode
    });
    
    ws.send(JSON.stringify({
        type: 'registered',
        message: `Registered as ${mode} for ${targetAddress}`
    }));
}

function handleOffer(ws, message) {
    const { offer, targetAddress } = message;
    
    console.log(`Relaying offer to target: ${targetAddress}`);
    
    // Find the target client by their targetAddress
    const targetClient = findClientByTargetAddress(targetAddress);
    
    if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
        targetClient.ws.send(JSON.stringify({
            type: 'offer',
            offer: offer
        }));
        console.log('Offer relayed successfully');
    } else {
        console.log('Target client not found or not connected');
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Target peer not found or not connected'
        }));
    }
}

function handleAnswer(ws, message) {
    const { answer, targetAddress } = message;
    
    console.log(`Relaying answer to target: ${targetAddress}`);
    
    // Find the target client by their targetAddress
    const targetClient = findClientByTargetAddress(targetAddress);
    
    if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
        targetClient.ws.send(JSON.stringify({
            type: 'answer',
            answer: answer
        }));
        console.log('Answer relayed successfully');
    } else {
        console.log('Target client not found or not connected');
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Target peer not found or not connected'
        }));
    }
}

function handleIceCandidate(ws, message) {
    const { candidate, targetAddress } = message;
    
    console.log(`Relaying ICE candidate to target: ${targetAddress}`);
    
    // Find the target client by their targetAddress
    const targetClient = findClientByTargetAddress(targetAddress);
    
    if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
        targetClient.ws.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: candidate
        }));
        console.log('ICE candidate relayed successfully');
    } else {
        console.log('Target client not found for ICE candidate');
        // ICE candidates can fail silently as they're not critical
    }
}

function findClientByTargetAddress(targetAddress) {
    // Look for clients whose target address matches the given address
    // This is a simplified matching - in production you might want more sophisticated matching
    for (const [key, client] of clients) {
        if (key.includes(targetAddress) || client.targetAddress === targetAddress) {
            return client;
        }
    }
    
    // Also try reverse lookup - if someone is targeting us
    for (const [key, client] of clients) {
        const [username, address] = key.split('@');
        if (address === targetAddress) {
            return client;
        }
    }
    
    return null;
}

server.listen(port, () => {
    console.log(`🚀 WebRTC Signaling Server running on port ${port}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${port}`);
    console.log(`🌐 HTTP endpoint: http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n📡 Shutting down server gracefully...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
});
