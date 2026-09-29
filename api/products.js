/**
 * /api/products
 *
 * GET    -> fetch latest products.json from the GitHub repository
 * POST   -> add or update a product (auth required) and commit to GitHub
 * DELETE -> remove a product (auth required) and commit to GitHub
 *
 * Writes go through the GitHub Contents API using the repository file's
 * current SHA to avoid clobbering concurrent changes. A conflict returns
 * an error so the client can retry with fresh data.
 */

const { getAuthUser } = require('./_auth');

const REPO_FILE = 'assets/products.json';

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

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub read failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    return {
        sha: data.sha,
        content: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'))
    };
}

/** Write content back to GitHub using the provided SHA (atomic replace + commit). */
async function putGitHubFile(sha, content, message) {
    const { owner, repo, branch, token } = env();
    if (!owner || !repo || !token) throw new Error(configError());

    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${REPO_FILE}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'twins-nanban-admin',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            content: Buffer.from(JSON.stringify(content)).toString('base64'),
            sha,
            branch
        })
    });

    if (res.status === 409) {
        throw new Error('CONFLICT: Another update just changed products.json. Please retry.');
    }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub write failed (${res.status}): ${text}`);
    }
    return res.json();
}

/** Retrieve products array from the GitHub repo (single source of truth). */
async function readProducts() {
    const { content } = await getGitHubFile();
    if (!content || !Array.isArray(content.products)) {
        throw new Error('products.json must have a "products" array');
    }
    return content.products;
}

function normalizePrice(v) {
    const n = Math.round((Number(v) + Number.EPSILON) * 100) / 100;
    return isNaN(n) ? 0 : n;
}

function validateProduct(body) {
    const name = String(body.name || '').trim();
    const category = String(body.category || '').trim();
    const content = String(body.content || '').trim() || '1 Pkt';
    const rate = Number(body.rate);
    const hasDirectFinal = body.finalRate !== undefined && body.finalRate !== null && body.finalRate !== '' && !isNaN(Number(body.finalRate));
    const hasPct = body.discountPct !== undefined && body.discountPct !== '' && !isNaN(Number(body.discountPct));
    const image = String(body.image || '').trim() || null;

    if (!name) throw new Error('Product name is required');
    if (!category) throw new Error('Category is required');
    if (isNaN(rate) || rate < 0) throw new Error('Invalid price');

    let factor;
    let finalRate;

    if (hasDirectFinal && !hasPct) {
        // Direct finalRate provided; derive the discount factor to match the
        // existing data model (stored discount = rate x factor = finalRate).
        finalRate = normalizePrice(Number(body.finalRate));
        factor = rate > 0 ? normalizePrice(finalRate / rate) : 0;
    } else {
        // Percent-based (recommended): discount input is a percentage, e.g.
        // 90 = 90% off. factor = (100 - pct)/100, finalRate = rate * factor.
        const pct = Number(body.discountPct);
        if (isNaN(pct) || pct < 0 || pct > 100) {
            throw new Error('Discount must be a percentage between 0 and 100');
        }
        factor = normalizePrice((100 - pct) / 100);
        finalRate = normalizePrice(rate * factor);
    }

    return { name, category, content, rate, discount: factor, finalRate, image };
}

/** Handle /api/products */
module.exports = async (req, res) => {
    const method = req.method;

    try {
        if (method === 'GET') {
            const products = await readProducts();
            res.status(200).json({ products });
            return;
        }

        if (method !== 'POST' && method !== 'DELETE') {
            res.setHeader('Allow', 'GET, POST, DELETE');
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        // ---- Writes require authentication ----
        const user = getAuthUser(req);
        if (!user) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        // Fetch LATEST from GitHub before modifying (avoid stale writes).
        const { sha, content } = await getGitHubFile();
        const products = Array.isArray(content.products) ? content.products : [];

        if (method === 'POST') {
            let body;
            try {
                body = typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(req.body || '{}');
            } catch (e) {
                body = {};
            }
            const product = validateProduct(body);

            let targetId = body.id;
            let resultProducts;

            if (targetId !== undefined && targetId !== null && targetId !== '') {
                // Update existing
                const id = Number(targetId);
                const idx = products.findIndex(p => Number(p.id) === id);
                if (idx === -1) {
                    res.status(404).json({ error: 'Product not found' });
                    return;
                }
                products[idx] = { id, ...product, id };
                resultProducts = products;
            } else {
                // Add new
                const dup = products.find(p => String(p.name).toLowerCase() === product.name.toLowerCase());
                if (dup) {
                    res.status(409).json({ error: `A product named "${product.name}" already exists` });
                    return;
                }
                const newId = products.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0) + 1;
                products.push({ ...product, id: newId });
                resultProducts = products;
            }

            await putGitHubFile(sha, { products: resultProducts }, `Update products.json (admin) via /api/products`);
            res.status(200).json({ ok: true, products: resultProducts });
            return;
        }

        if (method === 'DELETE') {
            const id = Number(req.query.id);
            if (!id) {
                res.status(400).json({ error: 'Missing product id' });
                return;
            }
            const idx = products.findIndex(p => Number(p.id) === id);
            if (idx === -1) {
                res.status(404).json({ error: 'Product not found' });
                return;
            }
            products.splice(idx, 1);
            await putGitHubFile(sha, { products }, `Remove product id ${id} (admin) via /api/products`);
            res.status(200).json({ ok: true, products });
            return;
        }
    } catch (err) {
        // Return a clean 409 for SHA conflicts so the client can react.
        if (/CONFLICT/.test(err.message)) {
            res.status(409).json({ error: err.message });
            return;
        }
        res.status(500).json({ error: err.message });
    }
};
