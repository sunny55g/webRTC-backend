
const WebSocket = require('ws');
const net = require('net');

const PORT = process.env.PORT || 3000;
const TCP_BRIDGE_PORT = process.env.TCP_BRIDGE_PORT || 8080;

// WebSocket server for signaling
const wss = new WebSocket.Server({ port: PORT });

// Store active connections and rooms
const rooms = new Map();
const connections = new Map();

console.log(`WebRTC Signaling Server running on port ${PORT}`);
console.log(`TCP Bridge listening on port ${TCP_BRIDGE_PORT}`);

// WebSocket signaling server
wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleSignalingMessage(ws, data);
        } catch (error) {
            console.error('Error parsing message:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Invalid message format'
            }));
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket connection closed');
        // Remove from rooms and connections
        for (const [roomId, clients] of rooms) {
            const index = clients.indexOf(ws);
            if (index > -1) {
                clients.splice(index, 1);
                if (clients.length === 0) {
                    rooms.delete(roomId);
                }
                break;
            }
        }
        connections.delete(ws);
    });
});

function handleSignalingMessage(ws, data) {
    console.log('Signaling message:', data.type);
    
    switch (data.type) {
        case 'join':
            handleJoin(ws, data);
            break;
        case 'offer':
            handleOffer(ws, data);
            break;
        case 'answer':
            handleAnswer(ws, data);
            break;
        case 'ice-candidate':
            handleIceCandidate(ws, data);
            break;
        default:
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Unknown message type'
            }));
    }
}

function handleJoin(ws, data) {
    const { room, name, mode, targetAddress } = data;
    
    connections.set(ws, { room, name, mode, targetAddress });
    
    if (!rooms.has(room)) {
        rooms.set(room, []);
    }
    
    rooms.get(room).push(ws);
    
    console.log(`${name} joined room ${room} as ${mode}`);
    
    // Notify others in the room
    const roomClients = rooms.get(room);
    roomClients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'user-joined',
                name: name,
                mode: mode,
                targetAddress: targetAddress
            }));
        }
    });
    
    ws.send(JSON.stringify({
        type: 'joined',
        room: room,
        clients: roomClients.length
    }));
}

function handleOffer(ws, data) {
    const { offer, targetAddress, senderName } = data;
    const senderInfo = connections.get(ws);
    
    if (!senderInfo) return;
    
    const roomClients = rooms.get(senderInfo.room);
    if (!roomClients) return;
    
    // Send offer to all receivers in the room
    roomClients.forEach(client => {
        const clientInfo = connections.get(client);
        if (client !== ws && 
            client.readyState === WebSocket.OPEN && 
            clientInfo && 
            clientInfo.mode === 'receiver') {
            
            client.send(JSON.stringify({
                type: 'offer',
                offer: offer,
                senderName: senderName,
                targetAddress: targetAddress
            }));
        }
    });
}

function handleAnswer(ws, data) {
    const { answer, targetAddress, receiverName } = data;
    const receiverInfo = connections.get(ws);
    
    if (!receiverInfo) return;
    
    const roomClients = rooms.get(receiverInfo.room);
    if (!roomClients) return;
    
    // Send answer to the sender
    roomClients.forEach(client => {
        const clientInfo = connections.get(client);
        if (client !== ws && 
            client.readyState === WebSocket.OPEN && 
            clientInfo && 
            clientInfo.mode === 'sender') {
            
            client.send(JSON.stringify({
                type: 'answer',
                answer: answer,
                receiverName: receiverName
            }));
        }
    });
}

function handleIceCandidate(ws, data) {
    const { candidate, targetAddress, senderName } = data;
    const senderInfo = connections.get(ws);
    
    if (!senderInfo) return;
    
    const roomClients = rooms.get(senderInfo.room);
    if (!roomClients) return;
    
    // Send ICE candidate to other clients
    roomClients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'ice-candidate',
                candidate: candidate,
                senderName: senderName
            }));
        }
    });
}

// TCP Bridge Server for external applications
const tcpServer = net.createServer((socket) => {
    console.log('TCP client connected:', socket.remoteAddress);
    
    socket.on('data', (data) => {
        const message = data.toString().trim();
        console.log('TCP received:', message);
        
        // Broadcast to WebRTC clients
        // This is a simple bridge - you can enhance this based on your needs
        wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                    type: 'tcp-message',
                    content: message,
                    sender: 'TCP-App'
                }));
            }
        });
    });
    
    socket.on('close', () => {
        console.log('TCP client disconnected');
    });
    
    socket.on('error', (error) => {
        console.error('TCP socket error:', error);
    });
});

tcpServer.listen(TCP_BRIDGE_PORT, () => {
    console.log(`TCP Bridge Server listening on port ${TCP_BRIDGE_PORT}`);
});

// Handle server shutdown
process.on('SIGINT', () => {
    console.log('Shutting down server...');
    wss.close();
    tcpServer.close();
    process.exit(0);
});
