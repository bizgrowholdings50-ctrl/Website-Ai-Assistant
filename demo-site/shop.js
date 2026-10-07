(() => {
  const products = [
    { id: 'headphones', name: 'ProSound Wireless Headphones', category: 'Audio', price: 79.99, label: 'PROSOUND', description: 'Active noise cancellation with 30-hour battery life and premium comfort fit for all-day listening.', details: ['Active noise cancellation', '30-hour battery life', 'Comfort fit for all-day listening'] },
    { id: 'keyboard', name: 'MechKey Pro Keyboard', category: 'Input', price: 129.99, label: 'MECHKEY', description: 'Mechanical switches with per-key RGB, wireless and USB-C, hot-swappable design.', details: ['Hot-swappable mechanical switches', 'Per-key RGB lighting', 'Wireless and USB-C connectivity'] },
    { id: 'mouse', name: 'SwiftClick Gaming Mouse', category: 'Input', price: 49.99, label: 'SWIFTCLICK', description: '16,000 DPI sensor, ergonomic shape, 8 programmable buttons, 70-hour battery.', details: ['16,000 DPI sensor', '8 programmable buttons', 'Up to 70-hour battery life'] },
    { id: 'powerbank', name: 'PowerBank Ultra 20K', category: 'Power', price: 39.99, label: 'POWERBANK', description: '20,000mAh capacity with USB-C PD 65W fast charging and dual output ports.', details: ['20,000mAh capacity', 'USB-C PD 65W fast charging', 'Dual output ports'] },
    { id: 'microphone', name: 'ClearVoice USB Microphone', category: 'Audio', price: 89.99, label: 'CLEARVOICE', description: 'Studio-quality cardioid condenser with zero-latency monitoring and mute toggle.', details: ['Cardioid condenser capsule', 'Zero-latency monitoring', 'Convenient mute toggle'] },
    { id: 'ledstrip', name: 'SmartGlow LED Strip 5m', category: 'Lighting', price: 24.99, label: 'SMARTGLOW', description: 'WiFi-enabled with 16 million colors, music sync, app and voice control.', details: ['5-meter LED strip', '16 million colors and music sync', 'App and voice control'] },
  ];
  const storageKey = 'techbyte-demo-cart';
  const money = amount => `$${amount.toFixed(2)}`;
  const productById = id => products.find(product => product.id === id);

  function loadCart() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || parsed.some(item =>
      !item || !productById(item.id) || !Number.isInteger(item.quantity) || item.quantity < 1
    )) {
      throw new Error(`Invalid cart data in localStorage key "${storageKey}".`);
    }
    return parsed;
  }

  let cart = loadCart();
  const saveCart = () => {
    localStorage.setItem(storageKey, JSON.stringify(cart));
    updateCartCount();
  };
  const cartCount = () => cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = () => cart.reduce((total, item) => total + productById(item.id).price * item.quantity, 0);
  const getShipping = () => cartSubtotal() === 0 || cartSubtotal() >= 50 ? 0 : 5.99;

  function updateCartCount() {
    document.querySelectorAll('[data-cart-count]').forEach(element => {
      element.textContent = String(cartCount());
    });
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    window.setTimeout(() => toast.classList.remove('visible'), 2400);
  }

  function addToCart(id, quantity = 1) {
    const product = productById(id);
    if (!product) throw new Error(`Unknown product "${id}".`);
    const existing = cart.find(item => item.id === id);
    if (existing) existing.quantity += quantity;
    else cart.push({ id, quantity });
    saveCart();
    showToast(`${product.name} added to your cart.`);
  }

  function renderProducts() {
    const grid = document.getElementById('all-products');
    if (!grid) return;
    grid.innerHTML = products.map(product => `
      <article class="product-card">
        <a class="product-visual" href="product.html?id=${encodeURIComponent(product.id)}">${product.label}</a>
        <div class="product-body">
          <div class="product-category">${product.category}</div>
          <h2><a href="product.html?id=${encodeURIComponent(product.id)}">${product.name}</a></h2>
          <p>${product.description}</p>
          <div class="product-footer">
            <span class="price">${money(product.price)}</span>
            <button class="button" type="button" data-add-product="${product.id}" data-testid="add-to-cart-${product.id}" aria-label="Add ${product.name} to cart">Add to cart</button>
          </div>
        </div>
      </article>`).join('');
  }

  function renderProductDetail() {
    const target = document.getElementById('product-detail');
    if (!target) return;
    const id = new URLSearchParams(window.location.search).get('id');
    const product = productById(id);
    if (!product) {
      target.innerHTML = '<div class="panel empty-state"><h2>Product not found</h2><p class="muted">Choose an item from the product catalog.</p><a class="button" href="products.html">Browse products</a></div>';
      return;
    }
    target.innerHTML = `
      <div class="panel detail-layout">
        <div class="product-visual">${product.label}</div>
        <div class="detail-copy">
          <div class="product-category">${product.category}</div>
          <h1>${product.name}</h1>
          <p>${product.description}</p>
          <ul>${product.details.map(detail => `<li>${detail}</li>`).join('')}</ul>
          <div class="product-footer">
            <span class="price">${money(product.price)}</span>
            <button class="button button-primary" type="button" data-add-product="${product.id}" data-testid="add-to-cart-${product.id}" aria-label="Add ${product.name} to cart">Add to cart</button>
          </div>
          <p class="muted">Free shipping on orders over $50. 30-day returns.</p>
        </div>
      </div>`;
  }

  function orderTotalsMarkup(shipping = getShipping()) {
    const subtotal = cartSubtotal();
    return `
      <div class="summary-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
      <div class="summary-line"><span>Shipping</span><strong>${shipping === 0 ? 'Free' : money(shipping)}</strong></div>
      <div class="summary-line summary-total"><span>Total</span><strong>${money(subtotal + shipping)}</strong></div>`;
  }

  function renderCart() {
    const list = document.getElementById('cart-items');
    const summary = document.getElementById('cart-summary');
    if (!list || !summary) return;
    if (cart.length === 0) {
      list.innerHTML = '<div class="panel empty-state"><h2>Your cart is empty</h2><p class="muted">Browse the catalog and add something you like.</p><a class="button button-primary" href="products.html">Browse products</a></div>';
      summary.hidden = true;
      return;
    }
    list.innerHTML = cart.map(item => {
      const product = productById(item.id);
      return `<article class="cart-row">
        <div><h2><a href="product.html?id=${encodeURIComponent(product.id)}">${product.name}</a></h2><span class="muted">${money(product.price)} each</span><br><button class="remove-link" type="button" data-remove-product="${product.id}">Remove</button></div>
        <div class="quantity-control" aria-label="Quantity for ${product.name}">
          <button type="button" data-change-quantity="${product.id}" data-delta="-1" aria-label="Decrease quantity">-</button>
          <span>${item.quantity}</span>
          <button type="button" data-change-quantity="${product.id}" data-delta="1" aria-label="Increase quantity">+</button>
        </div>
        <strong class="line-price">${money(product.price * item.quantity)}</strong>
      </article>`;
    }).join('');
    summary.hidden = false;
    summary.innerHTML = `<h2>Order summary</h2>${orderTotalsMarkup()}<p class="muted">${cartSubtotal() >= 50 ? 'Your order qualifies for free shipping.' : `Add ${money(50 - cartSubtotal())} more for free shipping.`}</p><a class="button button-primary" href="checkout.html">Continue to checkout</a>`;
  }

  function renderCheckout() {
    const summary = document.getElementById('checkout-summary');
    const form = document.getElementById('checkout-form');
    if (!summary || !form) return;
    if (cart.length === 0) {
      form.hidden = true;
      summary.innerHTML = '<div class="panel empty-state"><h2>Your cart is empty</h2><a class="button" href="products.html">Browse products</a></div>';
      return;
    }
    const renderSummary = () => {
      const shipping = form.elements.shipping.value.startsWith('Express') ? 9.99 : getShipping();
      summary.innerHTML = `<h2>Order summary</h2>${cart.map(item => {
        const product = productById(item.id);
        return `<div class="summary-line"><span>${product.name} × ${item.quantity}</span><strong>${money(product.price * item.quantity)}</strong></div>`;
      }).join('')}${orderTotalsMarkup(shipping)}`;
    };
    renderSummary();
    form.elements.shipping.addEventListener('change', renderSummary);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const orderNumber = `TB-${Date.now().toString().slice(-6)}`;
      cart = [];
      saveCart();
      form.hidden = true;
      summary.innerHTML = `<div class="panel empty-state"><h2>Order placed!</h2><p class="muted">Demo order <strong>${orderNumber}</strong> is confirmed. No payment was collected.</p><a class="button button-primary" href="products.html">Continue shopping</a></div>`;
    }, { once: true });
  }

  renderProducts();
  renderProductDetail();
  renderCart();
  renderCheckout();
  updateCartCount();

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-add-product], .btn-add');
    if (button) {
      addToCart(button.dataset.addProduct || button.dataset.product);
      if (button.matches('.btn-add')) {
        button.textContent = 'Added';
        button.classList.add('added');
        window.setTimeout(() => {
          if (!button.isConnected) return;
          button.textContent = 'Add to cart';
          button.classList.remove('added');
        }, 2000);
      }
      return;
    }
    const quantityButton = event.target.closest('[data-change-quantity]');
    if (quantityButton) {
      const item = cart.find(entry => entry.id === quantityButton.dataset.changeQuantity);
      if (!item) return;
      item.quantity += Number(quantityButton.dataset.delta);
      if (item.quantity < 1) cart = cart.filter(entry => entry !== item);
      saveCart();
      renderCart();
      return;
    }
    const removeButton = event.target.closest('[data-remove-product]');
    if (removeButton) {
      cart = cart.filter(item => item.id !== removeButton.dataset.removeProduct);
      saveCart();
      renderCart();
    }
  });
})();
