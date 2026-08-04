import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Minus, Trash2, ShoppingBag, ShoppingCart, Copy, Check, X, ArrowLeft, Lock, CreditCard, Wallet, Smartphone, Banknote, Menu, Download, Share } from 'lucide-react';
import logoImg from './assets/logo-horizontal.png';

import { API_URL } from './config/api';
import OrderTracker from './components/OrderTracker';
import { DeliveryAddressPicker } from '@distrito/shared-ui';
import { applyWebTheme } from './utils/theme';

function announcementStorageKey(announcement) {
  return `distrito_announcement_${announcement.id}_${announcement.updated_at || 'current'}`;
}

function colombiaDay() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function shouldShowAnnouncement(announcement) {
  if (!announcement?.is_active || announcement.is_visible === false) return false;
  const key = announcementStorageKey(announcement);
  if (announcement.display_frequency === 'always') return true;
  if (announcement.display_frequency === 'daily') return localStorage.getItem(key) !== colombiaDay();
  return sessionStorage.getItem(key) !== 'seen';
}

function markAnnouncementSeen(announcement) {
  if (!announcement) return;
  const key = announcementStorageKey(announcement);
  if (announcement.display_frequency === 'daily') localStorage.setItem(key, colombiaDay());
  else if (announcement.display_frequency !== 'always') sessionStorage.setItem(key, 'seen');
}

function trackingOrderFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('pedido'));
  const token = params.get('seguimiento') || '';
  return Number.isInteger(id) && id > 0 && token ? { id, token, fromLink: true } : null;
}

