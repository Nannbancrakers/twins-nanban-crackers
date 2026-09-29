// ====================================
// DOM Elements
// ====================================

const menuToggle = document.getElementById('menu-toggle');
const navMenu = document.querySelector('.nav-menu');
const searchBtn = document.getElementById('search-btn');
const searchBar = document.getElementById('search-bar');
const cartBtn = document.getElementById('cart-btn');
const headerContainer = document.getElementById('header-container');
const footerContainer = document.getElementById('footer-container');

// Cart storage
let cart = JSON.parse(localStorage.getItem('cart')) || [];

// Clean up cart items - ensure they have all required fields
cart = cart.map(item => ({
    name: item.name || '',
    category: item.category || 'Others',
    content: item.content || '',
    rate: item.rate || 0,
    discount: item.discount || 0,
    finalRate: item.finalRate || item.price || 0,
    quantity: item.quantity || 0
})).filter(item => item.quantity > 0);

// Save cleaned cart back to localStorage
if (cart.length > 0) {
    localStorage.setItem('cart', JSON.stringify(cart));
}

// Products data cache (localStorage key)
const PRODUCTS_CACHE_KEY = 'twins.products.v4';

// ====================================
// Load Components
// ====================================

/**
 * Load header component
 */
async function loadHeader() {
    try {
        const response = await fetch('header.html?v=2');
        const html = await response.text();
        headerContainer.innerHTML = html;

        // Highlight active nav link based on current page
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = headerContainer.querySelectorAll('.nav-menu a');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage || (currentPage === 'index.html' && href === 'index.html')) {
                link.classList.add('active');
            }
        });

        // Re-attach event listeners after loading
        const newSearchBar = document.getElementById('search-bar');

        if (newSearchBar) {
            setupSearch(newSearchBar);
        }

        updateCartCount();
    } catch (error) {
        console.error('Error loading header:', error);
    }
}

/**
 * Load footer component
 */
async function loadFooter() {
    try {
        const response = await fetch('footer.html?v=2');
        const html = await response.text();
        footerContainer.innerHTML = html;
    } catch (error) {
        console.error('Error loading footer:', error);
    }
}

// ====================================
// Menu & Navigation
// ====================================

/**
 * Toggle mobile menu
 */
function toggleMenu() {
    const navMenu = document.querySelector('.nav-menu');
    const menuToggle = document.getElementById('menu-toggle');
    if (navMenu) {
        navMenu.classList.toggle('active');
    }
    if (menuToggle) {
        menuToggle.classList.toggle('active');
    }
}

/**
 * Toggle search bar
 */
function toggleSearch() {
    const searchBar = document.getElementById('search-bar');
    if (searchBar) {
        searchBar.classList.toggle('active');
    }
}

/**
 * Setup search functionality
 */
function setupSearch(searchBar) {
    const searchInput = searchBar.querySelector('#search-input');
    const searchButton = searchBar.querySelector('#search-submit');

    const runSearch = () => {
        const query = searchInput.value.trim();
        if (query) {
            window.location.href = 'products.html?search=' + encodeURIComponent(query);
        }
    };

    if (searchButton) {
        searchButton.addEventListener('click', (e) => {
            e.preventDefault();
            runSearch();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                runSearch();
            }
        });
    }
}

/**
 * Setup catalog search with clear button
 */
function setupCatalogSearch() {
    const searchInput = document.getElementById('catalog-search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    
    if (!searchInput) return;

    // Toggle clear button visibility
    const updateClearButton = () => {
        if (clearBtn) {
            clearBtn.style.display = searchInput.value.trim() ? 'flex' : 'none';
        }
    };

    // Show/hide clear button on input
    searchInput.addEventListener('input', () => {
        updateClearButton();
        renderProducts();
    });

    // Clear button functionality
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.preventDefault();
            searchInput.value = '';
            updateClearButton();
            catalogSearchQuery = '';
            renderProducts();
        });
    }

    // Initial state
    updateClearButton();
}

// ====================================
// Shopping Cart
// ====================================

/**
 * Update cart count display
 */
function updateCartCount() {
    // Always read the latest cart from storage so every counter stays in sync
    cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalQty = cart.reduce((total, item) => total + (item.quantity || 0), 0);

    // Apply the same count to an element, hiding it when the cart is empty
    const setCount = (el, displayMode) => {
        if (!el) return;
        el.textContent = totalQty;
        el.style.display = totalQty > 0 ? displayMode : 'none';
    };

    // Header cart badge
    setCount(document.getElementById('cart-count'), 'inline-flex');

    // Bottom cart bar (products page)
    const bottomCount = document.getElementById('cart-bottom-count');
    const bottomBar = document.getElementById('cart-bottom-bar');
    if (bottomCount && bottomBar) {
        setCount(bottomCount, 'flex');
        bottomBar.style.display = totalQty > 0 ? 'flex' : 'none';
    }

    // Header loads asynchronously on every page - keep polling until it appears
    if (!document.getElementById('cart-count')) {
        let attempts = 0;
        const interval = setInterval(() => {
            const el = document.getElementById('cart-count');
            const done = el || attempts >= 20;
            if (el) setCount(el, 'inline-flex');
            if (done) clearInterval(interval);
            attempts++;
        }, 100);
    }
}

/**
 * Build a cart item from a product
 */
function buildCartItem(product, quantity) {
    return {
        name: product.name,
        category: product.category || '',
        content: product.content || '',
        rate: product.rate || product.finalRate || 0,
        discount: product.discount || 0,
        finalRate: product.finalRate || product.price || product.rate || 0,
        quantity: quantity
    };
}

/**
 * Add item to cart
 */
function addToCart(product, quantity = 1) {
    const productName = typeof product === 'string' ? product : product.name;
    const existingItem = cart.find(item => item.name === productName);

    if (existingItem) {
        existingItem.quantity += quantity;
        // Update all product fields if a full product object is passed
        if (typeof product !== 'string') {
            existingItem.category = product.category || existingItem.category;
            existingItem.content = product.content || existingItem.content;
            existingItem.rate = product.rate || existingItem.rate;
            existingItem.discount = product.discount || existingItem.discount;
            existingItem.finalRate = product.finalRate || existingItem.finalRate;
        }
    } else {
        cart.push(typeof product === 'string'
            ? { name: productName, category: '', content: '', rate: 0, discount: 0, finalRate: 0, quantity: quantity }
            : buildCartItem(product, quantity));
    }

    // Save to localStorage
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();

    // Show notification
    showNotification(`${productName} added to cart!`);
}

/**
 * Set exact quantity of an item in the cart
 */
function setCartQuantity(product, quantity) {
    const productName = typeof product === 'string' ? product : product.name;

    if (quantity <= 0) {
        cart = cart.filter(item => item.name !== productName);
    } else {
        const existingItem = cart.find(item => item.name === productName);
        if (existingItem) {
            existingItem.quantity = quantity;
            // Update all product fields if a full product object is passed
            if (typeof product !== 'string') {
                existingItem.category = product.category || existingItem.category;
                existingItem.content = product.content || existingItem.content;
                existingItem.rate = product.rate || existingItem.rate;
                existingItem.discount = product.discount || existingItem.discount;
                existingItem.finalRate = product.finalRate || existingItem.finalRate;
            }
        } else {
            cart.push(typeof product === 'string'
                ? { name: productName, category: '', content: '', rate: 0, discount: 0, finalRate: 0, quantity: quantity }
                : buildCartItem(product, quantity));
        }
    }

    // Save to localStorage
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
}

/**
 * Show notification
 */
function showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #4CAF50;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 4px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

/**
 * Handle cart button click - navigate to cart page
 */
function handleCartClick() {
    window.location.href = 'cart.html';
}

// ====================================
// Product Interactions
// ====================================

/**
 * Setup product card interactions
 */
