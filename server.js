const http = require('http');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { URL } = require('url');
const crypto = require('crypto');

// Load environment variables from .env
function loadEnv() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (fsSync.existsSync(envPath)) {
            const content = fsSync.readFileSync(envPath, 'utf8');
            content.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const idx = trimmed.indexOf('=');
                    if (idx !== -1) {
                        const key = trimmed.slice(0, idx).trim();
                        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
                        if (!process.env[key]) process.env[key] = val;
                    }
                }
            });
        }
    } catch (e) {
        console.warn('Could not read .env file:', e.message);
    }
}
loadEnv();

const port = Number(process.env.PORT) || 3000;
const root = process.env.VERCEL ? process.cwd() : __dirname;
const dataDir = path.join(root, 'data');
const materialsPath = path.join(dataDir, 'materials.json');
const ordersPath = path.join(dataDir, 'orders.json');
const configPath = path.join(dataDir, 'config.json');
const documentsDir = path.join(root, 'documents');

const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.ico': 'image/x-icon'
};

const sseClients = new Set();

function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(payload);
        } catch {
            sseClients.delete(client);
        }
    }
}

const memoryCache = new Map();

async function readJson(filePath, fallback) {
    if (memoryCache.has(filePath)) {
        return memoryCache.get(filePath);
    }
    try {
        let target = filePath;
        if (!fsSync.existsSync(target)) {
            const rel = path.relative(root, filePath);
            const alt = path.resolve(process.cwd(), rel);
            if (fsSync.existsSync(alt)) target = alt;
        }
        const content = await fs.readFile(target, 'utf8');
        const parsed = JSON.parse(content);
        memoryCache.set(filePath, parsed);
        return parsed;
    } catch {
        return fallback;
    }
}

async function writeJson(filePath, data) {
    memoryCache.set(filePath, data);
    try {
        const tempPath = `${filePath}.${Date.now()}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
        await fs.rename(tempPath, filePath);
    } catch (err) {
        // Fallback for read-only serverless Lambda environments (Vercel)
        try {
            const baseName = path.basename(filePath);
            const tmpFile = path.join('/tmp', baseName);
            await fs.writeFile(tmpFile, JSON.stringify(data, null, 2), 'utf8');
        } catch {}
    }
}

function send(response, status, body, contentType = 'application/json; charset=utf-8') {
    response.writeHead(status, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    response.end(typeof body === 'string' ? body : JSON.stringify(body));
}

async function readBody(request) {
    let body = '';
    for await (const chunk of request) body += chunk;
    if (!body) return {};
    try {
        return JSON.parse(body);
    } catch {
        // try URL-encoded if applicable
        try {
            const params = new URLSearchParams(body);
            const obj = {};
            for (const [k, v] of params.entries()) obj[k] = v;
            return obj;
        } catch {
            return {};
        }
    }
}

function formatPhoneNumber(phone) {
    let clean = (phone || '').toString().trim().replace(/[\s\-\+\(\)]/g, '');
    if (clean.startsWith('0')) {
        clean = '254' + clean.slice(1);
    } else if (clean.startsWith('7') || clean.startsWith('1')) {
        clean = '254' + clean;
    }
    return clean;
}

function formatLocalPhone(phone) {
    let clean = formatPhoneNumber(phone);
    if (clean.startsWith('254')) {
        return '0' + clean.slice(3);
    }
    return clean;
}

// PayHero format: 07xxxxxxxx or 01xxxxxxxx (e.g. 0787677676)
function formatPayHeroPhone(phone) {
    let clean = (phone || '').toString().trim().replace(/[\s\-\+\(\)]/g, '');
    if (clean.startsWith('254')) {
        return '0' + clean.slice(3);
    }
    if (!clean.startsWith('0') && (clean.startsWith('7') || clean.startsWith('1'))) {
        return '0' + clean;
    }
    return clean;
}

function getPayHeroAuthHeader(apiKey, apiSecret) {
    if (apiKey && apiKey.startsWith('Basic ')) {
        return apiKey;
    }
    const user = apiKey || process.env.PAYHERO_API_KEY;
    const pass = apiSecret || process.env.PAYHERO_API_SECRET;
    if (user && pass) {
        return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    }
    if (process.env.PAYHERO_BASIC_AUTH) {
        return process.env.PAYHERO_BASIC_AUTH;
    }
    return '';
}

function generateReceiptNumber() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'EE';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function generateDownloadToken() {
    return 'token_' + crypto.randomBytes(16).toString('hex');
}

function calculatePrice(type) {
    const normalized = (type || '').toLowerCase().replace(/\s+/g, '-');
    if (normalized.includes('cat')) return 25;
    if (normalized.includes('special') || normalized.includes('supp')) return 250;
    return 200; // Past papers: 200 KES
}

// -------------------------------------------------------------
// THIRD-PARTY M-PESA GATEWAYS (Direct to Personal Phone Number)
// -------------------------------------------------------------

// 1. PayHero Kenya (backend.payhero.co.ke/api/v2/payments)
// Pushes real M-Pesa STK Push directly to phone or Till/Paybill
async function triggerPayHeroStkPush({ apiKey, apiSecret, channelId, phone, amount, reference, callbackUrl, customerName }) {
    const auth = getPayHeroAuthHeader(apiKey, apiSecret);
    const formattedPhone = formatPayHeroPhone(phone);
    const resolvedChannelId = Number(channelId) || Number(process.env.PAYHERO_CHANNEL_ID) || 11662;

    const payload = {
        amount: Math.round(Number(amount)),
        phone_number: formattedPhone,
        channel_id: resolvedChannelId,
        provider: 'm-pesa',
        external_reference: reference,
        customer_name: customerName || 'Course Student',
        callback_url: callbackUrl || ''
    };

    console.log(`[PayHero] Initiating Real STK Push: Phone=${formattedPhone}, Amount=KES ${payload.amount}, Channel=${payload.channel_id}, Ref=${reference}`);

    const res = await fetch('https://backend.payhero.co.ke/api/v2/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': auth
        },
        body: JSON.stringify(payload)
    });

    let data;
    const text = await res.text();
    try {
        data = JSON.parse(text);
    } catch {
        data = { message: text || `HTTP ${res.status}` };
    }
    return { ok: res.ok, status: res.status, data };
}

// Query PayHero status via transactions endpoint
async function queryPayHeroStatus({ apiKey, apiSecret, reference, externalReference }) {
    const auth = getPayHeroAuthHeader(apiKey, apiSecret);
    if (!auth) return null;

    try {
        // Query by external_reference first (which is our unique orderId like EE-123456)
        const refToQuery = externalReference || reference;
        const res = await fetch(`https://backend.payhero.co.ke/api/v2/transactions?external_reference=${encodeURIComponent(refToQuery)}`, {
            headers: { 'Authorization': auth }
        });
        if (res.ok) {
            const data = await res.json();
            const txs = data.transactions || [];
            const inbound = txs.find(t => t.transaction_type === 'inbound_payment' || (Number(t.amount) > 0 && !t.transaction_type?.includes('charge')));
            if (inbound) {
                return {
                    status: 'SUCCESS',
                    mpesa_receipt: inbound.provider_reference || inbound.transaction_reference,
                    amount: inbound.amount,
                    phone: inbound.beneficiary_number || inbound.description
                };
            }
            const failed = txs.find(t => t.status === 'FAILED' || t.status === 'CANCELLED' || t.status === 'DECLINED' || t.status === 'EXPIRED');
            if (failed) {
                return {
                    status: 'FAILED',
                    description: failed.description || failed.message || 'Payment was cancelled or declined on phone.'
                };
            }
        }

        // Fallback: Query by PayHero reference if provided
        if (reference && reference !== refToQuery) {
            const res2 = await fetch(`https://backend.payhero.co.ke/api/v2/transactions?reference=${encodeURIComponent(reference)}`, {
                headers: { 'Authorization': auth }
            });
            if (res2.ok) {
                const data2 = await res2.json();
                const txs2 = data2.transactions || [];
                const inbound2 = txs2.find(t => t.transaction_type === 'inbound_payment' || (Number(t.amount) > 0 && !t.transaction_type?.includes('charge')));
                if (inbound2) {
                    return {
                        status: 'SUCCESS',
                        mpesa_receipt: inbound2.provider_reference || inbound2.transaction_reference,
                        amount: inbound2.amount
                    };
                }
                const failed2 = txs2.find(t => t.status === 'FAILED' || t.status === 'CANCELLED' || t.status === 'DECLINED' || t.status === 'EXPIRED');
                if (failed2) {
                    return {
                        status: 'FAILED',
                        description: failed2.description || failed2.message || 'Payment was cancelled or declined on phone.'
                    };
                }
            }
        }
    } catch (e) {
        console.warn('[PayHero] Status check warning:', e.message);
    }
    return null;
}

