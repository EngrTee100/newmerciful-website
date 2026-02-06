// Enhanced checkout script with Payment Options (Pay Now or Pay on Delivery)
(() => {
  const API_BASE = 'http://localhost:3000'; // Change if needed
  const CART_KEY = 'mc_cart';

  const checkoutForm = document.getElementById('checkout-form');
  const cartContainer = document.getElementById('cart-container');
  const orderSummary = document.getElementById('order-summary');
  const orderResult = document.getElementById('order-result');

  function formatCurrency(n) {
    try { return '₦' + Number(n).toLocaleString(); } catch { return '₦' + n; }
  }

  function escapeHtml(s = '') {
    return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function loadProducts() {
    try { return JSON.parse(localStorage.getItem('mc_products') || '[]'); } catch { return []; }
  }

  // Render cart page
  function renderCartPage() {
    if (!cartContainer) return;
    const cart = loadCart();
    if (!cart.length) {
      cartContainer.innerHTML = '<p>Your cart is empty. <a href="merciful.html">Continue shopping</a>.</p>';
      if (orderSummary) orderSummary.innerHTML = '';
      return;
    }

    const products = loadProducts();
    cartContainer.innerHTML = '';
    let subtotal = 0;

    cart.forEach(item => {
      const p = products.find(x => x.id === item.id) || { name: item.id, price: 0, image: 'images/placeholder.png' };
      const itemTotal = (p.price || 0) * item.qty;
      subtotal += itemTotal;

      const row = document.createElement('div');
      row.className = 'cart-item';
      row.innerHTML = `
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" />
        <div style="flex:1">
          <div><strong>${escapeHtml(p.name)}</strong></div>
          <div class="muted">${formatCurrency(p.price || 0)} each</div>
          <div class="qty-controls">
            <button class="btn" data-action="dec" data-id="${item.id}">-</button>
            <span>${item.qty}</span>
            <button class="btn" data-action="inc" data-id="${item.id}">+</button>
            <button class="btn" data-action="remove" data-id="${item.id}" style="margin-left:12px">Remove</button>
          </div>
        </div>
        <div><strong>${formatCurrency(itemTotal)}</strong></div>
      `;
      cartContainer.appendChild(row);
    });

    const totalEl = document.createElement('div');
    totalEl.style.marginTop = '12px';
    totalEl.innerHTML = `<div class="muted">Subtotal:</div><h3>${formatCurrency(subtotal)}</h3>`;
    cartContainer.appendChild(totalEl);

    // Update order summary
    if (orderSummary) {
      orderSummary.innerHTML = `<div style="background:#f9f5f0;padding:12px;border-radius:8px"><strong>Order Summary</strong><br/>Items: ${cart.reduce((s,i)=>s+i.qty,0)} • Subtotal: <strong>${formatCurrency(subtotal)}</strong></div>`;
    }
  }

  // Cart quantity controls
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'inc' || action === 'dec' || action === 'remove') {
      const cart = loadCart();
      const idx = cart.findIndex(i => i.id === id);
      if (idx === -1) return;
      if (action === 'inc') cart[idx].qty += 1;
      if (action === 'dec') cart[idx].qty = Math.max(1, cart[idx].qty - 1);
      if (action === 'remove') cart.splice(idx, 1);
      saveCart(cart);
      renderCartPage();
    }
  });

  // Place order to backend
  async function placeOrder(paymentMethod) {
    const cart = loadCart();
    if (!cart.length) {
      alert('Your cart is empty.');
      return null;
    }

    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const email = document.getElementById('cust-email').value.trim();

    if (!name || !phone || !address) {
      alert('Please fill name, phone and address.');
      return null;
    }

    const items = cart.map(i => ({ product_id: i.id, qty: i.qty }));
    const products = loadProducts();
    const items_total = cart.reduce((s, it) => {
      const p = products.find(x => x.id === it.id);
      return s + (p ? p.price * it.qty : 0);
    }, 0);

    try {
      const res = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: { name, phone, address, email }, items, items_total, paymentMethod })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || res.statusText);

      // Save to local orders
      const orders = JSON.parse(localStorage.getItem('mc_orders') || '[]');
      orders.push({
        id: json.id,
        createdAt: new Date().toISOString(),
        customer: { name, phone, address, email },
        items,
        items_total,
        paymentMethod
      });
      localStorage.setItem('mc_orders', JSON.stringify(orders));

      return json;
    } catch (err) {
      console.error('Order error:', err);
      // Save locally if backend fails
      const orders = JSON.parse(localStorage.getItem('mc_orders') || '[]');
      const orderId = 'LOCAL-' + Date.now();
      orders.push({
        id: orderId,
        createdAt: new Date().toISOString(),
        customer: { name, phone, address, email },
        items,
        items_total,
        paymentMethod,
        savedLocally: true
      });
      localStorage.setItem('mc_orders', JSON.stringify(orders));
      return { id: orderId, savedLocally: true };
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    renderCartPage();
  });

  // Checkout form with payment option handling
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'cod';

      if (paymentMethod === 'cod') {
        // Pay on Delivery
        const order = await placeOrder('cod');
        if (order) {
          localStorage.removeItem(CART_KEY);
          if (orderResult) {
            orderResult.innerHTML = `<div style="background:#d1fae5;padding:12px;border-radius:8px;color:#065f46"><strong>✓ Order placed successfully!</strong><br/>Order ID: <strong>${escapeHtml(order.id)}</strong><br/>Payment method: Pay on Delivery<br/>We will contact you at ${escapeHtml(document.getElementById('cust-phone').value)} to confirm delivery.</div>`;
          }
          checkoutForm.reset();
          setTimeout(() => renderCartPage(), 500);
        }
      } else if (paymentMethod === 'online') {
        // Pay Now via Paystack
        const email = document.getElementById('cust-email').value.trim();
        if (!email) {
          alert('Email is required for online payment.');
          return;
        }

        const order = await placeOrder('paystack');
        if (order) {
          // Redirect to payment initiation
          try {
            const payRes = await fetch(`${API_BASE}/api/payments/initiate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: order.id, email })
            });
            const payJson = await payRes.json();
            if (!payRes.ok) throw new Error(payJson.error || 'Payment initiation failed');

            // Redirect to Paystack
            if (payJson.authorization_url) {
              window.location.href = payJson.authorization_url;
            } else {
              alert('Payment gateway not configured. Defaulting to Pay on Delivery.');
            }
          } catch (err) {
            console.error(err);
            alert('Could not initiate payment: ' + err.message + '\n\nOrder saved. Please contact us.');
          }
        }
      }
    });
  }

  // Expose to global scope for testing
  window.checkoutModule = { renderCartPage, placeOrder };
})();