function setupProductCards() {
    const addToCartButtons = document.querySelectorAll('.btn-small');
    
    addToCartButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const card = button.closest('.product-card');
            const productName = card.querySelector('h3').textContent;
            const priceText = card.querySelector('.price').textContent;
            const price = parseFloat(priceText.replace('$', ''));

            addToCart({ name: productName, finalRate: price });
        });
    });
}

// ====================================
// Animations & Effects
// ====================================

/**
 * Add scroll animation for elements
 */
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe product cards
    document.querySelectorAll('.product-card').forEach(card => {
        observer.observe(card);
    });

    // Observe category tiles
    document.querySelectorAll('#categories-grid .category-tile').forEach(tile => {
        observer.observe(tile);
    });

    // Observe sections
    document.querySelectorAll('.categories, .features, .featured-products, .about, .contact-grid').forEach(section => {
        observer.observe(section);
    });
}

/**
 * Add CSS animations to document
 */
function addAnimations() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

// ====================================
// Close menu on link click
// ====================================

/**
 * Close mobile menu when a link is clicked
 */
function setupMenuLinkListeners() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const navMenu = document.querySelector('.nav-menu');
            const menuToggle = document.getElementById('menu-toggle');
            if (navMenu) {
                navMenu.classList.remove('active');
            }
            if (menuToggle) {
                menuToggle.classList.remove('active');
            }
        });
    });
}

// ====================================
// Product Catalog (Products Page)
// ====================================

let allProducts = [];
let activeCategories = [];
let catalogSearchQuery = '';
let catalogSort = 'relevance';

/**
 * Format price in Indian Rupees
 */
function formatPrice(value) {
    return '₹' + Number(value).toLocaleString('en-IN');
}

/**
 * Fetch products from JSON and cache them for fast repeat loads
 */
async function fetchAndCacheProducts() {
    try {
        const response = await fetch('assets/products.json');
        const data = await response.json();
        if (data.products && data.products.length) {
            allProducts = data.products;
            console.log('[products] fetched from network:', allProducts.length, 'products');
            try {
                localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(data));
            } catch (e) {
                // Quota exceeded or storage unavailable - ignore
            }
        }
        return allProducts;
    } catch (error) {
        console.error('Error loading products:', error);
        return allProducts;
    }
}

/**
 * Load products, serving from localStorage cache first for instant render
 * while refreshing from the network in the background.
 */
async function loadProducts() {
    const cached = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (cached) {
        try {
            const data = JSON.parse(cached);
            if (data.products && data.products.length) {
                allProducts = data.products;
                console.log('[products] serving from cache:', allProducts.length, 'products; refreshing from network');
                fetchAndCacheProducts();
                return allProducts;
            }
        } catch (e) {
            localStorage.removeItem(PRODUCTS_CACHE_KEY);
        }
    }
    return fetchAndCacheProducts();
}

/**
 * Build category filter checkboxes
 */
function buildCategoryFilter() {
    const desktopContainer = document.getElementById('category-filter');
    const mobileContainer = document.getElementById('category-filter-mobile');
    if (!desktopContainer && !mobileContainer) return;

    const categories = [...new Set(allProducts.map(p => p.category))].sort();
    const allChecked = activeCategories.length === 0 ? 'checked' : '';
    const allBox = `
        <label class="filter-checkbox filter-all">
            <input type="checkbox" value="" ${allChecked} data-all-checkbox>
            <span>All Category</span>
            <span class="filter-count">(${allProducts.length})</span>
        </label>
    `;
    const checkboxes = categories.map(cat => {
        const count = allProducts.filter(p => p.category === cat).length;
        const checked = activeCategories.includes(cat) ? 'checked' : '';
        return `
            <label class="filter-checkbox">
                <input type="checkbox" value="${cat.replace(/"/g, '&quot;')}" ${checked} data-cat-checkbox>
                <span>${cat}</span>
                <span class="filter-count">(${count})</span>
            </label>
        `;
    }).join('');

    const html = allBox + checkboxes;

    if (desktopContainer) desktopContainer.innerHTML = html;
    if (mobileContainer) mobileContainer.innerHTML = html;

    // "All Category" on desktop — clears the selection to show everything
    desktopContainer?.querySelectorAll('[data-all-checkbox]').forEach(all => {
        all.addEventListener('change', () => {
            if (all.checked) {
                activeCategories = [];
                buildCategoryFilter();
                renderProducts();
                updateFilterBadge();
            } else if (activeCategories.length === 0) {
                all.checked = true;
            }
        });
    });

    // "All Category" on mobile — visual only, applied on Apply
    mobileContainer?.querySelectorAll('[data-all-checkbox]').forEach(all => {
        all.addEventListener('change', () => {
            if (all.checked) {
                mobileContainer.querySelectorAll('[data-cat-checkbox]').forEach(cb => { cb.checked = false; });
            }
            updateFilterBadge();
        });
    });

    // Attach listeners on desktop
    desktopContainer?.querySelectorAll('[data-cat-checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
            toggleCategory(cb.value);
            if (activeCategories.length > 0) {
                document.querySelectorAll('[data-all-checkbox]').forEach(all => { all.checked = false; });
            }
            renderProducts();
            updateFilterBadge();
        });
    });

    // Attach listeners on mobile (apply button controls filtering there)
    mobileContainer?.querySelectorAll('[data-cat-checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
            const anySelected = [...mobileContainer.querySelectorAll('[data-cat-checkbox]:checked')].length > 0;
            mobileContainer.querySelectorAll('[data-all-checkbox]').forEach(all => { all.checked = !anySelected; });
            updateFilterBadge();
        });
    });
}

/**
 * Toggle a category in the active list
 */
function toggleCategory(category) {
    if (activeCategories.includes(category)) {
        activeCategories = activeCategories.filter(c => c !== category);
    } else {
        activeCategories.push(category);
    }
}

/**
 * Sync mobile drawer checkboxes with active categories state
 */
function syncMobileCheckboxes() {
    document.querySelectorAll('#category-filter-mobile [data-cat-checkbox]').forEach(cb => {
        cb.checked = activeCategories.includes(cb.value);
    });
    document.querySelectorAll('#category-filter-mobile [data-all-checkbox]').forEach(all => {
        all.checked = activeCategories.length === 0;
    });
}

/**
 * Sync mobile drawer sort select with current catalog sort state
 */
function syncMobileSort() {
    const mobileSort = document.getElementById('price-sort-mobile');
    if (mobileSort) {
        mobileSort.value = catalogSort === 'price-range' ? 'relevance' : catalogSort;
    }
}

/**
 * Update the mobile filter count badge
 */
function updateFilterBadge() {
    const badge = document.getElementById('mobile-filter-badge');
    const count = activeCategories.length;
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? '' : 'none';
    }
}

/**
 * Render removable chips for active category filters
 */
function renderActiveFilterChips() {
    const container = document.getElementById('catalog-active-filters');
    if (!container) return;

    const counts = {};
    allProducts.forEach(p => {
        counts[p.category] = (counts[p.category] || 0) + 1;
    });

    if (catalogSearchQuery) {
        container.innerHTML = `
            <span class="active-filters-label">Filters:</span>
            <div class="filter-chip">Search: "${catalogSearchQuery}"</div>
        `;
        container.style.display = '';
        return;
    }

    if (activeCategories.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    const chips = activeCategories.map(cat => `
        <div class="filter-chip">${cat} <span class="chip-count">(${counts[cat] || 0})</span>
            <button data-remove-cat="${cat.replace(/"/g, '&quot;')}" aria-label="Remove ${cat}">&times;</button>
        </div>
    `).join('');

    container.innerHTML = `<span class="active-filters-label">Filters:</span>${chips}`;
    container.style.display = '';

    container.querySelectorAll('[data-remove-cat]').forEach(btn => {
        btn.addEventListener('click', () => {
            toggleCategory(btn.dataset.removeCat);
            renderProducts();
            updateFilterBadge();
            buildCategoryFilter();
            syncMobileCheckboxes();
        });
    });
}

/**
 * Filter products by selected categories and search query
 */
function getFilteredProducts() {
    const query = catalogSearchQuery.toLowerCase();
    const filtered = allProducts.filter(p => {
        const categoryMatch = activeCategories.length === 0 || activeCategories.includes(p.category);
        const searchMatch = !query ||
            p.name.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query) ||
            (p.content && p.content.toLowerCase().includes(query));
        return categoryMatch && searchMatch;
    });

    if (catalogSort === 'price-low-high') {
        filtered.sort((a, b) => a.finalRate - b.finalRate);
    } else if (catalogSort === 'price-high-low') {
        filtered.sort((a, b) => b.finalRate - a.finalRate);
    }

    return filtered;
}