function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [cart, setCart] = useState([]);
  
  // Data from Backend
  const [products, setProducts] = useState([]);
  const [categoriesData, setCategoriesData] = useState([]);
  const [settings, setSettings] = useState({ whatsapp_number: '', nequi_number: '', bancolombia_number: '' });
  const [loading, setLoading] = useState(true);

  // UI State
  const [checkoutStep, setCheckoutStep] = useState(1); // 1 = Cart, 2 = Checkout Form
  const [isCartOpenMobile, setIsCartOpenMobile] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [horariosStatus, setHorariosStatus] = useState({ isOpen: false, statusText: 'Consultando horario…' });
  const [isTrackingOpen, setIsTrackingOpen] = useState(() => Boolean(trackingOrderFromUrl()));
  const [latestOrder, setLatestOrder] = useState(() => {
    try { return trackingOrderFromUrl() || JSON.parse(localStorage.getItem('distrito_latest_order') || 'null'); } catch { return null; }
  });
  
  // Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detect iOS and Android
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isAndroidDevice = /android/.test(userAgent);
    const isStandalone = ('standalone' in window.navigator) && window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
      setShowInstallBanner(true);
    }

    if (isAndroidDevice && !isStandalone) {
      setIsAndroid(true);
      setShowInstallBanner(true); // Force show on Android even if beforeinstallprompt fails (HTTP network)
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback para Android en red local HTTP (no permite prompt nativo)
      alert('Para instalar la App: Abre el menú de Chrome (los 3 puntitos arriba a la derecha) y toca "Agregar a la pantalla principal".');
    }
  };

  const [ratedProducts, setRatedProducts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('distrito_rated_products') || '[]');
    } catch {
      return [];
    }
  });

  const handleRateProduct = async (productId, rating) => {
    if (ratedProducts.includes(productId)) return;

    try {
      // Optimistic UI update
      setProducts(prev => prev.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            rating_sum: (p.rating_sum || 0) + rating,
            rating_count: (p.rating_count || 0) + 1
          };
        }
        return p;
      }));

      const newRated = [...ratedProducts, productId];
      setRatedProducts(newRated);
      localStorage.setItem('distrito_rated_products', JSON.stringify(newRated));

      await fetch(`${API_URL}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, rating })
      });
    } catch (err) {
      console.error('Error rating product', err);
    }
  };

  // Form State
  const [customer, setCustomer] = useState({ 
    name: '', 
    phone: '', 
    address: '',
    barrio: '',
    reference: '',
    apartment: '',
    tower: '',
    floor: '',
    latitude: null,
    longitude: null,
    placeId: '',
    locationAdjusted: false,
    locationConfirmed: false,
    comment: '',
    deliveryType: 'domicilio',
    paymentMethod: 'efectivo',
    cashAmount: '',
    transferBank: 'nequi' // 'nequi' | 'banco'
  });
  const [mapsAvailable, setMapsAvailable] = useState(
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY ? null : false
  );

  const updateDeliveryLocation = (changes) => {
    setCustomer((current) => ({ ...current, ...changes }));
  };

  const [copiedNequi, setCopiedNequi] = useState(false);
  const [copiedBanco, setCopiedBanco] = useState(false);

  useEffect(() => {
    const refreshSchedule = () => fetch(`${API_URL}/horarios/status`)
      .then(res => res.json()).then(data => setHorariosStatus(data))
      .catch(() => setHorariosStatus({ isOpen: false, statusText: 'No fue posible validar el horario' }));
    refreshSchedule();
    const scheduleTimer = setInterval(refreshSchedule, 60_000);

    fetch(`${API_URL}/init`)
      .then(res => res.json())
      .then(data => {
        if(data.status === 'ok') {
          setProducts(data.products || []);
          if (data.categories) {
            setCategoriesData(data.categories);
          }
          setSettings(data.settings || {});
          applyWebTheme(data.settings || {});
          setCustomer((current) => ({
            ...current,
            paymentMethod: data.settings?.payment_efectivo === false ? 'transferencia' : current.paymentMethod,
            transferBank: data.settings?.payment_nequi === false ? 'banco' : current.transferBank,
          }));
          if (shouldShowAnnouncement(data.announcement)) {
            setAnnouncement(data.announcement);
            setIsAnnouncementOpen(true);
          }
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching data:', err);
        setLoading(false);
      });
    return () => clearInterval(scheduleTimer);
  }, []);

  useEffect(() => {
    if (latestOrder && sessionStorage.getItem('distrito_open_tracking_after_whatsapp') === 'true') {
      sessionStorage.removeItem('distrito_open_tracking_after_whatsapp');
      setIsTrackingOpen(true);
    }
  }, [latestOrder]);

  useEffect(() => {
    const registerPush = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          if (Notification.permission === 'granted') {
            const subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: 'BBCJtzBn22IJcujyWlCCwtSAyWLfsiELTqWAjQcEiOuPX0yiad9P5LIpMJv5T8VwkHJU0vxLHTqFYImzLYWBQyU'
            });
            await fetch(`${API_URL}/push/subscribe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ subscription })
            });
          } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: 'BBCJtzBn22IJcujyWlCCwtSAyWLfsiELTqWAjQcEiOuPX0yiad9P5LIpMJv5T8VwkHJU0vxLHTqFYImzLYWBQyU'
              });
              await fetch(`${API_URL}/push/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription })
              });
            }
          }
        } catch (error) {
          console.error('Error Push:', error);
        }
      }
    };
    registerPush();
  }, []);

  const categories = useMemo(() => {
    let baseCategories = [];
    
    // Icono para la categoría "Todos"
    const allCategory = { id: 'all', name: 'Todos', iconStr: '📋' };
    
    // Categoría "Destacados"
    const hasFeatured = products.some(p => p.is_featured);
    const featuredCategory = hasFeatured ? { id: 'featured', name: 'Destacados', iconStr: '⭐' } : null;

    if (categoriesData.length > 0) {
      baseCategories = categoriesData.map(c => ({ id: c.name, name: c.name, iconStr: c.image }));
    } else {
      const cats = new Set(products.map(p => p.category));
      baseCategories = Array.from(cats).map(c => ({ id: c, name: c, iconStr: '🏷️' }));
    }

    if (featuredCategory) {
      return [allCategory, featuredCategory, ...baseCategories];
    }
    return [allCategory, ...baseCategories];
  }, [products, categoriesData]);

  const filteredProducts = useMemo(() => {
    if (activeCategory === 'all') return products;
    if (activeCategory === 'featured') return products.filter(p => p.is_featured);
    return products.filter(p => p.category === activeCategory);
  }, [activeCategory, products]);

  const addToCart = (product) => {
    if (product.track_stock && Number(product.stock) <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        if (item.track_stock && newQty > Number(item.stock || 0)) return item;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }).filter(item => item.qty > 0)); // also remove if 0
  };

  const removeItem = (id) => setCart(prev => prev.filter(item => item.id !== id));

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const cartTotalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const formatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'nequi') { setCopiedNequi(true); setTimeout(() => setCopiedNequi(false), 2000); }
    if (type === 'banco') { setCopiedBanco(true); setTimeout(() => setCopiedBanco(false), 2000); }
  };

  const handleCheckout = async (e) => {
    if (e) e.preventDefault();
    if (cart.length === 0) {
      alert("Tu carrito está vacío.");
      return;
    }
    if (!horariosStatus?.isOpen) {
      alert(`No podemos recibir el pedido: ${horariosStatus?.statusText || 'restaurante cerrado'}.`);
      return;
    }
    if (!customer.name || !customer.phone) {
      alert("Por favor ingresa nombre y teléfono.");
      return;
    }
    if (customer.deliveryType === 'domicilio' && (!customer.address || !customer.barrio)) {
      alert("Por favor ingresa la dirección y el barrio para el domicilio.");
      return;
    }
    if (customer.deliveryType === 'domicilio' && mapsAvailable !== false
        && (!customer.locationConfirmed || customer.latitude == null || customer.longitude == null)) {
      alert("Selecciona una sugerencia, ajusta el marcador si hace falta y confirma la ubicación.");
      return;
    }
    if (customer.paymentMethod === 'efectivo' && !customer.cashAmount) {
      alert("Por favor ingresa con cuánto vas a pagar.");
      return;
    }

    let whatsappWindow = null;
    try {
      whatsappWindow = window.open('about:blank', 'distrito-order-whatsapp');
      if (whatsappWindow) whatsappWindow.opener = null;
    } catch {
      whatsappWindow = null;
    }
    
    setLoading(true);
    const phoneNumber = settings.whatsapp_number || "573000000000";
    
    let dbOrderId = null;
    let orderNumber = "0000";
    let trackingToken = '';

    try {
      // 1. Enviar la orden al backend (Dashboard CRM/Ventas) y obtener el ID
      const res = await fetch(`${API_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          cart: cart.map(({ id, quantity, qty }) => ({ id, quantity: quantity || qty || 1 }))
        })
      });
      const data = await res.json();
      if (!res.ok || data.status !== 'ok' || !data.order_id) {
        if (data.schedule) setHorariosStatus(data.schedule);
        throw new Error(data.error || data.message || 'El pedido no pudo ser confirmado');
      }
      dbOrderId = data.order_id;
      orderNumber = String(dbOrderId).padStart(4, '0');
      trackingToken = data.tracking_token || '';
      if (!trackingToken) throw new Error('No fue posible generar el seguimiento temporal del pedido');
    } catch (error) {
      whatsappWindow?.close();
      setLoading(false);
      alert(error.message || 'No fue posible confirmar el pedido. No se realizó ningún cobro ni reserva.');
      return;
    }

    const trackingUrlObject = new URL(window.location.origin);
    trackingUrlObject.searchParams.set('pedido', dbOrderId);
    trackingUrlObject.searchParams.set('seguimiento', trackingToken);
    const trackingUrl = trackingUrlObject.toString();

    let message = `*NUEVA ORDEN (#${orderNumber})*\n`;
    
    if (customer.deliveryType === 'domicilio') {
      message += `Hola Distrito BG soy ${customer.name}, me gustaría hacer un pedido\n\n`;
      message += `*Cliente:* ${customer.name}\n`;
      message += `*Teléfono:* ${customer.phone}\n`;
      message += `*Entrega:* 🛵 A Domicilio\n`;
      message += `*Dirección:* ${customer.address}\n`;
      message += `*Barrio:* ${customer.barrio}\n`;
      message += `*Seguimiento temporal:* ${trackingUrl}\n\n`;
      if (customer.apartment) message += `*Apartamento:* ${customer.apartment}\n`;
      if (customer.tower) message += `*Torre:* ${customer.tower}\n`;
      if (customer.floor) message += `*Piso:* ${customer.floor}\n`;
      if (customer.latitude != null && customer.longitude != null) {
        message += `*Ubicación exacta:* https://www.google.com/maps?q=${customer.latitude},${customer.longitude}\n\n`;
      }
    } else {
      message += `Hola Distrito BG soy ${customer.name}, me gustaría hacer un pedido para recoger en el local\n\n`;
      message += `*Cliente:* ${customer.name}\n`;
      message += `*Teléfono:* ${customer.phone}\n`;
      message += `*Entrega:* 🏪 Recoger Local\n\n`;
    }
    
    message += `*Detalle del pedido:*\n`;
    cart.forEach(item => {
      message += `- ${item.qty}x ${item.title} (${formatter.format(item.price * item.qty)})\n`;
    });
    
    if (customer.comment) {
      message += `*Comentarios:* ${customer.comment}\n`;
    }
    if (customer.reference) {
      message += `*Referencia:* ${customer.reference}\n`;
    }
    
    message += `\n*Medio de Pago:* ${customer.paymentMethod === 'efectivo' ? '💵 Efectivo' : '💳 Transferencia'}\n`;
    
    if (customer.paymentMethod === 'efectivo') {
      message += `*Paga con:* ${formatter.format(customer.cashAmount)}\n`;
      const change = customer.cashAmount - subtotal;
      message += `*Cambio sugerido:* ${change > 0 ? formatter.format(change) : '$0'}\n`;
    } else {
      const isNequi = customer.transferBank === 'nequi';
      message += `*Banco:* ${isNequi ? 'Nequi' : 'Llave Bre-B'}\n`;
      message += `*Número de cuenta:* ${isNequi ? settings.nequi_number : settings.bancolombia_number}\n`;
    }

    message += `*Total a pagar:* ${formatter.format(subtotal)}\n`;
    message += `¡Gracias.`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    
    const tracking = { id: dbOrderId, phone: customer.phone, token: trackingToken };
    localStorage.setItem('distrito_latest_order', JSON.stringify(tracking));
    setLatestOrder({ ...tracking, whatsappUrl });
    setCart([]);
    setCheckoutStep(1);
    setIsCartOpenMobile(false);
    setIsTrackingOpen(true);
    setLoading(false);
    if (whatsappWindow) {
      whatsappWindow.location.replace(whatsappUrl);
      whatsappWindow.focus();
    } else {
      sessionStorage.setItem('distrito_open_tracking_after_whatsapp', 'true');
      window.location.assign(whatsappUrl);
    }
  };
  const isOpen = Boolean(horariosStatus?.isOpen);
  const scheduleText = horariosStatus?.currentSchedule
    ? `${String(horariosStatus.currentSchedule.open_time || '').slice(0, 5)}–${String(horariosStatus.currentSchedule.close_time || '').slice(0, 5)}`
    : horariosStatus?.statusText;

  if (loading) {
    return (
      <div className="global-loader-container">
        <img src={logoImg} alt="Distrito BG" className="loader-logo" />
        <div className="professional-spinner"></div>
        <p>Cargando menú...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Botón flotante estilo barra para móviles */}
      {cartTotalItems > 0 && !isCartOpenMobile && (
        <div className="mobile-cart-bar" onClick={() => setIsCartOpenMobile(true)}>
          <div className="mobile-cart-bar-items">
            <span className="badge-count">{cartTotalItems}</span>
          </div>
          <span className="mobile-cart-bar-text">Ver pedido</span>
          <span className="mobile-cart-bar-total">{formatter.format(subtotal)}</span>
        </div>
      )}

      {/* Main Area */}
      <main className="main-content">
        {/* Top Navbar */}
        <nav className="top-navbar">
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu size={24} color="white" />
          </button>
          
          <div className="nav-logo">
            <img src={settings.logo || logoImg} alt={settings.restaurant_name || 'Distrito BG'} />
          </div>
          
          <div className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
            <a href="#" className="active" onClick={() => setIsMobileMenuOpen(false)}>INICIO</a>
            <a href="#" onClick={() => setIsMobileMenuOpen(false)}>MENÚ</a>
            <a href="#" onClick={() => setIsMobileMenuOpen(false)}>PROMOCIONES</a>
            <button className="tracking-nav-button" onClick={() => { setIsMobileMenuOpen(false); setIsTrackingOpen(true); }}>SEGUIR PEDIDO</button>
          </div>
          
          <div className="nav-status">
            <div className="status-indicator">
              <span className="dot" style={{ backgroundColor: isOpen ? '#4ade80' : '#ff4757' }}></span>
              <div className="status-text-row">
                <strong>{isOpen ? 'Abierto' : 'Cerrado'}</strong>
                <span>{scheduleText}</span>
              </div>
            </div>
            <button className="desktop-cart-icon" onClick={() => setIsCartOpenMobile(true)}>
              <ShoppingCart size={20} color="white" />
              {cartTotalItems > 0 && <span className="badge">{cartTotalItems}</span>}
            </button>
          </div>
        </nav>

        {/* Hero Banner */}
        <section className="hero-banner">
          <div className="hero-content">
            <h1>{settings.restaurant_name || 'DISTRITO BG'}<br/><span className="highlight">MÁS QUE COMIDA,</span><br/>UNA EXPERIENCIA</h1>
            {settings.welcome_message && <p className="hero-welcome">{settings.welcome_message}</p>}
            <div className="hero-features">
              <div className="feature"><span className="icon">🐄</span> CARNE<br/>100% RES</div>
              <div className="feature"><span className="icon">🥬</span> INGREDIENTES<br/>FRESCOS</div>
              <div className="feature"><span className="icon">🔥</span> PREPARACIÓN<br/>AL MOMENTO</div>
            </div>
            <button className="hero-btn">ORDENAR AHORA ➔</button>
          </div>
        </section>

        <h2 className="section-title">NUESTRO MENÚ</h2>

        <div className="shop-layout">
          <div className="shop-products">
            {/* Categories */}
            <div className="categories">
          {categories.map(cat => {
            return (
              <button 
                key={cat.id} 
                className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                <span className="cat-icon">{cat.iconStr || '🍔'}</span>
                {cat.name.toUpperCase()}
              </button>
            )
          })}
        </div>

        {/* Product Grid */}
        <div className="product-grid">
          {filteredProducts.map(product => {
            const cartItem = cart.find(i => i.id === product.id);
            const soldOut = product.track_stock && Number(product.stock) <= 0;
            return (
              <div key={product.id} className={`product-card ${soldOut ? 'sold-out' : ''}`}>
                <div className="product-image-container">
                  {product.image ? (
                    <img src={product.image} alt={product.title} className="product-image" loading="lazy" decoding="async" />
                  ) : (
                    <div className="product-placeholder">Sin Imagen</div>
                  )}
                  {soldOut && <span className="sold-out-label">AGOTADO</span>}
                </div>
                <div className="product-info">
                  <h3 className="product-title">{product.title}</h3>
                  <div className="product-rating">
                    <span className="stars">
                      {[1, 2, 3, 4, 5].map(star => {
                        const avg = product.rating_count ? (product.rating_sum / product.rating_count) : 0;
                        const isFilled = star <= Math.round(avg);
                        const canRate = !ratedProducts.includes(product.id);
                        return (
                          <span 
                            key={star} 
                            onClick={() => canRate && handleRateProduct(product.id, star)}
                            className={canRate ? "interactive-star" : ""}
                            style={{ 
                              color: isFilled ? '#D4A017' : '#555', 
                              cursor: canRate ? 'pointer' : 'default',
                              fontSize: '18px',
                              display: 'inline-block'
                            }}
                          >
                            ★
                          </span>
                        );
                      })}
                    </span>
                    <span className="rating-count">({product.rating_count || 0})</span>
                  </div>
                  <p className="product-desc">{product.description}</p>
                  <div className="product-footer">
                    <span className="product-price">{formatter.format(product.price)}</span>
                    {cartItem ? (
                      <div className="product-qty-controls">
                        <button className="qty-btn-sm" onClick={() => updateQty(product.id, -1)}><Minus size={16}/></button>
                        <span className="qty-text">{cartItem.qty}</span>
                        <button className="qty-btn-sm" onClick={() => updateQty(product.id, 1)}><Plus size={16}/></button>
                      </div>
                    ) : (
                      <button className="add-btn" onClick={() => addToCart(product)} disabled={soldOut || !isOpen}>
                        {soldOut ? 'AGOTADO' : !isOpen ? 'FUERA DE HORARIO' : '+ AGREGAR'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="no-products">No hay productos en esta categoría.</div>
          )}
        </div>

        {/* Why Choose Us Section */}
        <section className="why-choose-us">
          <h2 className="why-title">¿Por qué elegir Distrito BG?</h2>
          <p className="why-subtitle">Ofrecemos la mejor experiencia en cada bocado, con ingredientes de alta calidad y un servicio inigualable.</p>
          <div className="why-grid">
            <div className="why-card">
              <div className="why-icon">🐄</div>
              <h3 className="why-card-title">Carne 100% Res</h3>
              <p className="why-card-desc">Seleccionamos cortes de primera calidad para garantizar el mejor sabor y textura en cada hamburguesa.</p>
            </div>
            <div className="why-card">
              <div className="why-icon">🥬</div>
              <h3 className="why-card-title">Ingredientes Frescos</h3>
              <p className="why-card-desc">Vegetales frescos y pan artesanal horneado a diario para crear la combinación perfecta.</p>
            </div>
            <div className="why-card">
              <div className="why-icon">🔥</div>
              <h3 className="why-card-title">Preparación al Momento</h3>
              <p className="why-card-desc">Cada pedido se prepara al instante para asegurar frescura, jugosidad y temperatura ideal.</p>
            </div>
            <div className="why-card">
              <div className="why-icon">🛵</div>
              <h3 className="why-card-title">Entrega Rápida</h3>
              <p className="why-card-desc">Llevamos tu comida caliente y en tiempo récord directo a la puerta de tu casa.</p>
            </div>
          </div>
        </section>
        <section className="storefront-info"><div><strong>{settings.restaurant_name || 'Distrito BG'}</strong><p>{settings.description || 'Pedidos preparados al momento.'}</p></div><div><span>{settings.address || 'Dirección por confirmar'}</span><a href={`tel:${settings.phone || settings.whatsapp_number || ''}`}>{settings.phone || settings.whatsapp_number || 'Contacto por WhatsApp'}</a><a href={`mailto:${settings.email || ''}`}>{settings.email || ''}</a></div></section>
          </div>

      {/* Sidebar / Cart Overlay para móviles */}
      <div className={`cart-overlay ${isCartOpenMobile ? 'open' : ''}`} onClick={() => setIsCartOpenMobile(false)}></div>

      <div className="sidebar-wrapper">
        <aside className={`cart-sidebar ${isCartOpenMobile ? 'open' : ''}`}>
          <div className="cart-header">
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            {checkoutStep === 2 && (
              <button className="back-btn" onClick={() => setCheckoutStep(1)}>
                <ArrowLeft size={20} />
              </button>
            )}
            <h2>{checkoutStep === 1 ? '🛒 Tu Pedido' : 'Datos de Envío'}</h2>
            {checkoutStep === 1 && <span className="cart-count">{cartTotalItems}</span>}
          </div>
          <button className="close-cart-btn" onClick={() => setIsCartOpenMobile(false)}>
            <X size={24} />
          </button>
        </div>

        <div className="cart-content-scroll">
          {checkoutStep === 1 ? (
            <div className="cart-items">
              {cart.length === 0 ? (
                <div className="empty-cart">
                  <ShoppingCart size={48} opacity={0.3} />
                  <p>Tu carrito está vacío. ¡Agrega algunos productos!</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="cart-item">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="cart-item-img" loading="lazy" decoding="async" />
                    ) : (
                      <div className="cart-item-img placeholder"></div>
                    )}
                    <div className="cart-item-details">
                      <h4 className="cart-item-title">{item.title}</h4>
                      <p className="cart-item-price">{formatter.format(item.price)}</p>
                      <div className="cart-item-actions">
                        <div className="cart-qty-pill">
                          <button className="qty-btn" onClick={() => updateQty(item.id, -1)}><Minus size={14} /></button>
                          <span className="qty">{item.qty}</span>
                          <button className="qty-btn" onClick={() => updateQty(item.id, 1)}><Plus size={14} /></button>
                        </div>
                        <button className="delete-btn" onClick={() => removeItem(item.id)}><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="customer-form">
              <h3 className="form-section-title">Datos del Cliente</h3>
              <div className="form-group">
                <input type="text" className="form-input" placeholder="Nombre y Apellido" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
              </div>
              <div className="form-group">
                <input type="tel" className="form-input" placeholder="Teléfono (WhatsApp)" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} />
              </div>

              {!horariosStatus?.isOpen && (
                <div style={{ backgroundColor: '#EF4444', color: '#FFF', padding: '16px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center', fontWeight: '600' }}>
                  Actualmente estamos cerrados. {horariosStatus?.currentSchedule ? `Nuestro horario hoy es de ${horariosStatus.currentSchedule.open_time} a ${horariosStatus.currentSchedule.close_time}.` : 'No hay atención el día de hoy.'}
                </div>
              )}

              <h3 className="form-section-title">Forma de Entrega</h3>
              <div className="radio-group">
                <label className="radio-label">
                  <input type="radio" name="deliveryType" checked={customer.deliveryType === 'domicilio'} onChange={() => setCustomer({...customer, deliveryType: 'domicilio'})} />
                  A Domicilio
                </label>
                <label className="radio-label">
                  <input type="radio" name="deliveryType" checked={customer.deliveryType === 'recoger'} onChange={() => setCustomer({...customer, deliveryType: 'recoger'})} />
                  Recoger Local
                </label>
              </div>

              {customer.deliveryType === 'domicilio' && (
                <>
                  <DeliveryAddressPicker
                    value={customer}
                    onChange={updateDeliveryLocation}
                    onAvailabilityChange={setMapsAvailable}
                    apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}
                    mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
                  />
                  <div className="form-group">
                    <label htmlFor="delivery-barrio">Barrio</label>
                    <input id="delivery-barrio" type="text" className="form-input" placeholder="Barrio" value={customer.barrio} onChange={e => setCustomer({...customer, barrio: e.target.value})} />
                  </div>
                  <div className="delivery-details-grid">
                    <div className="form-group">
                      <label htmlFor="delivery-apartment">Apartamento</label>
                      <input id="delivery-apartment" type="text" className="form-input" placeholder="Ej. 302" value={customer.apartment} onChange={e => setCustomer({...customer, apartment: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="delivery-tower">Torre</label>
                      <input id="delivery-tower" type="text" className="form-input" placeholder="Ej. 2" value={customer.tower} onChange={e => setCustomer({...customer, tower: e.target.value})} />
                    </div>
                    <div className="form-group">
                      <label htmlFor="delivery-floor">Piso</label>
                      <input id="delivery-floor" type="text" className="form-input" placeholder="Ej. 3" value={customer.floor} onChange={e => setCustomer({...customer, floor: e.target.value})} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label htmlFor="delivery-reference">Referencia</label>
                    <textarea id="delivery-reference" className="form-input delivery-reference-input" placeholder="Ej. portón negro, casa azul, frente al parque" value={customer.reference} onChange={e => setCustomer({...customer, reference: e.target.value})} />
                  </div>
                </>
              )}

              <div className="form-group">
                <input type="text" className="form-input" placeholder="Comentario (opcional)" value={customer.comment} onChange={e => setCustomer({...customer, comment: e.target.value})} />
              </div>

              <h3 className="form-section-title">Forma de Pago</h3>
              <div className="radio-group">
                {settings.payment_efectivo !== false && <label className="radio-label">
                  <input type="radio" name="payment" checked={customer.paymentMethod === 'efectivo'} onChange={() => setCustomer({...customer, paymentMethod: 'efectivo'})} />
                  Efectivo
                </label>}
                {(settings.payment_nequi || settings.payment_daviplata || settings.payment_transferencia || settings.payment_pse) && <label className="radio-label">
                  <input type="radio" name="payment" checked={customer.paymentMethod === 'transferencia'} onChange={() => setCustomer({...customer, paymentMethod: 'transferencia'})} />
                  Transferencia
                </label>}
              </div>

              {customer.paymentMethod === 'efectivo' && (
                <div className="form-group animate-in fade-in">
                  <input type="number" className="form-input" placeholder="¿Con cuánto vas a pagar?" value={customer.cashAmount} onChange={e => setCustomer({...customer, cashAmount: e.target.value})} />
                </div>
              )}

              {customer.paymentMethod === 'transferencia' && (
                <div className="transfer-info animate-in fade-in">
                  <p className="transfer-desc" style={{marginBottom: '10px', fontWeight: 'bold'}}>Selecciona el banco al que transferiste:</p>
                  
                  <div className="radio-group" style={{marginBottom: '15px'}}>
                    {settings.payment_nequi !== false && <label className="radio-label">
                      <input type="radio" name="transferBank" checked={customer.transferBank === 'nequi'} onChange={() => setCustomer({...customer, transferBank: 'nequi'})} />
                      Nequi
                    </label>}
                    {(settings.payment_transferencia || settings.bancolombia_number) && <label className="radio-label">
                      <input type="radio" name="transferBank" checked={customer.transferBank === 'banco'} onChange={() => setCustomer({...customer, transferBank: 'banco'})} />
                      Llave Bre-B
                    </label>}
                  </div>

                  {customer.transferBank === 'nequi' && (
                    <button className="copy-btn" onClick={() => copyToClipboard(settings.nequi_number, 'nequi')}>
                      <span className="copy-text">Nequi: {settings.nequi_number || 'No config'}</span>
                      {copiedNequi ? <Check size={16} color="green" /> : <Copy size={16} color="#999" />}
                    </button>
                  )}
                  
                  {customer.transferBank === 'banco' && (
                    <button className="copy-btn" onClick={() => copyToClipboard(settings.bancolombia_number, 'banco')}>
                      <span className="copy-text">Llave Bre-B: {settings.bancolombia_number || 'No config'}</span>
                      {copiedBanco ? <Check size={16} color="green" /> : <Copy size={16} color="#999" />}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

            <div className="cart-footer">
              <div className="cart-summary">
                <span>Subtotal</span>
                <span>{formatter.format(subtotal)}</span>
              </div>
              <div className="checkout-total">
                <span>Total a Pagar</span>
                <span>{formatter.format(subtotal)}</span>
              </div>
              
              {checkoutStep === 1 ? (
                <button 
                  className="checkout-btn" 
                  onClick={() => setCheckoutStep(2)}
                  disabled={cart.length === 0}
                >
                  Continuar Pedido
                </button>
              ) : (
                <button 
                  className="checkout-btn" 
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || !horariosStatus?.isOpen}
                >
                  {horariosStatus?.isOpen ? 'Confirmar por WhatsApp' : 'Restaurante Cerrado'}
                </button>
              )}
              
              {cart.length > 0 && checkoutStep === 1 && (
                <button 
                  className="empty-cart-btn" 
                  onClick={() => setCart([])}
                >
                  Vaciar Pedido
                </button>
              )}
            </div>
            
        </aside>

        {/* Payment info placed outside the cart-sidebar */}
        <div className="premium-payment-methods" style={{ background: 'white', borderRadius: '20px', padding: '1.5rem', marginTop: '1.5rem', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', flexShrink: 0 }}>
          <h3 className="premium-payment-title" style={{ color: '#000' }}><CreditCard size={20} /> Paga como quieras</h3>
          <div className="payment-icons-grid">
            {settings.payment_efectivo !== false && <div className="payment-method-item" style={{ color: '#333' }}><Banknote className="payment-method-icon" size={20} /> Efectivo</div>}
            {settings.payment_nequi !== false && <div className="payment-method-item" style={{ color: '#333' }}><Smartphone className="payment-method-icon" size={20} /> Nequi</div>}
            {settings.payment_daviplata && <div className="payment-method-item" style={{ color: '#333' }}><Smartphone className="payment-method-icon" size={20} /> Daviplata</div>}
            {settings.payment_transferencia && <div className="payment-method-item" style={{ color: '#333' }}><Wallet className="payment-method-icon" size={20} /> Transferencia</div>}
          </div>

          <div className="premium-trust-section" style={{ color: '#333', borderColor: '#eee' }}>
            <Lock className="icon" size={24} />
            <div className="premium-trust-text">
              <strong>Compra 100% segura</strong>
              <p>Tu información está protegida y el proceso de compra es totalmente seguro.</p>
            </div>
          </div>
        </div>
      </div>
        </div>
      </main>

      {/* MODAL DE ANUNCIO */}
      {isAnnouncementOpen && announcement && announcement.is_visible !== false && (
        <div className="announcement-overlay" role="presentation" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="announcement-panel" role="dialog" aria-modal="true" aria-labelledby="store-announcement-title" style={{ backgroundColor: '#111111', borderRadius: '24px', overflow: 'hidden', width: '100%', maxWidth: '400px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', border: '1px solid #333' }}>
            <button 
              className="announcement-close"
              onClick={() => { markAnnouncementSeen(announcement); setIsAnnouncementOpen(false); }}
              aria-label="Cerrar anuncio"
              style={{ position: 'absolute', top: '16px', right: '16px', width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(0,0,0,0.5)', color: '#FFF', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10 }}
            >
              <X size={20} />
            </button>
            
            {announcement.image_url && (
              <div className="announcement-media" style={{ flexShrink: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', backgroundColor: '#000' }}>
                <img className="announcement-image" src={announcement.image_url} alt={announcement.title || 'Anuncio'} decoding="async" style={{ width: '100%', height: 'auto', maxHeight: '55vh', objectFit: 'contain' }} />
              </div>
            )}
            
            <div className="announcement-content" style={{ padding: '24px', textAlign: 'center', overflowY: 'auto' }}>
              <h3 id="store-announcement-title" className="announcement-title" style={{ margin: '0 0 12px 0', color: '#FFFFFF', fontSize: '24px', fontWeight: '800' }}>
                {announcement.title}
              </h3>
              {announcement.body && <p className="announcement-body">{announcement.body}</p>}
              <button 
                className="announcement-action"
                onClick={() => {
                  markAnnouncementSeen(announcement);
                  setIsAnnouncementOpen(false);
                  if (announcement.cta_url) window.location.assign(announcement.cta_url);
                }}
                style={{ backgroundColor: '#D4A017', color: '#000', border: 'none', borderRadius: '12px', padding: '14px 24px', fontWeight: '700', fontSize: '16px', width: '100%', cursor: 'pointer' }}
              >
                {announcement.cta_label || 'Continuar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INSTALACIÓN PWA */}
      {showInstallBanner && (
        <div className="install-banner" style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: '400px', backgroundColor: '#111', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', border: '1px solid #D4A017', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="install-banner-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="install-banner-brand" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <img src={settings.logo || logoImg} alt="Logo" style={{ width: '48px', height: '48px', objectFit: 'contain', backgroundColor: '#000', borderRadius: '12px', padding: '4px' }} />
              <div>
                <h3 style={{ margin: 0, color: '#FFF', fontSize: '18px', fontWeight: '800' }}>Instala nuestra App</h3>
                <p style={{ margin: '4px 0 0 0', color: '#BDBDBD', fontSize: '14px' }}>Pide más rápido y seguro</p>
              </div>
            </div>
            <button className="install-banner-close" aria-label="Cerrar instalación" onClick={() => setShowInstallBanner(false)} style={{ background: 'transparent', border: 'none', color: '#BDBDBD', cursor: 'pointer', padding: '0' }}>
              <X size={24} />
            </button>
          </div>
          {isIOS ? (
            <div className="install-banner-hint" style={{ backgroundColor: '#1A1A1A', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Share size={16} color="#D4A017" style={{flexShrink: 0}} />
              <span>Toca <b>Compartir</b> y luego <b>"Agregar a inicio"</b></span>
            </div>
          ) : (
            <button className="install-banner-action" onClick={handleInstallClick} style={{ backgroundColor: '#D4A017', color: '#000', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '800', fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <Download size={20} />
              Instalar App
            </button>
          )}
        </div>
      )}

      <OrderTracker open={isTrackingOpen} onClose={() => setIsTrackingOpen(false)} initialOrder={latestOrder} />

    </div>
  );
}

export default App;
