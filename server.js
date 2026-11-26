const http = require('http');
const fs = require('fs/promises');
const path = require('path');
const { URL } = require('url');

const port = Number(process.env.PORT) || 3000;
const root = __dirname;
const productsPath = path.join(root, 'products.json');
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml'
};
const sseClients = new Set();

async function readProducts() {
    const products = JSON.parse(await fs.readFile(productsPath, 'utf8'));
    return products.filter(product => product.price >= 15000 && product.price <= 40000);
}

function send(response, status, body, contentType = 'text/plain; charset=utf-8') {
    response.writeHead(status, { 'Content-Type': contentType });
    response.end(body);
}

async function readBody(request) {
    let body = '';
    for await (const chunk of request) body += chunk;
    return body;
}

const server = http.createServer(async (request, response) => {
    try {
        const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

        if (requestUrl.pathname === '/api/products') {
            if (request.method === 'GET') {
                return send(response, 200, JSON.stringify(await readProducts()), mimeTypes['.json']);
            }
            if (request.method === 'POST') {
                const products = JSON.parse(await readBody(request));
                if (!Array.isArray(products)) return send(response, 400, 'Products must be an array.');
                const temporaryProductsPath = `${productsPath}.tmp`;
                await fs.writeFile(temporaryProductsPath, `${JSON.stringify(products, null, 2)}\n`, 'utf8');
                await fs.rename(temporaryProductsPath, productsPath);
                sseClients.forEach(client => {
                    try { client.write('data: {"type":"updated"}\n\n'); } catch { }
                });
                return send(response, 200, JSON.stringify({ ok: true }), mimeTypes['.json']);
            }
            return send(response, 405, 'Method not allowed.');
        }

        if (requestUrl.pathname === '/api/products/stream') {
            if (request.method !== 'GET') return send(response, 405, 'Method not allowed.');
            response.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive'
            });
            response.write('data: {"type":"connected"}\n\n');
            sseClients.add(response);
            request.on('close', () => sseClients.delete(response));
            return;
        }

        let relativePath = decodeURIComponent(requestUrl.pathname);
        if (relativePath === '/') relativePath = '/index.html';
        const filePath = path.resolve(root, `.${relativePath}`);
        if (!filePath.startsWith(root + path.sep)) return send(response, 403, 'Forbidden.');

        const data = await fs.readFile(filePath);
        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, { 'Content-Type': mimeTypes[extension] || 'application/octet-stream' });
        response.end(data);
    } catch (error) {
        if (error.code === 'ENOENT') return send(response, 404, 'Not found.');
        console.error(error);
        send(response, 500, 'Server error.');
    }
});

server.listen(port, () => {
    console.log(`LTECH running at http://localhost:${port}`);
    console.log(`Vendor console at http://localhost:${port}/vender.html`);
});