/**
 * Render product cards
 */
function renderProducts() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    const filtered = getFilteredProducts();
    const countEl = document.getElementById('catalog-count');
    if (countEl) {
        countEl.innerHTML = `Showing <strong>${filtered.length}</strong> of <strong>${allProducts.length}</strong> products`;
    }

    renderActiveFilterChips();

    if (filtered.length === 0) {
        grid.innerHTML = '<p class="no-results">No products found. Try a different search.</p>';
        return;
    }

    const grouped = {};
    filtered.forEach(p => {
        (grouped[p.category] = grouped[p.category] || []).push(p);
    });

    // Product images ship as a WebP master (lightbox) plus tiny WebP/JPEG
    // thumbs, so the manifest only needs the filename stem.
    const productImageBase = (p) => String(p.image).replace(/\.[^./]+$/, '');

    const thumbFor = (p) => {
        if (!p.image) {
            return `<img src="assets/twins_nanban_logo.png" alt="${p.name}" loading="lazy" class="thumb-placeholder">`;
        }
        const base = productImageBase(p);
        return `<picture data-lightbox-image="assets/products/${base}.webp" data-lightbox-fallback="assets/products/thumbs/${base}.jpg" data-lightbox-name="${p.name.replace(/"/g, '&quot;')}" data-lightbox-alt="${p.name.replace(/"/g, '&quot;')}">`
            + `<source type="image/webp" srcset="assets/products/thumbs/${base}.webp">`
            + `<img src="assets/products/thumbs/${base}.jpg" alt="${p.name}" loading="lazy" decoding="async">`
            + `</picture>`;
    };

    const cartItems = cart.reduce((map, item) => { map[item.name] = item.quantity || 0; return map; }, {});

    const productRow = (p) => {
        const qty = cartItems[p.name] || 0;
        return `
        <tr class="product-row" data-price="${p.finalRate}" data-cart-name="${p.name.replace(/"/g, '&quot;')}">
            <td class="td-center"><div class="product-thumb">${thumbFor(p)}</div></td>
            <td class="td-main">
                <span class="table-product-name">${p.name}</span>
            </td>
            <td class="td-content" data-label="Content"><span class="table-content">${p.content || '—'}</span></td>
            <td class="td-center" data-label="Actual Price"><span class="table-mrp">${p.discount > 0 ? formatPrice(p.rate) : formatPrice(p.finalRate)}</span><span class="table-cell-content">${p.content || ''}</span></td>
            <td class="td-center" data-label="Rate"><span class="table-rate">${formatPrice(p.finalRate)}</span></td>
            <td class="td-center" data-label="Qty">
                <input type="number" class="qty-input" value="${qty}" min="0" step="1" inputmode="numeric" aria-label="Quantity">
            </td>
            <td class="td-num table-price-cell" data-label="Price">
                <span class="table-total">${formatPrice(p.finalRate * qty)}</span>
            </td>
        </tr>`;
    }

    const rowProducts = [];
    const bodyHtml = Object.keys(grouped).map(cat => {
        const rows = grouped[cat].map(p => { rowProducts.push(p); return productRow(p); }).join('');
        const catDiscount = Math.round((grouped[cat][0].discount || 0) * 100);
        const catLabel = catDiscount > 0 ? `${cat} (${catDiscount}% Discount)` : cat;
        return `
        <div class="catalog-category">
            <h3 class="category-head">${catLabel}</h3>
            <div class="catalog-table-wrap">
                <table class="catalog-table">
                    <thead>
                        <tr>
                            <th class="th-center">Image</th>
                            <th>Product Name</th>
                            <th>Content</th>
                            <th class="th-center">Actual Price</th>
                            <th class="th-center">Price</th>
                            <th class="th-center">Quantity</th>
                            <th class="th-num">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>`;
    }).join('');

    grid.innerHTML = `<div class="catalog-categories">${bodyHtml}</div>`;

    grid.querySelectorAll('.catalog-table tbody tr.product-row').forEach((row, index) => {
        row._product = rowProducts[index];
    });

    // Quantity stepper + live total + auto cart sync
    const updateRowTotal = (row) => {
        const unit = parseFloat(row.dataset.price) || 0;
        const input = row.querySelector('.qty-input');
        let qty = parseInt(input.value);
        if (isNaN(qty) || qty < 0) qty = 0;
        input.value = qty;
        row.querySelector('.table-total').textContent = formatPrice(unit * qty);
    };

    const syncRowCart = (row) => {
        const qty = parseInt(row.querySelector('.qty-input').value) || 0;
        setCartQuantity(row._product, qty);
    };

    grid.querySelectorAll('.qty-input').forEach(input => {
        const row = input.closest('tr');

        const update = () => {
            updateRowTotal(row);
            syncRowCart(row);
        };

        input.addEventListener('input', update);
        input.addEventListener('blur', update);
    });
}

/**
 * Product image lightbox (products page)
 */
function setupLightbox() {
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    const caption = document.getElementById('lightbox-caption');
    const closeBtn = document.getElementById('lightbox-close');
    if (!lightbox || !img) return;

    document.getElementById('products-grid')?.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-lightbox-image]');
        if (!trigger) return;
        img.onerror = null;
        img.src = trigger.dataset.lightboxImage;
        // If the WebP master cannot be decoded, fall back to the JPEG thumb
        // so the overlay never ends up empty.
        if (trigger.dataset.lightboxFallback) {
            img.onerror = () => {
                img.onerror = null;
                img.src = trigger.dataset.lightboxFallback;
            };
        }
        img.alt = trigger.dataset.lightboxAlt || '';
        if (caption) caption.textContent = trigger.dataset.lightboxName || '';
        lightbox.classList.add('active');
        lightbox.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    });

    const close = () => {
        lightbox.classList.remove('active');
        lightbox.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        img.onerror = null;
        img.src = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', close);
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) close();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightbox.classList.contains('active')) close();
    });
}

/**
 * Poster overlay — opened from the "Poster" nav menu link
 */
function setupPosterOverlay() {
    const overlay = document.getElementById('poster-overlay');
    if (!overlay) return;

    const close = () => {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    };

    const open = () => {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    };

    document.getElementById('poster-menu-link')?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const navMenu = document.querySelector('.nav-menu');
        const menuToggle = document.getElementById('menu-toggle');
        if (navMenu) navMenu.classList.remove('active');
        if (menuToggle) menuToggle.classList.remove('active');
        open();
    });
    document.getElementById('poster-close')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) close();
    });

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    if (currentPage === 'index.html') {
        setTimeout(open, 600);
    }
}

/**
 * Handle Price List download: open PDF in a new tab and trigger download
 */
function setupPriceListDownload() {
    const link = document.getElementById('pricelist-download-link');
    if (!link) return;

    link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const pdfUrl = 'assets/Twins_And_Nanban_Crackers_List.pdf';
        window.open(pdfUrl, '_blank', 'noopener');
        const a = document.createElement('a');
        a.href = pdfUrl;
        a.download = 'Twins_And_Nanban_Crackers_List.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
}

