
# WebRTC P2P Messenger with TCP Bridge

A real-time peer-to-peer messaging application using WebRTC with TCP bridge support for third-party applications.

## Features

- Direct P2P WebRTC communication
- TCP bridge for external applications
- Simple web interface
- IP:Port based room system
- Host/Join connection modes

## Setup

1. Install Node.js dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser to `http://localhost:3000`

## Usage

### Web Clients

1. Enter your name
2. Enter IP:Port (e.g., 127.0.0.1:8080)
3. Click "Host Connection" (first user) or "Join Connection" (second user)
4. Start messaging once connected

### TCP Applications

Connect any TCP client to the same IP:Port that the web host is using. Messages will be bridged between WebRTC and TCP clients.

Example with telnet:
```bash
telnet 127.0.0.1 8080
```

## Files

- `index.html` - Main web interface
- `style.css` - Styling
- `script.js` - WebRTC client logic
- `server.js` - Node.js server with WebSocket signaling and TCP bridge
- `package.json` - Node.js dependencies
- `.env` - Environment configuration

## Configuration

Edit `.env` file to change default ports and settings.
