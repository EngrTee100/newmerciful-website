// Frontend script for MERCIFUL CRUNCHY (checkout updated to support Paystack "Pay Now")
// Put this in public/script.js (replaces previous script.js). Uses relative API endpoints.
// Note: for Paystack to work you need PAYSTACK_SECRET_KEY set on the server.
// This script will:
// - Create orders via POST /api/orders
// - For "Pay Now": call POST /api/payments/initiate and redirect the user to Paystack
// - After payment Paystack redirects to /payment-success.html with ?reference=... which verifies it

(() => {
  const API_BASE = ''; // same origin
  const CART_KEY = 'mc_cart';

  const productGrid = document.getElementById('product-grid');
  const cartCountEl = document.getElementById('cart-count');
  const cartContainer = document.getElementById('cart-container');
  const orderSummary = document.getElementById('order-summary');
  const checkoutForm = document.getElementById('checkout-form');
  const orderResult = document.getElementById('order-result');

  function formatCurrency(n) { try { return '₦' + Number(n).toLocaleString(); } catch { return '₦' + n; } }
  function escapeHtml(s = '') { return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function loadCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } }
  function saveCart(cart) { localStorage.setItem(CART_KEY, JSON.stringify(cart)); updateCartCount(); }
  function updateCartCount() { if (!cartCountEl) return; const cart = loadCart(); const count = cart.reduce((s, i) => s + i.qty, 0); cartCountEl.textContent = String(count); }

  // Render cart items
  function renderCartPage() {
    if (!cartContainer) return;
    const cart = loadCart();
    if (!cart.length) {
      cartContainer.innerHTML = '<p>Your cart is empty. <a href="merciful.html">Continue shopping</a>.</p>';
      if (orderSummary) orderSummary.innerHTML = '';
      return;
    }
    // Products come from localProducts (if present) or placeholders
    const products = JSON.parse(localStorage.getItem('mc_products') || '[]');
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
    if (orderSummary) orderSummary.innerHTML = `<p>Items: ${cart.reduce((s,i)=>s+i.qty,0)} • Subtotal: ${formatCurrency(subtotal)}</p>`;
  }

  // Buttons on cart page
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (!action) return;

    const cart = loadCart();
    const idx = cart.findIndex(i => i.id === id);

    if (action === 'inc' && idx !== -1) { cart[idx].qty += 1; saveCart(cart); renderCartPage(); }
    if (action === 'dec' && idx !== -1) { cart[idx].qty = Math.max(1, cart[idx].qty - 1); saveCart(cart); renderCartPage(); }
    if (action === 'remove' && idx !== -1) { cart.splice(idx, 1); saveCart(cart); renderCartPage(); }
  });

  // Utility to create order on server
  async function createOrderOnServer(customer, items, paymentMethod = 'whatsapp_cash') {
    const resp = await fetch(`${API_BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer, items, paymentMethod })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || resp.statusText);
    return json; // contains id, createdAt, total, message
  }

  // Redirect to WhatsApp for payment
  function redirectToWhatsApp(orderId, customerName, total, paymentType = 'online', cartItems = [], customerPhone = '', customerEmail = '', customerAddress = '') {
    // Replace with your WhatsApp business number (with country code, no spaces or +)
    const whatsappNumber = '2349037464756'; // Update this with your WhatsApp number
    
    // Build product list from cart items
    const products = JSON.parse(localStorage.getItem('mc_products') || '[]');
    let productsList = '';
    if (cartItems && cartItems.length > 0) {
      productsList = '\n📦 *Items Ordered:*\n';
      cartItems.forEach((cartItem, idx) => {
        const product = products.find(p => p.id === cartItem.id);
        if (product) {
          const itemPrice = product.price * cartItem.qty;
          productsList += `${idx + 1}. ${product.name}\n   Description: ${product.description}\n   Qty: ${cartItem.qty} | Price: ₦${itemPrice.toLocaleString()}\n\n`;
        }
      });
    }

    // Build customer delivery information
    let customerInfo = '';
    if (customerPhone || customerEmail || customerAddress) {
      customerInfo = '\n👤 *Delivery Information:*\n';
      if (customerPhone) customerInfo += `Phone: ${customerPhone}\n`;
      if (customerEmail) customerInfo += `Email: ${customerEmail}\n`;
      if (customerAddress) customerInfo += `Address: ${customerAddress}\n`;
    }
    
    let message;
    if (paymentType === 'cash') {
      // Cash payment message - customer tells what they want
      message = encodeURIComponent(
        `Hello! I would like to place an order and pay via cash.\n\n` +
        `Order ID: ${orderId}\n` +
        `Customer Name: ${customerName}` +
        productsList +
        customerInfo +
        `💰 *Total Amount: ₦${total.toLocaleString()}*\n\n` +
        `Please let me know the best way to arrange payment and delivery.`
      );
    } else {
      // Online/Direct payment message
      message = encodeURIComponent(
        `Hello! I would like to complete my payment now.\n\n` +
        `Order ID: ${orderId}\n` +
        `Customer Name: ${customerName}` +
        productsList +
        customerInfo +
        `💰 *Total Amount: ₦${total.toLocaleString()}*\n\n` +
        `Please confirm and provide payment details.`
      );
    }
    
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  }

  // Initiate payment with server -> Paystack
  async function initiatePayment(orderId, email) {
    const resp = await fetch(`${API_BASE}/api/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, email })
    });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || JSON.stringify(json));
    return json; // { authorization_url, reference }
  }

  // Form handling:
  if (checkoutForm) {
    // Place order via WhatsApp Cash (submit)
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handlePlaceOrder({ paymentMethod: 'whatsapp_cash' });
    });

    // Pay now via WhatsApp button
    const payNowBtn = document.getElementById('pay-now');
    if (payNowBtn) {
      payNowBtn.addEventListener('click', async () => {
        await handlePlaceOrder({ paymentMethod: 'whatsapp_online' });
      });
    }
  }

  async function handlePlaceOrder({ paymentMethod }) {
    const cart = loadCart();
    if (!cart.length) { alert('Your cart is empty.'); return; }

    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();
    const email = document.getElementById('cust-email').value.trim();

    if (!name || !phone || !address) { alert('Please fill name, phone and address.'); return; }

    const items = cart.map(i => ({ product_id: i.id, qty: i.qty }));

    try {
      // 1) create order on server
      const orderResp = await createOrderOnServer({ name, phone, address, email }, items, paymentMethod);
      const orderId = orderResp.id;
      const total = orderResp.total;

      // Both payment methods redirect to WhatsApp
      try {
        // Clear cart before redirect
        localStorage.removeItem(CART_KEY);
        updateCartCount();
        
        // Show confirmation message
        if (orderResult) orderResult.innerHTML = `<strong>Order placed!</strong> Your order number is <em>${escapeHtml(orderId)}</em>. Opening WhatsApp for payment...`;
        
        // Redirect to WhatsApp
        setTimeout(() => {
          const payType = paymentMethod === 'whatsapp_cash' ? 'cash' : 'online';
          redirectToWhatsApp(orderId, name, total, payType, cart, phone, email, address);
        }, 1000);
        
        return;
      } catch (payErr) {
        console.error('Payment redirection failed', payErr);
        alert('Could not open WhatsApp: ' + (payErr.message || payErr));
        // fallback: show order placed message (order exists but unpaid)
        if (orderResult) orderResult.innerHTML = `Order placed. Order ID: ${escapeHtml(orderId)}. Please contact us on WhatsApp to complete payment.`;
      }

    } catch (err) {
      console.error('Order error', err);
      alert('Could not place order: ' + (err.message || err));
    }
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    renderCartPage();
  });
})();