/**
 * Handle category filter (from URL param)
 */
function filterCategory(category) {
    if (category && category !== 'All') {
        activeCategories = [category];
    } else {
        activeCategories = [];
    }
    renderProducts();
}

/**
 * Attach quantity/remove handlers to the rendered cart table rows.
 * Quantity changes update just the row + summary in place (no full re-render)
 * so the cart stays smooth even with many items.
 */
function attachCartItemHandlers(container) {
    container.querySelectorAll('.cart-catalog-table tbody tr.product-row').forEach(itemEl => {
        const idx = parseInt(itemEl.dataset.index, 10);
        const product = cart[idx];
        if (!product) return;

        const input = itemEl.querySelector('.qty-input');
        const totalEl = itemEl.querySelector('.table-total');

        const updateRow = () => {
            let qty = parseInt(input.value);
            if (isNaN(qty) || qty < 0) qty = 0;
            input.value = qty;
            setCartQuantity(product, qty);
            if (qty === 0) {
                renderCartPage();
                return;
            }
            if (totalEl) totalEl.textContent = formatPrice(product.finalRate * qty);
            updateCartSummary();
        };

        input.addEventListener('input', () => {
            let qty = parseInt(input.value);
            if (isNaN(qty) || qty < 0) qty = 0;
            if (totalEl) totalEl.textContent = formatPrice(product.finalRate * qty);
        });

        input.addEventListener('blur', updateRow);

        const deleteBtn = itemEl.querySelector('[data-remove-item]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                setCartQuantity(product, 0);
                renderCartPage();
            });
        }
    });
}

/**
 * Render the cart page table + order summary.
 * Top-level so it can paint immediately on page load without waiting
 * for header/footer injection.
 */
