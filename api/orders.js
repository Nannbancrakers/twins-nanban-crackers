/**
 * /api/orders
 *
 * GET    -> fetch latest orders.json from the GitHub repository (auth required)
 * POST   -> create a new customer order (public, used by the cart checkout)
 * PATCH  -> update the status of an order (auth required)
 * DELETE -> remove an order (auth required)
 *
 * Orders are stored in assets/orders.json and written through the GitHub
 * Contents API using the file's current SHA to avoid clobbering concurrent
 * writes. A conflict returns an error so the client can retry with fresh data.
 */

const { getAuthUser } = require('./_auth');

const REPO_FILE = 'assets/orders.json';

const STATUSES = ['pending', 'confirmed', 'delivered'];

const ORDER_ID_PREFIX = 'TNC';

/** Order IDs look like TNC-0001. Extract the numeric part (1) from an id. */
function orderIdNum(id) {
    const m = String(id).match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
}

/** Generate the next order id (TNC-0001, TNC-0002, ...). */
function nextOrderId(orders) {
    const maxNum = orders.reduce((m, o) => Math.max(m, orderIdNum(o.id)), 0);
    return ORDER_ID_PREFIX + '-' + String(maxNum + 1).padStart(4, '0');
}

function env() {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;
    return { owner, repo, branch, token };
}

function configError() {
    return 'GitHub environment variables (GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, GITHUB_TOKEN) are not configured';
}

/**
 * Decode the raw bytes of orders.json into an object.
 *
 * An empty (0 byte) file is the legitimate "no orders yet" state, so it maps to
 * an empty list instead of throwing. Anything non-empty but unparseable is a
 * real corruption problem: we surface it instead of silently pretending there
 * are no orders, because the next write would overwrite the good data.
 */
function decodeOrdersFile(raw) {
    if (raw == null || String(raw).trim() === '') {
        return { orders: [] };
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new Error(`${REPO_FILE} is not valid JSON (${e.message}). Repair the file in GitHub before continuing.`);
    }

    // Tolerate a bare array (legacy hand-written shape) instead of throwing, so
    // a real order list is never mistaken for "no orders" and overwritten.
    if (Array.isArray(parsed)) return { orders: parsed };
    if (!parsed || typeof parsed !== 'object') {
        throw new Error(`${REPO_FILE} must contain a JSON object with an "orders" array.`);
    }
    return parsed;
}

/** Get the current file content + SHA from GitHub. */
async function getGitHubFile() {
    const { owner, repo, branch, token } = env();
    if (!owner || !repo || !token) throw new Error(configError());

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${REPO_FILE}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'twins-nanban-admin'
        }
    });

    // The file has never been created yet. GitHub requires no `sha` when
    // creating a new file, which putGitHubFile() handles via sha === null.
    if (res.status === 404) {
        return { sha: null, content: { orders: [] } };
    }

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub read failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const raw = data && typeof data.content === 'string'
        ? Buffer.from(data.content, 'base64').toString('utf8')
        : '';

    return {
        sha: data ? data.sha || null : null,
        content: decodeOrdersFile(raw)
    };
}

/** Write content back to GitHub using the provided SHA (atomic replace + commit). */
async function putGitHubFile(sha, content, message) {
    const { owner, repo, branch, token } = env();
    if (!owner || !repo || !token) throw new Error(configError());

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${REPO_FILE}`;
    const payload = {
        message,
        content: Buffer.from(JSON.stringify(content)).toString('base64'),
        branch
    };
    // Omitting `sha` is what tells GitHub to create a brand new file.
    if (sha) payload.sha = sha;

    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'twins-nanban-admin',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (res.status === 409) {
        throw new Error('CONFLICT: Another update just changed orders.json. Please retry.');
    }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub write failed (${res.status}): ${text}`);
    }
    return res.json();
}

/** Retrieve orders array from the GitHub repo (single source of truth). */
async function readOrders() {
    const { content } = await getGitHubFile();
    return Array.isArray(content.orders) ? content.orders : [];
}

function normalizePrice(v) {
    const n = Math.round((Number(v) + Number.EPSILON) * 100) / 100;
    return isNaN(n) ? 0 : n;
}

