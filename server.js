const http = require('http');
const url = require('url');

const server = http.createServer((req, res) => {
    console.log(`Incoming request: ${req.method} ${req.url}`);

    if (req.method === 'POST' && req.url === '/alice') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            console.log('Request body:', body);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                response: { text: 'Minimal server response!' },
                version: JSON.parse(body).version || '1.0'
            }));
        });
    } else if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Minimal server is running!');
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('Server is listening for connections');
    console.log(`Minimal server running on port ${PORT}`);
    console.log('Listening on all interfaces');
});

// Ловим сигнал остановки
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

server.on('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
});