function renderCartPage() {
    const cartContent = document.getElementById('cart-content');
    if (!cartContent) return;

    cart = JSON.parse(localStorage.getItem('cart')) || [];

    const loadingEl = document.getElementById('cart-loading');
    if (loadingEl) loadingEl.style.display = 'none';

    // Show/hide toolbar based on cart contents
    const toolbarEl = document.getElementById('cart-items-toolbar');
    if (toolbarEl) {
        toolbarEl.style.display = cart.length > 0 ? 'flex' : 'none';
    }

    if (cart.length === 0) {
        cartContent.innerHTML = `
            <div class="cart-empty">
                <span class="cart-empty-icon">🛒</span>
                <h3>Your cart is empty</h3>
                <p>Browse our premium collection of crackers and fireworks, then come back to place your order.</p>
                <a href="products.html" class="btn btn-primary">Shop Now</a>
            </div>
        `;
        const summary = document.getElementById('cart-summary');
        if (summary) summary.style.display = 'none';
        return;
    }

    const summary = document.getElementById('cart-summary');
    if (summary) summary.style.display = '';

    const grouped = {};
    cart.forEach((item, i) => {
        const cat = item.category || 'Others';
        (grouped[cat] = grouped[cat] || []).push({ item, i });
    });

    cartContent.innerHTML = `
        <div class="cart-table-wrap">
            <table class="cart-catalog-table">
                <thead>
                    <tr>
                        <th>Product</th>
                        <th class="th-center">Qty</th>
                        <th class="th-num">Price</th>
                        <th class="th-center"></th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.keys(grouped).map(cat => {
                        const rows = grouped[cat].map(({ item, i }) => {
                            const unit = item.finalRate || item.price || 0;
                            const lineTotal = unit * item.quantity;
                            return `
                            <tr class="product-row" data-index="${i}">
                                <td class="td-main">
                                    <span class="table-product-name" title="${item.name}${item.content ? ` (${item.content})` : ''}">${item.name}${item.content ? ` (${item.content})` : ''}</span>
                                </td>
                                <td class="td-center td-cart-qty" data-label="Qty">
                                    <input type="number" class="qty-input" value="${item.quantity}" min="0" step="1" inputmode="numeric" aria-label="Quantity">
                                </td>
                                <td class="td-num table-price-cell" data-label="Price">
                                    <span class="table-total">${formatPrice(lineTotal)}</span>
                                </td>
                                <td class="td-center td-remove-cell">
                                    <button type="button" class="cart-remove-btn" data-remove-item aria-label="Remove item">
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                            <line x1="10" y1="11" x2="10" y2="17"></line>
                                            <line x1="14" y1="11" x2="14" y2="17"></line>
                                        </svg>
                                    </button>
                                </td>
                            </tr>`;
                        }).join('');

                        return `<tr class="cat-row"><td class="cat-head" colspan="8"><span class="cat-head-label">${cat}</span></td></tr>${rows}`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Order summary
    updateCartSummary();

    attachCartItemHandlers(cartContent);
}

/**
 * Update the order summary panel from the current cart without re-rendering
 */
function updateCartSummary() {
    let subtotal = 0, savings = 0, totalQty = 0;
    cart.forEach(item => {
        const unit = item.finalRate || item.price || 0;
        const mrp = item.rate || 0;
        subtotal += unit * item.quantity;
        savings += Math.max(0, mrp - unit) * item.quantity;
        totalQty += item.quantity;
    });

    const subtotalEl = document.getElementById('cart-subtotal');
    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);

    const savingsEl = document.getElementById('cart-savings');
    if (savingsEl) {
        savingsEl.textContent = savings > 0 ? '− ' + formatPrice(savings) : '₹0';
    }

    const countEl = document.getElementById('cart-summary-count');
    if (countEl) countEl.textContent = `${totalQty} item${totalQty > 1 ? 's' : ''}`;

    const totalEl = document.getElementById('cart-total');
    if (totalEl) totalEl.textContent = formatPrice(subtotal);
}

/**
 * Setup cart page (cart.html)
 */
function setupCartPage() {
    const cartContent = document.getElementById('cart-content');
    if (!cartContent) return;

    renderCartPage();

    const orderBtn = document.getElementById('cart-order-btn');
    const orderModal = document.getElementById('order-modal');
    const orderOverlay = document.getElementById('order-overlay');
    const orderCloseBtn = document.getElementById('order-modal-close');
    const orderCancelBtn = document.getElementById('order-cancel-btn');
    const orderForm = document.getElementById('order-form');

    const openOrderModal = () => {
        if (!orderModal || !orderOverlay) return;
        orderOverlay.classList.add('active');
        orderModal.classList.add('active');
        const billNameInput = document.getElementById('inv-customer-name');
        if (billNameInput && !billNameInput.value.trim()) setTimeout(() => billNameInput.focus(), 150);
    };

    const closeOrderModal = () => {
        if (!orderModal || !orderOverlay) return;
        orderOverlay.classList.remove('active');
        orderModal.classList.remove('active');
    };

    if (orderBtn && orderModal) {
        orderBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showNotification('Your cart is empty');
                return;
            }
            openOrderModal();
        });
    }

    if (orderCloseBtn) orderCloseBtn.addEventListener('click', closeOrderModal);
    if (orderCancelBtn) orderCancelBtn.addEventListener('click', closeOrderModal);
    if (orderOverlay) orderOverlay.addEventListener('click', closeOrderModal);

    const buildOrderSummary = () => {
        cart = JSON.parse(localStorage.getItem('cart')) || [];
        let subtotal = 0;
        let savings = 0;
        let totalQty = 0;
        const lines = cart.map(item => {
            const unit = item.finalRate || item.price || 0;
            const mrp = item.rate || 0;
            subtotal += unit * item.quantity;
            savings += Math.max(0, mrp - unit) * item.quantity;
            totalQty += item.quantity;
            return {
                name: item.name,
                content: item.content || '',
                qty: item.quantity,
                unit: unit,
                mrp: mrp,
                lineTotal: unit * item.quantity
            };
        });
        return { lines, subtotal, savings, total: subtotal, totalQty };
    };

    const buildWhatsAppMessage = (customer, summary, orderId) => {
        const lines = [
            '*TWINS & NANBAN CRACKERS - NEW ORDER*',
            '',
            `*Name:* ${customer.name}`,
            `*Mobile:* ${customer.mobile}`
        ];
        if (orderId) lines.push(`*Order ID:* ${orderId}`);
        lines.push(
            '',
            '*Order Details:*'
        );
        summary.lines.forEach((line, i) => {
            lines.push(`${i + 1}. ${line.name}${line.content ? ' (' + line.content + ')' : ''} x${line.qty} - ${formatPrice(line.lineTotal)}`);
        });
        lines.push('');
        if (summary.savings > 0) lines.push(`*You Save:* ${formatPrice(summary.savings)}`);
        lines.push(`*Total Price : ${formatPrice(summary.total)}*`);
        return lines.join('\n');
    };

    if (orderForm) {
        orderForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const nameInput = document.getElementById('inv-customer-name');
            const mobileInput = document.getElementById('inv-customer-mobile');

            const name = (nameInput && nameInput.value || '').trim();
            const mobile = (mobileInput && mobileInput.value || '').trim();

            let valid = true;
            if (nameInput) {
                if (!name) {
                    nameInput.classList.add('invalid');
                    valid = false;
                } else {
                    nameInput.classList.remove('invalid');
                }
            }

            if (mobileInput) {
                if (!/^[6-9]\d{9}$/.test(mobile)) {
                    mobileInput.classList.add('invalid');
                    valid = false;
                } else {
                    mobileInput.classList.remove('invalid');
                }
            }

            if (!valid) {
                closeOrderModal();
                showNotification('Please fill customer name and a valid 10-digit mobile number to place your order');
                if (nameInput && !name) nameInput.focus();
                else if (mobileInput) mobileInput.focus();
                return;
            }

            const submitBtn = document.getElementById('order-submit-btn');
            if (submitBtn) submitBtn.classList.add('is-loading');

            const summary = buildOrderSummary();
            const customer = { name, mobile };
            try {
                localStorage.setItem('twins_bill_customer', JSON.stringify(customer));
            } catch (e) { /* ignore */ }

            const submitOrderRequest = async () => {
                try {
                    const res = await fetch('/api/orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            customerName: customer.name,
                            mobile: customer.mobile,
                            items: summary.lines.map(l => ({
                                name: l.name,
                                content: l.content,
                                qty: l.qty,
                                rate: l.mrp,
                                finalRate: l.unit
                            }))
                        })
                    });
                    const data = await res.json().catch(() => ({}));
                    return (data && data.order && data.order.id) || null;
                } catch (e) {
                    return null;
                }
            };

            (async () => {
                const orderId = await submitOrderRequest();

                const msg = buildWhatsAppMessage(customer, summary, orderId);
                const waNumber = '917601999346';

                const finishOrder = (note) => {
                    closeOrderModal();
                    if (submitBtn) submitBtn.classList.remove('is-loading');
                    if (cart.length > 0) {
                        localStorage.removeItem('cart');
                        cart = [];
                        updateCartCount();
                        renderCartPage();
                    }
                    if (note) showNotification(note);
                };

                window.open('https://wa.me/' + waNumber + '?text=' + encodeURIComponent(msg), '_blank');
                finishOrder(orderId
                    ? `Order ID ${orderId} - order details sent on WhatsApp!`
                    : 'Order details sent on WhatsApp!');
            })();
        });
    }

    const clearBtn = document.getElementById('cart-clear-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (cart.length === 0) {
                showNotification('Your cart is already empty');
                return;
            }
            localStorage.removeItem('cart');
            cart = [];
            updateCartCount();
            renderCartPage();
            showNotification('Cart cleared successfully');
        });
    }

    const invoiceBtn = document.getElementById('cart-invoice-btn');

    const billNameInput = document.getElementById('inv-customer-name');
    const billMobileInput = document.getElementById('inv-customer-mobile');
    if (billNameInput || billMobileInput) {
        const savedBill = (() => {
            try { return JSON.parse(localStorage.getItem('twins_bill_customer') || 'null'); } catch (e) { return null; }
        })();
        if (billNameInput && savedBill) billNameInput.value = savedBill.name || '';
        if (billMobileInput && savedBill) billMobileInput.value = savedBill.mobile || '';

        const isBillValid = () => {
            const name = (billNameInput && billNameInput.value.trim()) || '';
            const mobile = (billMobileInput && billMobileInput.value.trim()) || '';
            return !!name && /^[6-9]\d{9}$/.test(mobile);
        };

        const setButtonsDisabled = (disabled) => {
            if (orderBtn) orderBtn.disabled = disabled;
            if (invoiceBtn) invoiceBtn.disabled = disabled;
        };

        const updateBillButtons = () => {
            setButtonsDisabled(!isBillValid());
            if (billMobileInput) billMobileInput.classList.toggle('invalid', billMobileInput.value.trim() !== '' && !/^[6-9]\d{9}$/.test(billMobileInput.value.trim()));
        };

        updateBillButtons();

        const saveBill = () => {
            try {
                localStorage.setItem('twins_bill_customer', JSON.stringify({
                    name: (billNameInput && billNameInput.value.trim()) || '',
                    mobile: (billMobileInput && billMobileInput.value.trim()) || ''
                }));
            } catch (e) { /* ignore */ }
        };
        const onBillChange = () => { saveBill(); updateBillButtons(); };
        if (billNameInput) billNameInput.addEventListener('input', onBillChange);
        if (billMobileInput) billMobileInput.addEventListener('input', onBillChange);
    }

    if (invoiceBtn) {
        invoiceBtn.addEventListener('click', async () => {
            if (cart.length === 0) {
                showNotification('Your cart is empty');
                return;
            }
            try {
                await loadJspdf();
            } catch (e) {
                showNotification('Could not load invoice library. Please check your internet connection.');
                return;
            }
            const nameInput = document.getElementById('inv-customer-name');
            const mobileInput = document.getElementById('inv-customer-mobile');
            const name = (nameInput && nameInput.value || '').trim();
            const mobile = (mobileInput && mobileInput.value || '').trim();
            let valid = true;
            if (nameInput) {
                if (!name) {
                    nameInput.classList.add('invalid');
                    valid = false;
                } else {
                    nameInput.classList.remove('invalid');
                }
            }
            if (mobileInput) {
                if (!/^[6-9]\d{9}$/.test(mobile)) {
                    mobileInput.classList.add('invalid');
                    valid = false;
                } else {
                    mobileInput.classList.remove('invalid');
                }
            }
            if (!valid) {
                showNotification('Please fill customer name and a valid 10-digit mobile number to download the invoice');
                if (nameInput && !name) nameInput.focus();
                else if (mobileInput) mobileInput.focus();
                return;
            }
            downloadInvoice();
        });
    }
}

/**
 * Convert an amount to Indian-English words (e.g. 65,430 → "Sixty Five Thousand Four Hundred Thirty Rupees Only")
 */
function numberToIndianWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const two = (n) => n < 20 ? ones[n] : (tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''));
    if (!num) return 'Zero Rupees Only';
    let n = Math.round(num);
    let words = '';
    if (n >= 10000000) { words += two(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000; }
    if (n >= 100000) { words += two(Math.floor(n / 100000)) + ' Lakh '; n %= 100000; }
    if (n >= 1000) { words += two(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
    if (n >= 100) { words += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
    if (n) words += two(n);
    return words.trim() + ' Rupees Only';
}

/**
 * Gather customer details for the bill from the on-page inputs
 * or the last customer from the order form
 */
function getBillCustomer() {
    const stored = (() => {
        try { return JSON.parse(localStorage.getItem('twins_bill_customer') || 'null'); } catch (e) { return null; }
    })();
    const name = (document.getElementById('inv-customer-name') && document.getElementById('inv-customer-name').value || '').trim();
    const mobile = (document.getElementById('inv-customer-mobile') && document.getElementById('inv-customer-mobile').value || '').trim();
    return {
        name: name || (stored && stored.name) || '',
        mobile: mobile || (stored && stored.mobile) || ''
    };
}

/**
 * Load jsPDF on demand (only when the invoice is actually downloaded),
 * so it never blocks the cart page from loading.
 */
let jspdfPromise = null;
function loadJspdf() {
    if (window.jspdf && window.jspdf.jsPDF) return Promise.resolve();
    if (!jspdfPromise) {
        jspdfPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
            script.onload = () => resolve();
            script.onerror = () => {
                jspdfPromise = null;
                reject(new Error('Failed to load jsPDF'));
            };
            document.head.appendChild(script);
        });
    }
    return jspdfPromise;
}

/**
 * Generate and download a PDF invoice for the current cart
 */
function downloadInvoice() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 44;
    const contentWidth = pageWidth - margin * 2;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${pad(now.getDate())}-${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    const invoiceNo = `INV-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

    const PRIMARY = [230, 28, 36];
    const DARK = [16, 24, 42];
    const GRAY = [112, 112, 118];
    const LIGHT_BORDER = [226, 226, 231];
    const abbrev = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trim() + '…' : s || '');
    const inr = (v) => v.toLocaleString('en-IN');

    const STORE_GSTIN = ''; // TODO: replace with the shop's GSTIN
    const billTo = getBillCustomer();

    // ---- Header band (page 1) ----
    // Company info on left, Invoice label on right
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('TWINS & NANBAN CRACKERS', margin, 24);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 105);
    doc.text('Wholesale & Retail Fireworks', margin, 36);
    
    doc.setFontSize(8.5);
    doc.setTextColor(120, 120, 125);
    doc.text('Poondi Main Road, Semmedu, Coimbatore', margin, 46);
    doc.text('+91 7601999346  ·  ganesans1235@gmail.com', margin, 56);
    
    // Invoice label on right side
    doc.setTextColor(DARK[0], DARK[1], DARK[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('INVOICE', pageWidth - margin, 28, { align: 'right' });
    
    // Red divider line
    doc.setDrawColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setLineWidth(2);
    doc.line(margin, 64, pageWidth - margin, 64);

    // ---- Meta boxes ----
    let y = 78;
    const boxH = 60;
    doc.setFillColor(249, 249, 251);
    doc.setDrawColor(LIGHT_BORDER[0], LIGHT_BORDER[1], LIGHT_BORDER[2]);
    doc.roundedRect(margin, y, contentWidth, boxH, 5, 5, 'FD');
    
    // Left side - BILL TO
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('BILL TO', margin + 14, y + 12);
    const billName = billTo.name || 'Walk-in / Retail';
    const billMobile = billTo.mobile ? 'Mob : +91 ' + billTo.mobile : '';
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(abbrev(billName, 34), margin + 14, y + 28);
    if (billMobile) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 95);
        doc.text(billMobile, margin + 14, y + 40);
    }
    
    // Right side - Date and Time (with labels on left, values on right)
    const rightCol = pageWidth - margin - 100;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 100, 105);
    doc.text('Date', rightCol, y + 28);
    doc.text('Time', rightCol, y + 42);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(dateStr, pageWidth - margin - 14, y + 28, { align: 'right' });
    doc.text(timeStr, pageWidth - margin - 14, y + 42, { align: 'right' });

    y += boxH + 20;

    // ---- Items table ----
    const cols = [
        { label: '#', width: 24, align: 'right' },
        { label: 'Product', align: 'left' },
        { label: 'MRP', width: 65, align: 'right' },
        { label: 'Disc', width: 42, align: 'right' },
        { label: 'Rate', width: 65, align: 'right' },
        { label: 'Qty', width: 36, align: 'right' },
        { label: 'Amount', width: 90, align: 'right' }
    ];
    const fixedW = cols.reduce((s, c) => s + (c.width || 0), 0);
    cols[1].width = contentWidth - fixedW;

    let x;
    const drawTableHead = () => {
        doc.setFillColor(DARK[0], DARK[1], DARK[2]);
        doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        x = margin;
        cols.forEach(c => {
            const xPos = x + (c.align === 'right' ? c.width - 8 : 8);
            doc.text(c.label, xPos, y + 16, { align: c.align === 'right' ? 'right' : 'left' });
            x += c.width;
        });
        y += 24;
    };

    const newPage = (noHead) => {
        doc.addPage();
        doc.setFillColor(DARK[0], DARK[1], DARK[2]);
        doc.rect(0, 0, pageWidth, 28, 'F');
        doc.setFillColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
        doc.rect(0, 28, pageWidth, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('TWINS & NANBAN CRACKERS', margin, 18);
        doc.text(invoiceNo, pageWidth - margin, 18, { align: 'right' });
        y = 64;
        if (!noHead) drawTableHead();
    };

    drawTableHead();

    const rowH = 30;
    let subtotal = 0, savings = 0;
    cart.forEach((item, idx) => {
        const unit = item.finalRate || item.price || 0;
        const mrp = item.rate || 0;
        const discPct = mrp > unit ? Math.round((1 - unit / mrp) * 100) : 0;
        const qty = item.quantity || 0;
        const lineTotal = unit * qty;
        subtotal += lineTotal;
        savings += Math.max(0, mrp - unit) * qty;

        if (y > pageHeight - 100) newPage();

        if (idx % 2 === 1) {
            doc.setFillColor(247, 247, 250);
            doc.rect(margin, y, contentWidth, rowH, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(90, 90, 95);
        doc.text(String(idx + 1), margin + cols[0].width - 8, y + 20, { align: 'right' });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(30, 30, 30);
        const nameWidth = cols[1].width - 12;
        const wrappedName = doc.splitTextToSize(item.name, nameWidth);
        doc.text(wrappedName[0] || '', margin + cols[0].width + 8, y + 15);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
        const wrappedCat = doc.splitTextToSize(item.category || 'Others', nameWidth);
        doc.text(wrappedCat[0] || '', margin + cols[0].width + 8, y + 25);

        const vals = [
            mrp > 0 ? inr(mrp) : inr(unit),
            discPct > 0 ? `-${discPct}%` : '—',
            inr(unit),
            String(qty),
            inr(lineTotal)
        ];
        x = margin + cols[0].width + cols[1].width;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(40, 40, 40);
        vals.forEach((v, i) => {
            const c = cols[i + 2];
            doc.text(v, x + c.width - 8, y + 20, { align: 'right' });
            x += c.width;
        });
        y += rowH;
    });

    // ---- Totals (simple, no card) ----
    if (y > pageHeight - 200) newPage();
    
    y += 18;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(PRIMARY[0], PRIMARY[1], PRIMARY[2]);
    doc.text('GRAND TOTAL :', margin, y);
    doc.text(inr(subtotal), pageWidth - margin, y, { align: 'right' });

    // Amount in words + items note
    y += 24;
    doc.setTextColor(80, 80, 85);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('AMOUNT IN WORDS', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 30, 30);
    doc.text(numberToIndianWords(subtotal), margin, y + 14);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.setFontSize(8.5);
    doc.text(`Total Items : ${cart.length}`, margin, y + 32);

    // ---- Logo Background (Watermark) ----
    try {
        const logoUrl = 'assets/twins_nanban_logo.png';
        const centerX = pageWidth / 2;
        const centerY = pageHeight / 2;
        const logoWidth = 400;
        const logoHeight = 400;
        
        // Set opacity to lighter
        doc.setGState(new doc.GState({ opacity: 0.08 }));
        doc.addImage(logoUrl, 'PNG', centerX - logoWidth / 2, centerY - logoHeight / 2, logoWidth, logoHeight);
        doc.setGState(new doc.GState({ opacity: 1 }));
    } catch (e) {
        // Logo not available, continue without it
    }

    // ---- Footer ----
    doc.setDrawColor(206, 206, 211);
    doc.setLineWidth(0.7);
    doc.line(margin, pageHeight - 58, pageWidth - margin, pageHeight - 58);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Thank you for your purchase! · Twins & Nanban Crackers', margin, pageHeight - 40);
    doc.text('System-generated invoice', pageWidth - margin, pageHeight - 40, { align: 'right' });

    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setTextColor(150, 150, 155);
        doc.setFontSize(8);
        doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 28, { align: 'right' });
    }

    doc.save(`TwinsNanbanCrackers-${invoiceNo}.pdf`);
    showNotification('Invoice downloaded successfully!');
}