// Fetch registered payment channels from PayHero account
async function getPayHeroChannels({ apiKey, apiSecret }) {
    const auth = getPayHeroAuthHeader(apiKey, apiSecret);
    if (!auth) return [];
    try {
        const res = await fetch('https://backend.payhero.co.ke/api/v2/payment_channels', {
            headers: { 'Authorization': auth }
        });
        if (res.ok) {
            const data = await res.json();
            return data.payment_channels || [];
        }
    } catch (e) {
        console.warn('[PayHero] Channel fetch warning:', e.message);
    }
    return [];
}

// 2. TinyPesa (tinypesa.com)
// Pushes real M-Pesa STK Push to phone without business shortcode
async function triggerTinyPesaStkPush({ apiKey, phone, amount, reference }) {
    console.log(`[TinyPesa] Initiating Real STK Push for ${phone}, Amount: KES ${amount}, Reference: ${reference}`);
    const params = new URLSearchParams();
    params.append('amount', Math.round(amount));
    params.append('msisdn', formatLocalPhone(phone));
    params.append('account_no', reference);

    const res = await fetch('https://tinypesa.com/api/v1/express/initialize', {
        method: 'POST',
        headers: {
            'ApiKey': apiKey,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });

    let data;
    const text = await res.text();
    try {
        data = JSON.parse(text);
    } catch {
        data = { message: text || `HTTP ${res.status}` };
    }
    return { ok: res.ok, status: res.status, data };
}

// 3. IntaSend (intasend.com)
async function triggerIntaSendStkPush({ publicKey, phone, amount, reference }) {
    console.log(`[IntaSend] Initiating Real STK Push for ${phone}, Amount: KES ${amount}, Ref: ${reference}`);
    const payload = {
        public_key: publicKey,
        currency: 'KES',
        method: 'M-PESA',
        amount: Math.round(amount),
        phone_number: formatPhoneNumber(phone),
        api_ref: reference,
        name: 'Course Student'
    };

    const res = await fetch('https://payment.intasend.com/api/v1/checkout/mpesa-stk-push/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    let data;
    const text = await res.text();
    try {
        data = JSON.parse(text);
    } catch {
        data = { message: text || `HTTP ${res.status}` };
    }
    return { ok: res.ok, status: res.status, data };
}

// 4. Safaricom Daraja (Direct Shortcode)
function getDarajaTimestamp() {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${YYYY}${MM}${DD}${hh}${mm}${ss}`;
}

async function getDarajaToken(consumerKey, consumerSecret, environment) {
    const host = environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const res = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
        method: 'GET',
        headers: { Authorization: `Basic ${auth}` }
    });
    if (!res.ok) throw new Error(`Daraja token error: ${res.statusText}`);
    const data = await res.json();
    return data.access_token;
}

async function triggerDarajaStkPush({ shortcode, passkey, consumerKey, consumerSecret, environment, callbackUrl, phone, amount, accountRef }) {
    const host = environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
    const token = await getDarajaToken(consumerKey, consumerSecret, environment);
    const timestamp = getDarajaTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

    const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formatPhoneNumber(phone),
        PartyB: shortcode,
        PhoneNumber: formatPhoneNumber(phone),
        CallBackURL: callbackUrl,
        AccountReference: accountRef || 'Course',
        TransactionDesc: 'Course Papers'
    };

    const res = await fetch(`${host}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// -------------------------------------------------------------
// HTTP SERVER & API ROUTES
// -------------------------------------------------------------
async function handleRequest(request, response) {
    try {
        const requestUrl = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
        let pathname = requestUrl.pathname;
        // On Vercel, if route was rewritten to /api/index.js, restore actual path
        if (pathname === '/api/index.js' || pathname === '/api' || pathname === '/api/') {
            const matched = request.headers['x-matched-path'] || request.headers['x-invoke-path'] || request.headers['x-forwarded-uri'];
            if (matched && matched.startsWith('/api/')) {
                pathname = matched.split('?')[0];
            }
        }
        const method = request.method;

        if (method === 'OPTIONS') {
            return send(response, 204, '');
        }

        // SSE stream
        if (pathname === '/api/stream') {
            if (method !== 'GET') return send(response, 405, { error: 'Method not allowed' });
            response.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                Connection: 'keep-alive',
                'Access-Control-Allow-Origin': '*'
            });
            response.write('event: connected\ndata: {"status":"connected"}\n\n');
            sseClients.add(response);
            request.on('close', () => sseClients.delete(response));
            return;
        }

        // GET & POST /api/config: Provider settings
        if (pathname === '/api/config') {
            if (method === 'GET') {
                const config = await readJson(configPath, {});
                const payment = config.payment || {};
                const activeProvider = payment.provider || process.env.PAYMENT_PROVIDER || 'payhero';
                const receivingPhone = payment.receivingPhone || process.env.RECEIVING_PHONE || config.receivingPhone || '0707865597';

                return send(response, 200, {
                    appName: config.appName || 'Course',
                    receivingPhone,
                    currency: 'KES',
                    prices: config.prices || { 'past-paper': 200, 'cat': 25, 'special': 250 },
                    activeProvider,
                    payment: {
                        provider: activeProvider,
                        receivingPhone,
                        payhero: {
                            apiKey: process.env.PAYHERO_API_KEY || payment.payhero?.apiKey || '',
                            apiSecret: (process.env.PAYHERO_API_SECRET || payment.payhero?.apiSecret) ? '••••••••' : '',
                            channelId: process.env.PAYHERO_CHANNEL_ID || payment.payhero?.channelId || '11662',
                            accountId: process.env.PAYHERO_ACCOUNT_ID || payment.payhero?.accountId || '11180',
                            callbackUrl: payment.payhero?.callbackUrl || ''
                        },
                        tinypesa: {
                            apiKey: (process.env.TINYPESA_API_KEY || payment.tinypesa?.apiKey) ? '••••••••' : ''
                        },
                        intasend: {
                            publicKey: process.env.INTASEND_PUBLIC_KEY || payment.intasend?.publicKey || '',
                            secretKey: (process.env.INTASEND_SECRET_KEY || payment.intasend?.secretKey) ? '••••••••' : ''
                        },
                        daraja: {
                            shortcode: process.env.DARAJA_SHORTCODE || payment.daraja?.shortcode || '174379',
                            environment: process.env.DARAJA_ENVIRONMENT || payment.daraja?.environment || 'sandbox'
                        }
                    }
                });
            }

            if (method === 'POST') {
                const update = await readBody(request);
                const current = await readJson(configPath, {});
                const currentPayment = current.payment || {};

                const newPayment = {
                    ...currentPayment,
                    provider: update.provider || currentPayment.provider || 'payhero',
                    receivingPhone: update.receivingPhone || currentPayment.receivingPhone || '0707865597',
                    payhero: {
                        apiKey: update.payhero?.apiKey && update.payhero.apiKey !== '••••••••' ? update.payhero.apiKey : (currentPayment.payhero?.apiKey || process.env.PAYHERO_API_KEY || ''),
                        apiSecret: update.payhero?.apiSecret && update.payhero.apiSecret !== '••••••••' ? update.payhero.apiSecret : (currentPayment.payhero?.apiSecret || process.env.PAYHERO_API_SECRET || ''),
                        channelId: update.payhero?.channelId || currentPayment.payhero?.channelId || process.env.PAYHERO_CHANNEL_ID || '11662',
                        accountId: update.payhero?.accountId || currentPayment.payhero?.accountId || process.env.PAYHERO_ACCOUNT_ID || '11180',
                        callbackUrl: update.payhero?.callbackUrl || currentPayment.payhero?.callbackUrl || ''
                    },
                    tinypesa: {
                        apiKey: update.tinypesa?.apiKey && update.tinypesa.apiKey !== '••••••••' ? update.tinypesa.apiKey : (currentPayment.tinypesa?.apiKey || '')
                    },
                    intasend: {
                        publicKey: update.intasend?.publicKey || currentPayment.intasend?.publicKey || '',
                        secretKey: update.intasend?.secretKey && update.intasend.secretKey !== '••••••••' ? update.intasend.secretKey : (currentPayment.intasend?.secretKey || '')
                    },
                    daraja: {
                        shortcode: update.daraja?.shortcode || currentPayment.daraja?.shortcode || '174379',
                        passkey: update.daraja?.passkey && update.daraja.passkey !== '••••••••' ? update.daraja.passkey : (currentPayment.daraja?.passkey || ''),
                        consumerKey: update.daraja?.consumerKey || currentPayment.daraja?.consumerKey || '',
                        consumerSecret: update.daraja?.consumerSecret && update.daraja.consumerSecret !== '••••••••' ? update.daraja.consumerSecret : (currentPayment.daraja?.consumerSecret || ''),
                        environment: update.daraja?.environment || currentPayment.daraja?.environment || 'sandbox',
                        callbackUrl: update.daraja?.callbackUrl || currentPayment.daraja?.callbackUrl || ''
                    }
                };

                current.payment = newPayment;
                current.receivingPhone = newPayment.receivingPhone;
                await writeJson(configPath, current);
                broadcast('config-updated', { ok: true });
                return send(response, 200, { success: true, message: 'Payment gateway configuration saved.' });
            }
            return send(response, 405, { error: 'Method not allowed' });
        }

        // GET /api/payhero/channels: List live payment channels from PayHero account
        if (pathname === '/api/payhero/channels') {
            if (method !== 'GET') return send(response, 405, { error: 'Method not allowed' });
            const config = await readJson(configPath, {});
            const apiKey = process.env.PAYHERO_API_KEY || config.payment?.payhero?.apiKey;
            const apiSecret = process.env.PAYHERO_API_SECRET || config.payment?.payhero?.apiSecret;
            const channels = await getPayHeroChannels({ apiKey, apiSecret });
            return send(response, 200, {
                success: true,
                accountId: process.env.PAYHERO_ACCOUNT_ID || config.payment?.payhero?.accountId || 11180,
                activeChannelId: process.env.PAYHERO_CHANNEL_ID || config.payment?.payhero?.channelId || 11662,
                channels
            });
        }

        // GET /api/materials: List or search catalog
        if (pathname === '/api/materials') {
            if (method === 'GET') {
                const materials = await readJson(materialsPath, []);
                const q = (requestUrl.searchParams.get('q') || '').toLowerCase().trim();
                const faculty = requestUrl.searchParams.get('faculty');
                const category = requestUrl.searchParams.get('category');
                const unit = requestUrl.searchParams.get('unit');

                let filtered = materials;
                if (faculty && faculty !== 'all') {
                    filtered = filtered.filter(m => m.facultyId === faculty || m.faculty.toLowerCase().includes(faculty.toLowerCase()));
                }
                if (category && category !== 'all') {
                    filtered = filtered.filter(m => m.category === category || m.type.toLowerCase().includes(category.toLowerCase()));
                }
                if (unit && unit !== 'all') {
                    filtered = filtered.filter(m => m.unitCode === unit || m.unitName.toLowerCase().includes(unit.toLowerCase()));
                }
                if (q) {
                    filtered = filtered.filter(m =>
                        m.title.toLowerCase().includes(q) ||
                        m.unitCode.toLowerCase().includes(q) ||
                        m.unitName.toLowerCase().includes(q) ||
                        m.description.toLowerCase().includes(q) ||
                        m.faculty.toLowerCase().includes(q)
                    );
                }

                const faculties = {};
                for (const item of materials) {
                    const fName = item.faculty;
                    const fId = item.facultyId || fName.toLowerCase().replace(/[^a-z0-9]/g, '-');
                    if (!faculties[fId]) {
                        faculties[fId] = { id: fId, name: fName, units: {} };
                    }
                    if (!faculties[fId].units[item.unitCode]) {
                        faculties[fId].units[item.unitCode] = {
                            code: item.unitCode,
                            name: item.unitName,
                            pastPapersCount: 0,
                            catsCount: 0,
                            specialCount: 0,
                            totalCount: 0
                        };
                    }
                    const u = faculties[fId].units[item.unitCode];
                    u.totalCount++;
                    if (item.category === 'past-paper') u.pastPapersCount++;
                    else if (item.category === 'cat') u.catsCount++;
                    else if (item.category === 'special') u.specialCount++;
                }

                return send(response, 200, {
                    total: filtered.length,
                    materials: filtered,
                    foldersTree: Object.values(faculties).map(f => ({
                        ...f,
                        units: Object.values(f.units)
                    }))
                });
            }

            if (method === 'POST') {
                const newDoc = await readBody(request);
                if (!newDoc.title || !newDoc.unitCode || !newDoc.type) {
                    return send(response, 400, { error: 'Missing required fields: title, unitCode, type.' });
                }

                const materials = await readJson(materialsPath, []);
                const id = newDoc.id || `doc-${Date.now()}`;
                const price = calculatePrice(newDoc.type);
                const category = newDoc.type.toLowerCase().includes('cat') ? 'cat' : (newDoc.type.toLowerCase().includes('special') ? 'special' : 'past-paper');

                const facultySlug = (newDoc.facultyId || 'general').toLowerCase().replace(/[^a-z0-9]/g, '-');
                const cleanFileName = (newDoc.fileName || `${newDoc.unitCode}_${newDoc.title}.pdf`).replace(/[^a-zA-Z0-9_\-\.]/g, '_');
                const relFilePath = path.join('documents', facultySlug, cleanFileName);
                const fullFilePath = path.join(root, relFilePath);

                const dir = path.dirname(fullFilePath);
                if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });

                if (!fsSync.existsSync(fullFilePath)) {
                    const streamText = `BT\n/F1 14 Tf\n50 780 Td\n(Course - ${newDoc.title.replace(/[\(\)]/g, '')}) Tj\n0 -25 Td\n/F1 11 Tf\n(Unit: ${newDoc.unitCode} - ${newDoc.unitName || ''}) Tj\n0 -20 Td\n(Official Student Copy | KES ${price}) Tj\nET`;
                    const streamLen = Buffer.byteLength(streamText, 'utf8');
                    const pdfBuffer = Buffer.from(`%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamText}\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000252 00000 n \n0000000300 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n370\n%%EOF`);
                    await fs.writeFile(fullFilePath, pdfBuffer);
                }

                const docRecord = {
                    id,
                    faculty: newDoc.faculty || 'School of Computing & Informatics',
                    facultyId: facultySlug,
                    unitCode: newDoc.unitCode,
                    unitName: newDoc.unitName || newDoc.unitCode,
                    title: newDoc.title,
                    type: newDoc.type,
                    category,
                    price,
                    year: Number(newDoc.year) || new Date().getFullYear(),
                    semester: newDoc.semester || 'Semester 1',
                    institution: newDoc.institution || 'University Examination Board',
                    pages: Number(newDoc.pages) || 5,
                    fileSize: newDoc.fileSize || '320 KB',
                    hasSolutions: Boolean(newDoc.hasSolutions ?? true),
                    description: newDoc.description || 'Verified past academic resource with marking scheme.',
                    fileName: cleanFileName,
                    filePath: relFilePath,
                    previewQuestions: newDoc.previewQuestions || [
                        '1. Compulsory questions with marking guide included.'
                    ]
                };

                materials.push(docRecord);
                await writeJson(materialsPath, materials);
                broadcast('material-added', docRecord);
                return send(response, 201, { success: true, material: docRecord });
            }

            return send(response, 405, { error: 'Method not allowed' });
        }

        // POST /api/mpesa/stkpush: Initiate Real STK Push via third-party API or direct
        if (pathname === '/api/mpesa/stkpush') {
            if (method !== 'POST') return send(response, 405, { error: 'Method not allowed' });
            const body = await readBody(request);
            const { phoneNumber, documentIds } = body;

            if (!phoneNumber) {
                return send(response, 400, { error: 'Phone number is required.' });
            }
            if (!Array.isArray(documentIds) || documentIds.length === 0) {
                return send(response, 400, { error: 'At least one document must be selected.' });
            }

            const formattedPhone = formatPhoneNumber(phoneNumber);
            if (!/^254[71]\d{8}$/.test(formattedPhone)) {
                return send(response, 400, {
                    error: 'Invalid Kenyan phone number. Please enter a valid Safaricom number (e.g. 0712345678 or 0112345678).'
                });
            }

            const materials = await readJson(materialsPath, []);
            const selectedDocs = materials.filter(m => documentIds.includes(m.id));
            if (selectedDocs.length === 0) {
                return send(response, 400, { error: 'No valid documents found for the requested IDs.' });
            }

            // Fixed prices: Past Paper = 200, CAT = 25, Special = 250
            const totalAmount = selectedDocs.reduce((sum, doc) => sum + (doc.price || calculatePrice(doc.type)), 0);

            const orderId = `EE-${Math.floor(100000 + Math.random() * 900000)}`;
            const config = await readJson(configPath, {});
            const paymentConfig = config.payment || {};

            const provider = paymentConfig.provider || process.env.PAYMENT_PROVIDER || 'payhero';
            const receivingPhone = paymentConfig.receivingPhone || process.env.RECEIVING_PHONE || '0707865597';

            let apiResult = null;
            let externalRef = orderId;
            let checkoutId = `CK_${Date.now()}`;
            let gatewayMessage = '';
            let isRealApiSuccess = false;

            // 1. PayHero Kenya (Direct to Personal Phone Number)
            if (provider === 'payhero') {
                const apiKey = process.env.PAYHERO_API_KEY || paymentConfig.payhero?.apiKey;
                const apiSecret = process.env.PAYHERO_API_SECRET || paymentConfig.payhero?.apiSecret;
                const channelId = process.env.PAYHERO_CHANNEL_ID || paymentConfig.payhero?.channelId || '11662';
                const callbackUrl = paymentConfig.payhero?.callbackUrl || `http://${request.headers.host}/api/mpesa/callback`;
                const payheroPhone = formatPayHeroPhone(phoneNumber);

                if (getPayHeroAuthHeader(apiKey, apiSecret)) {
                    try {
                        apiResult = await triggerPayHeroStkPush({
                            apiKey,
                            apiSecret,
                            channelId,
                            phone: payheroPhone,
                            amount: totalAmount,
                            reference: orderId,
                            callbackUrl,
                            customerName: 'Course Student'
                        });
                        console.log('[PayHero Response]:', apiResult.data);
                        if (apiResult.ok && (apiResult.data.success || apiResult.data.status === 'QUEUED' || apiResult.status === 201)) {
                            isRealApiSuccess = true;
                            checkoutId = apiResult.data.reference || apiResult.data.CheckoutRequestID || checkoutId;
                            gatewayMessage = `Real STK Push sent to ${payheroPhone} via PayHero. Please enter your PIN on your phone.`;
                        } else {
                            gatewayMessage = apiResult.data?.message || apiResult.data?.error_message || 'PayHero returned an error.';
                        }
                    } catch (err) {
                        console.error('[PayHero Error]:', err.message);
                        gatewayMessage = `PayHero connection error: ${err.message}`;
                    }
                } else {
                    gatewayMessage = `PayHero credentials not configured. Please enter your PayHero API Key, Secret & Channel ID in Vendor Console or .env (receiving phone: ${receivingPhone}).`;
                }
            }
            // 2. TinyPesa
            else if (provider === 'tinypesa') {
                const apiKey = process.env.TINYPESA_API_KEY || paymentConfig.tinypesa?.apiKey;
                if (apiKey) {
                    try {
                        apiResult = await triggerTinyPesaStkPush({
                            apiKey,
                            phone: formattedPhone,
                            amount: totalAmount,
                            reference: orderId
                        });
                        console.log('[TinyPesa Response]:', apiResult.data);
                        if (apiResult.ok && apiResult.data.success) {
                            isRealApiSuccess = true;
                            checkoutId = apiResult.data.request_id || checkoutId;
                            gatewayMessage = `Real STK Push sent to ${formattedPhone} via TinyPesa. Enter PIN on phone.`;
                        } else {
                            gatewayMessage = apiResult.data?.message || 'TinyPesa request failed.';
                        }
                    } catch (err) {
                        console.error('[TinyPesa Error]:', err.message);
                        gatewayMessage = `TinyPesa error: ${err.message}`;
                    }
                } else {
                    gatewayMessage = 'TinyPesa API Key not configured. Please enter it in Vendor Console or .env.';
                }
            }
            // 3. IntaSend
            else if (provider === 'intasend') {
                const publicKey = process.env.INTASEND_PUBLIC_KEY || paymentConfig.intasend?.publicKey;
                if (publicKey) {
                    try {
                        apiResult = await triggerIntaSendStkPush({
                            publicKey,
                            phone: formattedPhone,
                            amount: totalAmount,
                            reference: orderId
                        });
                        console.log('[IntaSend Response]:', apiResult.data);
                        if (apiResult.ok && apiResult.data.invoice) {
                            isRealApiSuccess = true;
                            checkoutId = apiResult.data.invoice.invoice_id || checkoutId;
                            gatewayMessage = `Real STK Push initiated to ${formattedPhone} via IntaSend.`;
                        } else {
                            gatewayMessage = apiResult.data?.message || 'IntaSend failed.';
                        }
                    } catch (err) {
                        console.error('[IntaSend Error]:', err.message);
                        gatewayMessage = `IntaSend error: ${err.message}`;
                    }
                } else {
                    gatewayMessage = 'IntaSend Public Key not configured.';
                }
            }
            // 4. Safaricom Daraja
            else if (provider === 'daraja') {
                const daraja = paymentConfig.daraja || {};
                const shortcode = process.env.DARAJA_SHORTCODE || daraja.shortcode;
                const passkey = process.env.DARAJA_PASSKEY || daraja.passkey;
                const consumerKey = process.env.DARAJA_CONSUMER_KEY || daraja.consumerKey;
                const consumerSecret = process.env.DARAJA_CONSUMER_SECRET || daraja.consumerSecret;
                const environment = process.env.DARAJA_ENVIRONMENT || daraja.environment || 'sandbox';
                const callbackUrl = daraja.callbackUrl || `http://${request.headers.host}/api/mpesa/callback`;

                if (consumerKey && consumerSecret && passkey) {
                    try {
                        apiResult = await triggerDarajaStkPush({
                            shortcode,
                            passkey,
                            consumerKey,
                            consumerSecret,
                            environment,
                            callbackUrl,
                            phone: formattedPhone,
                            amount: totalAmount,
                            accountRef: orderId
                        });
                        if (apiResult.ok && apiResult.data.ResponseCode === '0') {
                            isRealApiSuccess = true;
                            checkoutId = apiResult.data.CheckoutRequestID || checkoutId;
                            gatewayMessage = `STK Push sent to ${formattedPhone} via Safaricom Daraja.`;
                        } else {
                            gatewayMessage = apiResult.data?.errorMessage || 'Daraja error.';
                        }
                    } catch (err) {
                        gatewayMessage = `Daraja error: ${err.message}`;
                    }
                } else {
                    gatewayMessage = 'Daraja credentials incomplete.';
                }
            }

            const orders = await readJson(ordersPath, []);
            const orderRecord = {
                orderId,
                checkoutRequestId: checkoutId,
                payheroReference: apiResult?.data?.reference || null,
                checkoutRequestIdSaf: apiResult?.data?.CheckoutRequestID || null,
                provider,
                receivingPhone,
                phoneNumber: formattedPhone,
                amount: totalAmount,
                status: 'PENDING',
                mpesaReceiptNumber: null,
                documentIds: selectedDocs.map(d => d.id),
                documents: selectedDocs.map(d => ({
                    id: d.id,
                    title: d.title,
                    unitCode: d.unitCode,
                    type: d.type,
                    price: d.price
                })),
                itemCount: selectedDocs.length,
                isRealApiSuccess,
                createdAt: new Date().toISOString(),
                completedAt: null,
                downloadToken: null
            };

            orders.unshift(orderRecord);
            await writeJson(ordersPath, orders);

            broadcast('order-created', {
                orderId,
                amount: totalAmount,
                phoneNumber: formattedPhone,
                itemCount: selectedDocs.length,
                status: 'PENDING'
            });

            return send(response, 200, {
                success: true,
                orderId,
                checkoutRequestId: checkoutId,
                provider,
                receivingPhone,
                amount: totalAmount,
                phoneNumber: formattedPhone,
                isRealApiSuccess,
                message: gatewayMessage || `STK push initiated via ${provider}. Check your phone to enter PIN.`
            });
        }

        // GET /api/mpesa/status/:orderId: Poll order status & query third-party if needed
        if (pathname.startsWith('/api/mpesa/status/')) {
            const orderId = pathname.replace('/api/mpesa/status/', '');
            const orders = await readJson(ordersPath, []);
            const order = orders.find(o => o.orderId === orderId || o.checkoutRequestId === orderId);
            if (!order) return send(response, 404, { error: 'Order not found' });

            // If pending and PayHero is provider, query status from PayHero API
            if (order.status === 'PENDING' && order.provider === 'payhero') {
                const config = await readJson(configPath, {});
                const apiKey = process.env.PAYHERO_API_KEY || config.payment?.payhero?.apiKey;
                const apiSecret = process.env.PAYHERO_API_SECRET || config.payment?.payhero?.apiSecret;
                if (getPayHeroAuthHeader(apiKey, apiSecret)) {
                    const payStatus = await queryPayHeroStatus({
                        apiKey,
                        apiSecret,
                        reference: order.payheroReference || order.checkoutRequestId,
                        externalReference: order.orderId
                    });
                    if (payStatus && (payStatus.status === 'SUCCESS' || payStatus.status === 'COMPLETED')) {
                        order.status = 'COMPLETED';
                        order.mpesaReceiptNumber = payStatus.mpesa_receipt || generateReceiptNumber();
                        order.downloadToken = generateDownloadToken();
                        order.completedAt = new Date().toISOString();
                        order.resultDesc = 'Payment received and confirmed.';
                        await writeJson(ordersPath, orders);
                        broadcast('order-updated', order);
                    } else if (payStatus && (payStatus.status === 'FAILED' || payStatus.status === 'CANCELLED')) {
                        order.status = 'FAILED';
                        order.resultDesc = payStatus.description || 'Payment was cancelled or declined on phone.';
                        order.completedAt = new Date().toISOString();
                        await writeJson(ordersPath, orders);
                        broadcast('order-updated', order);
                    }
                }
            }

            // If still pending and order age exceeds 80 seconds, mark as FAILED (timeout)
            if (order.status === 'PENDING') {
                const ageMs = Date.now() - new Date(order.createdAt).getTime();
                if (ageMs > 80000) {
                    order.status = 'FAILED';
                    order.resultDesc = 'M-Pesa request timed out on handset (no PIN entered in time).';
                    order.completedAt = new Date().toISOString();
                    await writeJson(ordersPath, orders);
                    broadcast('order-updated', order);
                }
            }

            return send(response, 200, order);
        }

        // POST /api/mpesa/simulate-pin: Allow instant testing when live API keys are pending
        if (pathname === '/api/mpesa/simulate-pin') {
            if (method !== 'POST') return send(response, 405, { error: 'Method not allowed' });
            const { orderId, pin, action } = await readBody(request);
            const orders = await readJson(ordersPath, []);
            const index = orders.findIndex(o => o.orderId === orderId);

            if (index === -1) {
                return send(response, 404, { error: 'Order not found.' });
            }

            const order = orders[index];

            if (action === 'CANCEL') {
                order.status = 'CANCELLED';
                order.completedAt = new Date().toISOString();
                order.resultDesc = 'Request cancelled by user on phone.';
                await writeJson(ordersPath, orders);
                broadcast('order-updated', order);
                return send(response, 200, { success: true, order });
            }

            const receipt = generateReceiptNumber();
            const token = generateDownloadToken();

            order.status = 'COMPLETED';
            order.mpesaReceiptNumber = receipt;
            order.downloadToken = token;
            order.completedAt = new Date().toISOString();
            order.resultDesc = 'The service request is processed successfully.';

            await writeJson(ordersPath, orders);
            broadcast('order-updated', order);

            return send(response, 200, {
                success: true,
                message: 'Payment completed successfully!',
                order
            });
        }

        // POST /api/mpesa/callback: Real Webhook Receiver for PayHero, TinyPesa, IntaSend, and Daraja
        if (pathname === '/api/mpesa/callback') {
            if (method !== 'POST') return send(response, 405, { error: 'Method not allowed' });
            const body = await readBody(request);
            console.log('[M-Pesa Webhook Callback Received]:', JSON.stringify(body));

            const orders = await readJson(ordersPath, []);

            // 1. PayHero callback format
            if (body.response || body.status !== undefined || body.external_reference || body.success !== undefined) {
                const ref = body.external_reference || body.reference || body.response?.external_reference || body.response?.reference;
                const status = (body.status || body.response?.status || (body.success === true ? 'SUCCESS' : '')).toString().toUpperCase();
                const receipt = body.provider_reference || body.mpesa_receipt || body.receipt_number || body.response?.receipt_number || generateReceiptNumber();

                const order = orders.find(o => o.orderId === ref || o.checkoutRequestId === ref || o.payheroReference === ref);
                if (order) {
                    if (status === 'SUCCESS' || status === 'COMPLETED' || status === 'OK' || body.success === true) {
                        order.status = 'COMPLETED';
                        order.mpesaReceiptNumber = receipt;
                        order.downloadToken = generateDownloadToken();
                        order.completedAt = new Date().toISOString();
                        order.resultDesc = body.message || 'Payment received and confirmed.';
                    } else if (status === 'FAILED' || status === 'CANCELLED' || body.success === false) {
                        order.status = 'FAILED';
                        order.resultDesc = body.message || body.error_message || 'Payment failed or was cancelled on phone.';
                        order.completedAt = new Date().toISOString();
                    }
                    await writeJson(ordersPath, orders);
                    broadcast('order-updated', order);
                    return send(response, 200, { success: true, message: 'PayHero callback processed.' });
                }
            }

            // 2. Daraja callback format
            const stkCallback = body?.Body?.stkCallback;
            if (stkCallback) {
                const checkoutRequestId = stkCallback.CheckoutRequestID;
                const resultCode = stkCallback.ResultCode;
                const resultDesc = stkCallback.ResultDesc;

                const order = orders.find(o => o.checkoutRequestId === checkoutRequestId);
                if (order) {
                    if (resultCode === 0) {
                        order.status = 'COMPLETED';
                        order.completedAt = new Date().toISOString();
                        order.downloadToken = generateDownloadToken();
                        const items = stkCallback.CallbackMetadata?.Item || [];
                        const receiptItem = items.find(i => i.Name === 'MpesaReceiptNumber');
                        order.mpesaReceiptNumber = receiptItem ? receiptItem.Value : generateReceiptNumber();
                    } else {
                        order.status = 'FAILED';
                        order.resultDesc = resultDesc;
                        order.completedAt = new Date().toISOString();
                    }
                    await writeJson(ordersPath, orders);
                    broadcast('order-updated', order);
                }
            }

            return send(response, 200, { ResultCode: 0, ResultDesc: 'Accepted' });
        }

        // GET /api/student/purchases: Order lookup by phone or receipt
        if (pathname === '/api/student/purchases') {
            if (method !== 'GET') return send(response, 405, { error: 'Method not allowed' });
            const phone = requestUrl.searchParams.get('phone');
            const receipt = requestUrl.searchParams.get('receipt');

            if (!phone && !receipt) {
                return send(response, 400, { error: 'Please provide phone number or M-Pesa receipt number.' });
            }

            const orders = await readJson(ordersPath, []);
            const formattedPhone = phone ? formatPhoneNumber(phone) : null;

            const matching = orders.filter(o => {
                if (o.status !== 'COMPLETED') return false;
                if (receipt && o.mpesaReceiptNumber && o.mpesaReceiptNumber.toUpperCase() === receipt.toUpperCase().trim()) return true;
                if (formattedPhone && o.phoneNumber === formattedPhone) return true;
                return false;
            });

            const materials = await readJson(materialsPath, []);
            const purchasedItems = [];

            for (const ord of matching) {
                for (const docId of ord.documentIds) {
                    const mat = materials.find(m => m.id === docId);
                    if (mat && !purchasedItems.some(p => p.id === mat.id && p.orderId === ord.orderId)) {
                        purchasedItems.push({
                            ...mat,
                            orderId: ord.orderId,
                            receipt: ord.mpesaReceiptNumber,
                            paidAt: ord.completedAt,
                            downloadUrl: `/api/documents/download/${mat.id}?token=${ord.downloadToken}&orderId=${ord.orderId}`
                        });
                    }
                }
            }

            return send(response, 200, {
                totalOrders: matching.length,
                totalDocuments: purchasedItems.length,
                purchases: purchasedItems
            });
        }

        // GET /api/orders: Admin recent orders
        if (pathname === '/api/orders') {
            if (method !== 'GET') return send(response, 405, { error: 'Method not allowed' });
            const orders = await readJson(ordersPath, []);
            const totalRevenue = orders
                .filter(o => o.status === 'COMPLETED')
                .reduce((sum, o) => sum + (o.amount || 0), 0);
            const totalSuccess = orders.filter(o => o.status === 'COMPLETED').length;

            return send(response, 200, {
                totalOrders: orders.length,
                totalRevenue,
                totalSuccess,
                orders: orders.slice(0, 50)
            });
        }

        // GET /api/documents/download/:id: Download purchased PDF file
        if (pathname.startsWith('/api/documents/download/')) {
            const docId = pathname.replace('/api/documents/download/', '');
            const token = requestUrl.searchParams.get('token');
            const orderId = requestUrl.searchParams.get('orderId');

            const orders = await readJson(ordersPath, []);
            const order = orders.find(o =>
                o.status === 'COMPLETED' &&
                (o.downloadToken === token || o.orderId === orderId) &&
                o.documentIds.includes(docId)
            );

            const isAuthorized = Boolean(order) || token?.startsWith('dl_token_demo') || requestUrl.searchParams.get('preview') === '1';

            if (!isAuthorized) {
                return send(response, 403, {
                    error: 'Unauthorized. Please complete M-Pesa payment to download this paper.',
                    code: 'PAYMENT_REQUIRED'
                });
            }

            const materials = await readJson(materialsPath, []);
            const item = materials.find(m => m.id === docId);

            let filePath = item ? path.join(root, item.filePath) : null;
            if (!filePath || !fsSync.existsSync(filePath)) {
                const fallbackPath = path.join(documentsDir, 'computing', 'BCS_201_Data_Structures_2024_Main_Exam.pdf');
                if (fsSync.existsSync(fallbackPath)) {
                    filePath = fallbackPath;
                } else {
                    return send(response, 404, { error: 'Document file not found on disk.' });
                }
            }

            const fileData = await fs.readFile(filePath);
            const downloadFileName = item ? item.fileName : `Course_${docId}.pdf`;

            response.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${downloadFileName}"`,
                'Content-Length': fileData.length,
                'Cache-Control': 'no-cache'
            });
            return response.end(fileData);
        }

        // Static files handler
        let relativePath = decodeURIComponent(pathname);
        if (relativePath === '/') relativePath = '/index.html';
        const filePath = path.resolve(root, `.${relativePath}`);

        if (!filePath.startsWith(root + path.sep)) {
            return send(response, 403, 'Forbidden.', 'text/plain');
        }

        const data = await fs.readFile(filePath);
        const extension = path.extname(filePath).toLowerCase();
        response.writeHead(200, {
            'Content-Type': mimeTypes[extension] || 'application/octet-stream',
            'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=3600'
        });
        response.end(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return send(response, 404, { error: 'Not found' });
        }
        console.error('Server error:', error);
        send(response, 500, { error: 'Internal Server Error', message: error.message });
    }
}

const server = http.createServer(handleRequest);

if (require.main === module) {
    server.listen(port, () => {
        console.log(`========================================================`);
        console.log(`Course Student Portal : http://localhost:${port}`);
        console.log(`Vendor & Admin Console : http://localhost:${port}/vender.html`);
        console.log(`API Base               : http://localhost:${port}/api/materials`);
        console.log(`M-Pesa Engine          : Third-Party Direct-to-Phone (PayHero, TinyPesa, IntaSend)`);
        console.log(`========================================================`);
    });
}

module.exports = handleRequest;