/** Validate and normalize an incoming order submission. */
function validateOrder(body) {
    const customerName = String(body.customerName || '').trim();
    const mobile = String(body.mobile || '').trim();

    if (!customerName) throw new Error('Customer name is required');
    if (!/^[6-9]\d{9}$/.test(mobile)) throw new Error('Valid 10-digit mobile number is required');

    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) throw new Error('Order must contain at least one item');

    const normalizedItems = items.map(it => {
        const name = String(it.name || '').trim();
        const content = String(it.content || '').trim() || null;
        const qty = Number(it.qty);
        const finalRate = normalizePrice(it.finalRate);
        const rate = normalizePrice(it.rate);
        if (!name) throw new Error('Each item needs a name');
        if (!(qty > 0)) throw new Error('Item quantity must be positive');
        if (finalRate < 0) throw new Error('Item price cannot be negative');
        return {
            name,
            content,
            qty,
            rate: rate > 0 ? rate : finalRate,
            finalRate,
            lineTotal: normalizePrice(finalRate * qty)
        };
    });

    const total = normalizePrice(normalizedItems.reduce((s, it) => s + it.lineTotal, 0));
    const subtotal = normalizePrice(normalizedItems.reduce((s, it) => s + it.rate * it.qty, 0));
    const savings = normalizePrice(Math.max(0, subtotal - total));

    return {
        customerName,
        mobile,
        items: normalizedItems,
        total,
        savings,
        status: 'pending',
        createdAt: new Date().toISOString()
    };
}

/** Handle /api/orders */
module.exports = async (req, res) => {
    const method = req.method;

    try {
        if (method === 'POST') {
            // ---- Public: customers submit orders from the checkout ----
            const { sha, content } = await getGitHubFile();
            const orders = Array.isArray(content.orders) ? content.orders : [];

            let body;
            try {
                body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}');
            } catch (e) {
                body = {};
            }

            const order = validateOrder(body);
            const record = { id: nextOrderId(orders), ...order };

            await putGitHubFile(sha, { orders: [...orders, record] }, `New order ${record.id} via /api/orders`);
            res.status(201).json({ ok: true, order: record });
            return;
        }

        // ---- Everything below requires authentication ----
        const user = getAuthUser(req);
        if (!user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const { sha, content } = await getGitHubFile();
        const orders = Array.isArray(content.orders) ? content.orders : [];

        if (method === 'GET') {
            res.status(200).json({ orders });
            return;
        }

        if (method === 'PATCH') {
            let body;
            try {
                body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}');
            } catch (e) {
                body = {};
            }

            const id = String(body.id || '').trim();
            if (!id) {
                res.status(400).json({ error: 'Missing order id' });
                return;
            }
            const status = String(body.status || '').trim();
            if (!STATUSES.includes(status)) {
                res.status(400).json({ error: `Status must be one of: ${STATUSES.join(', ')}` });
                return;
            }

            const idx = orders.findIndex(o => String(o.id) === id);
            if (idx === -1) {
                res.status(404).json({ error: 'Order not found' });
                return;
            }
            const prev = orders[idx].status;
            orders[idx] = { ...orders[idx], status };
            await putGitHubFile(sha, { orders }, `Order ${id} status ${prev} -> ${status} (admin)`);
            res.status(200).json({ ok: true, orders });
            return;
        }

        if (method === 'DELETE') {
            const id = String(req.query.id || '').trim();
            if (!id) {
                res.status(400).json({ error: 'Missing order id' });
                return;
            }
            const idx = orders.findIndex(o => String(o.id) === id);
            if (idx === -1) {
                res.status(404).json({ error: 'Order not found' });
                return;
            }
            orders.splice(idx, 1);
            await putGitHubFile(sha, { orders }, `Remove order ${id} (admin)`);
            res.status(200).json({ ok: true, orders });
            return;
        }

        res.setHeader('Allow', 'GET, POST, PATCH, DELETE');
        res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        // Return a clean 409 for SHA conflicts so the client can react.
        if (/CONFLICT/.test(err.message)) {
            res.status(409).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: err.message });
    }
};