/**
 * Setup catalog page (search + initial render)
 */
async function setupCatalog() {
    const searchInput = document.getElementById('catalog-search-input');
    const mobileSearchInput = document.getElementById('catalog-search-input-mobile');
    if (!searchInput && !mobileSearchInput) return;

    const loadingEl = document.getElementById('catalog-loading');
    const toolbarEl = document.getElementById('catalog-toolbar');
    const mobileBar = document.getElementById('mobile-filter-bar');
    const params = new URLSearchParams(window.location.search);
    const urlCategory = params.get('category');
    const urlSearch = params.get('search');

    await loadProducts();

    if (urlCategory) {
        activeCategories = [urlCategory];
    }
    if (urlSearch) {
        catalogSearchQuery = urlSearch;
        if (searchInput) searchInput.value = urlSearch;
        if (mobileSearchInput) mobileSearchInput.value = urlSearch;
    }

    if (loadingEl) loadingEl.style.display = 'none';
    if (toolbarEl) toolbarEl.style.display = '';
    if (mobileBar) mobileBar.style.display = '';

    buildCategoryFilter();
    syncMobileCheckboxes();
    renderProducts();
    updateFilterBadge();
    setupCatalogSearch();

    const onSearch = (e) => {
        catalogSearchQuery = e.target.value.trim();
        renderProducts();
    };
    if (searchInput) searchInput.addEventListener('input', onSearch);
    if (mobileSearchInput) mobileSearchInput.addEventListener('input', onSearch);

    setupFilterDrawer();
    setupSidebarToggle();
    setupPriceFilter();
}

