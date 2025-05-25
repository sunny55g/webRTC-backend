
# WebRTC TCP/IP Messenger

A peer-to-peer messaging application using WebRTC with TCP bridge support.

## Features

- Direct peer-to-peer connections via WebRTC
- Simple UI with just Name and IP:Port inputs
- TCP bridge for external applications
- Real-time messaging
- Connection status monitoring

## Quick Start

### For Development (Local)

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the signaling server:**
   ```bash
   npm start
   ```

3. **Open the web application:**
   - Open `index.html` in your browser
   - Or serve it with a local server: `python -m http.server 8000`

### For Production Deployment

#### Deploy to Netlify (Frontend)

1. **Create a Netlify account** at https://netlify.com
2. **Connect your Git repository** or drag & drop your files
3. **Build settings:**
   - Build command: `echo 'Static site ready'`
   - Publish directory: `.` (root)
4. **Deploy** - Netlify will provide a URL like `https://your-app.netlify.app`

#### Deploy to Render (Backend Signaling Server)

1. **Create a Render account** at https://render.com
2. **Create a new Web Service**
3. **Connect your repository**
4. **Configuration:**
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Port: `3000` (auto-detected)
5. **Environment Variables:**
   - `NODE_ENV=production`
   - `PORT=3000`
   - `TCP_BRIDGE_PORT=8080`

#### Update Frontend for Production

After deploying the backend to Render, update `script.js`:
```javascript
// Replace the signaling server URL
const wsUrl = 'wss://your-render-app.onrender.com';
```

## How to Use

### Web-to-Web Connection

1. **Sender Mode:**
   - Enter your name
   - Enter target IP:Port (e.g., `127.0.0.1:8080`)
   - Click "Connect"

2. **Receiver Mode:**
   - Click "Switch to Receiver Mode"
   - Enter your name
   - Click "Connect"
   - Share your connection details with the sender

### TCP Bridge (External Apps)

1. **Start the signaling server** with TCP bridge enabled
2. **External TCP application** connects to `localhost:8080`
3. **Web clients** can exchange messages with the TCP application

## Configuration

### Environment Variables

- `PORT`: WebSocket signaling server port (default: 3000)
- `TCP_BRIDGE_PORT`: TCP bridge port (default: 8080)
- `NODE_ENV`: Environment mode

### Firewall Settings

Make sure these ports are open:
- `3000`: Signaling server (WebSocket)
- `8080`: TCP bridge (if using external apps)

## Troubleshooting

### Connection Issues

1. **Check browser console** for error messages
2. **Verify IP:Port format** (e.g., `127.0.0.1:8080`)
3. **Ensure signaling server is running**
4. **Check firewall settings**

### Message Not Sending

1. **Wait for "Ready to send messages!" system message**
2. **Check connection status** - should show "Connected"
3. **Verify data channel is open**

### Deployment Issues

#### Netlify
- Ensure all files are in the root directory
- Check build logs for errors
- Verify `netlify.toml` configuration

#### Render
- Check application logs
- Verify environment variables
- Ensure WebSocket connections are supported

## Architecture

```
[Web Client A] ←→ [Signaling Server] ←→ [Web Client B]
                        ↓
                  [TCP Bridge] ←→ [External TCP App]
```

## File Structure

```
├── index.html          # Main web interface
├── style.css          # Styling
├── script.js          # Client-side WebRTC logic
├── server.js          # Signaling server + TCP bridge
├── package.json       # Dependencies
├── .env              # Environment configuration
├── netlify.toml      # Netlify deployment config
└── README.md         # This file
```

## Security Notes

- Use HTTPS/WSS in production
- Implement authentication for production use
- Consider rate limiting for the signaling server
- Validate all input data

## Support

For issues or questions:
1. Check the browser console for errors
2. Verify network connectivity
3. Ensure all dependencies are installed
4. Check firewall/proxy settings