/**
 * Setup mobile filter drawer open/close/apply behavior
 */
function setupFilterDrawer() {
    const toggleBtn = document.getElementById('filter-toggle-btn');
    const overlay = document.getElementById('filter-overlay');
    const drawer = document.getElementById('filter-drawer');
    const closeBtn = document.getElementById('filter-drawer-close');
    const applyBtn = document.getElementById('filter-apply-btn');
    const clearBtn = document.getElementById('filter-clear-btn');
    const sidebarClear = document.getElementById('sidebar-clear-filters');
    if (!drawer || !overlay) return;

    const openDrawer = () => {
        syncMobileCheckboxes();
        syncMobileSort();
        drawer.classList.add('active');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeDrawer = () => {
        drawer.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);

    const clearAll = () => {
        activeCategories = [];
        catalogSearchQuery = '';
        catalogSort = 'relevance';
        const searchInput = document.getElementById('catalog-search-input');
        const mobileSearchInput = document.getElementById('catalog-search-input-mobile');
        if (searchInput) searchInput.value = '';
        if (mobileSearchInput) mobileSearchInput.value = '';
        const desktopSort = document.getElementById('price-sort');
        if (desktopSort) desktopSort.value = 'relevance';
        const mobileSort = document.getElementById('price-sort-mobile');
        if (mobileSort) mobileSort.value = 'relevance';
        const priceRangeFilter = document.getElementById('price-range-filter');
        if (priceRangeFilter) priceRangeFilter.style.display = 'none';
        syncMobileCheckboxes();
        buildCategoryFilter();
        renderProducts();
        updateFilterBadge();
    };

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const allSelected = !!document.querySelector('#category-filter-mobile [data-all-checkbox]:checked');
            const selected = allSelected ? [] : [...document.querySelectorAll('#category-filter-mobile [data-cat-checkbox]:checked')].map(cb => cb.value);
            activeCategories = selected;
            const mobileSort = document.getElementById('price-sort-mobile');
            if (mobileSort) {
                catalogSort = mobileSort.value;
                const desktopSort = document.getElementById('price-sort');
                if (desktopSort) desktopSort.value = mobileSort.value;
                const priceRangeFilter = document.getElementById('price-range-filter');
                if (priceRangeFilter) priceRangeFilter.style.display = 'none';
            }
            renderProducts();
            updateFilterBadge();
            buildCategoryFilter();
            closeDrawer();
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            clearAll();
            closeDrawer();
        });
    }

    if (sidebarClear) {
        sidebarClear.addEventListener('click', clearAll);
    }

    // Sidebar panel expand/collapse toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('catalog-toolbar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            const collapsed = sidebar.classList.toggle('collapsed');
            sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeDrawer();
    });
}

// ====================================
// Homepage & Category Tiles
// ====================================

/**
 * Major category tiles shown on homepage
 */
const MAJOR_CATEGORIES = [
    {
        name: 'Fancy Aerial Shots',
        category: 'Mega Aerial Out',
        image: 'prod_aerial_shots.png',
        desc: 'Multi-color aerial fireworks that create spectacular patterns in the sky.'
    },
    {
        name: 'Classic Sound Crackers',
        category: 'One Sound Crackers',
        image: 'prod_sound_crackers.png',
        desc: 'Traditional crackers that produce exciting festival sounds.'
    },
    {
        name: 'Festival Combo Packs',
        category: 'Gift Boxes (Net Rated)',
        image: 'prod_combo_pack.png',
        desc: 'Special combo boxes containing a variety of fireworks for family celebrations.'
    },
    {
        name: 'Color Sparklers',
        category: 'Sparklers',
        image: 'prod_sparklers.png',
        desc: 'Bright and colorful sparklers perfect for kids and family celebrations.'
    },
    {
        name: 'Flower Pot Crackers',
        category: 'Flower Pots',
        image: 'prod_flower_pots.png',
        desc: 'Beautiful sparkling fountains that light up the ground with colorful effects.'
    },
    {
        name: 'Sky Rockets',
        category: 'Rocket',
        image: 'prod_rockets_packaged.png',
        desc: 'Powerful rockets that shoot high into the sky with amazing fireworks displays.'
    }
];

/**
 * Load categories grid on homepage
 */
async function loadCategories() {
    const categoriesGrid = document.getElementById('categories-grid');
    if (!categoriesGrid) return;

    try {
        if (!allProducts.length) await loadProducts();
        const products = allProducts;

        if (!products || !products.length) {
            throw new Error('No products found');
        }

        categoriesGrid.innerHTML = MAJOR_CATEGORIES.map((cat, index) => {
            const catBase = String(cat.image).replace(/\.[^./]+$/, '');
            return `
            <a href="products.html" class="category-tile has-image" style="animation-delay:${Math.min(index * 0.04, 0.5)}s">
                <div class="category-image"><picture><source type="image/webp" srcset="assets/home_category/${catBase}.webp"><img src="assets/home_category/${catBase}.jpg" alt="${cat.name}" loading="lazy" decoding="async"></picture></div>
                <div class="category-text">
                    <h3>${cat.name}</h3>
                    <p>${cat.desc}</p>
                </div>
            </a>
        `;
        }).join('');
    } catch (error) {
        console.error('Error loading categories:', error);
        categoriesGrid.innerHTML = '<p class="no-results">Unable to load categories.</p>';
    }
}

/**
 * Initialize all functionality
 */
async function init() {
    // Add animations
    addAnimations();

    // Cart page: paint the cart immediately without waiting for header/footer/assets
    if (document.getElementById('cart-content')) {
        renderCartPage();
    }

    // Load components in parallel (header, footer, product catalog)
    const headerPromise = loadHeader();
    const footerPromise = loadFooter();
    const catalogPromise = setupCatalog();

    await Promise.all([headerPromise, footerPromise, catalogPromise]);

    // Update cart count after header loads
    updateCartCount();

    // Setup homepage category tiles
    loadCategories();

    // Setup event listeners
    const delayedSetup = () => {
        const menuToggle = document.getElementById('menu-toggle');
        const searchBtn = document.getElementById('search-btn');
        const cartBtn = document.getElementById('cart-btn');

        if (menuToggle) {
            menuToggle.addEventListener('click', toggleMenu);
        }
        if (searchBtn) {
            searchBtn.addEventListener('click', toggleSearch);
        }
        if (cartBtn) {
            cartBtn.addEventListener('click', handleCartClick);
        }

        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', handleContactSubmit);
        }

        setupProductCards();
        setupMenuLinkListeners();
        setupScrollAnimations();
        setupFilterPanel();
        setupCartPage();
        setupLightbox();
        setupPosterOverlay();
        setupPriceListDownload();
        updateCartCount();

        // Close search bar when clicking outside
        document.addEventListener('click', (e) => {
            const searchBar = document.getElementById('search-bar');
            if (searchBar && !e.target.closest('.search-btn') && !e.target.closest('.search-bar')) {
                searchBar.classList.remove('active');
            }
        });
    };

    // Header components are already loaded (awaited above), attach listeners now
    delayedSetup();
}

/**
 * Handle contact form submission
 */
function handleContactSubmit(e) {
    e.preventDefault();
    const name = e.target.querySelector('input[type="text"]').value;
    showNotification(`Thank you ${name}! Your message has been sent.`);
    e.target.reset();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ====================================
// Filter Panel (Right to Left Collapse/Expand)
// ====================================

/**
 * Setup filter panel functionality
 */
function setupFilterPanel() {
    const filterToggle = document.getElementById('filter-toggle');
    const filterPanel = document.getElementById('filter-panel');
    const filterClose = document.getElementById('filter-close');
    const clearFiltersBtn = document.getElementById('clear-filters');

    if (filterToggle && filterPanel) {
        filterToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            filterPanel.classList.toggle('expanded');
            filterToggle.classList.toggle('active');
        });
    }

    if (filterClose && filterPanel) {
        filterClose.addEventListener('click', () => {
            filterPanel.classList.remove('expanded');
            if (filterToggle) {
                filterToggle.classList.remove('active');
            }
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }

    // Close filter panel when clicking outside
    document.addEventListener('click', (e) => {
        if (filterPanel && !e.target.closest('.filter-panel') && !e.target.closest('#filter-toggle')) {
            filterPanel.classList.remove('expanded');
            if (filterToggle) {
                filterToggle.classList.remove('active');
            }
        }
    });

    // Setup filter checkboxes
    setupFilterCheckboxes();
}

/**
 * Setup filter checkbox listeners
 */
function setupFilterCheckboxes() {
    const filterCheckboxes = document.querySelectorAll('.filter-option input[type="checkbox"]');
    
    filterCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            applyFilters();
        });
    });

    // Setup price range inputs
    const priceMin = document.getElementById('price-min');
    const priceMax = document.getElementById('price-max');
    const priceSlider = document.getElementById('price-slider');

    const syncPriceInputs = () => {
        if (priceSlider && priceMax) {
            priceMax.value = priceSlider.value;
        }
        applyFilters();
    };

    if (priceMin) {
        priceMin.addEventListener('change', applyFilters);
    }
    if (priceMax) {
        priceMax.addEventListener('change', applyFilters);
    }
    if (priceSlider) {
        priceSlider.addEventListener('input', syncPriceInputs);
    }
}

/**
 * Apply active filters
 */
function applyFilters() {
    const activeFilters = {
        categories: [],
        ratings: []
    };

    // Get selected categories
    document.querySelectorAll('.filter-option input[name="category"]:checked').forEach(checkbox => {
        activeFilters.categories.push(checkbox.value);
    });

    // Get selected ratings
    document.querySelectorAll('.filter-option input[name="rating"]:checked').forEach(checkbox => {
        activeFilters.ratings.push(checkbox.value);
    });

    // Get price range
    const priceMin = document.getElementById('price-min')?.value || 0;
    const priceMax = document.getElementById('price-max')?.value || 1000;
    activeFilters.priceRange = { min: parseFloat(priceMin), max: parseFloat(priceMax) };

    // Save to localStorage
    localStorage.setItem('activeFilters', JSON.stringify(activeFilters));

    console.log('Applied filters:', activeFilters);
}

/**
 * Clear all filters
 */
function clearAllFilters() {
    // Uncheck all checkboxes
    document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Reset price inputs
    const priceMin = document.getElementById('price-min');
    const priceMax = document.getElementById('price-max');
    const priceSlider = document.getElementById('price-slider');

    if (priceMin) priceMin.value = 0;
    if (priceMax) priceMax.value = 1000;
    if (priceSlider) priceSlider.value = 1000;

    // Clear localStorage
    localStorage.removeItem('activeFilters');

    console.log('All filters cleared');
}

// ====================================
// Sidebar Toggle Collapse/Expand
// ====================================

/**
 * Setup sidebar collapse/expand toggle for filter panel
 */
function setupSidebarToggle() {
    const sidebar = document.getElementById('catalog-toolbar');
    const catalogLayout = document.querySelector('.catalog-layout');

    if (!sidebar) return;

    // Click anywhere on the sidebar to expand when collapsed
    sidebar.addEventListener('click', (e) => {
        if (sidebar.classList.contains('collapsed')) {
            e.stopPropagation();
            sidebar.classList.remove('collapsed');
            
            if (catalogLayout) {
                catalogLayout.classList.remove('sidebar-collapsed');
            }
            
            // Save state to localStorage
            localStorage.setItem('sidebar-collapsed', 'false');
        }
    });

    // Close button to collapse
    const closeBtn = sidebar.querySelector('.sidebar-toggle');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.add('collapsed');
            
            if (catalogLayout) {
                catalogLayout.classList.add('sidebar-collapsed');
            }
            
            localStorage.setItem('sidebar-collapsed', 'true');
        });
    }

    // Restore saved state on page load
    const savedState = localStorage.getItem('sidebar-collapsed');
    if (savedState === 'true') {
        sidebar.classList.add('collapsed');
        if (catalogLayout) {
            catalogLayout.classList.add('sidebar-collapsed');
        }
    }
}


// ====================================
// Price Filter & Sorting
// ====================================

/**
 * Setup price filter dropdown and sorting
 */
function setupPriceFilter() {
    const priceSort = document.getElementById('price-sort');
    const priceRangeFilter = document.getElementById('price-range-filter');
    const applyPriceBtn = document.getElementById('apply-price');

    if (!priceSort) return;

    // Show price range inputs when "Price Range" is selected
    priceSort.addEventListener('change', (e) => {
        if (e.target.value === 'price-range') {
            priceRangeFilter.style.display = 'flex';
        } else {
            priceRangeFilter.style.display = 'none';
            catalogSort = e.target.value;
            syncMobileSort();
            renderProducts();
        }
    });

    // Apply price range filter
    if (applyPriceBtn) {
        applyPriceBtn.addEventListener('click', () => {
            const minPrice = parseFloat(document.getElementById('min-price').value) || 0;
            const maxPrice = parseFloat(document.getElementById('max-price').value) || Infinity;
            
            console.log(`Filtering products between ₹${minPrice} - ₹${maxPrice}`);
            // TODO: Implement price range filtering for products
            showNotification(`Filtering prices: ₹${minPrice} - ₹${maxPrice}`);
        });
    }
}


