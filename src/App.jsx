import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Minus, Trash2, ShoppingBag, ShoppingCart, Copy, Check, X, ArrowLeft, Lock, CreditCard, Wallet, Smartphone, Banknote, Menu, Download, Share, Car, Store, MapPin, Clock, KeyRound, Search, Phone, Instagram, Facebook, MessageCircle, ExternalLink } from 'lucide-react';
import logoImg from './assets/logo-horizontal.png';
import heroLogo from './assets/logo-hero.png';

import { API_URL } from './config/api';
import OrderTracker from './components/OrderTracker';
import ScheduleModal from './components/ScheduleModal';
import { buildNewOrderWhatsAppMessage, createWhatsAppUrl } from '@distrito/shared-ui';
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

function recordAnnouncement(id, action) {
  if (!id) return;
  fetch(`${API_URL}/announcements/${id}/${action}`, { method: 'POST', keepalive: true }).catch(() => {});
}

function trackingOrderFromUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const id = Number(params.get('pedido'));
  const token = params.get('seguimiento') || '';
  return Number.isInteger(id) && id > 0 && token ? { id, token, fromLink: true } : null;
}

function App() {
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [announcement, setAnnouncement] = useState(null);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [horariosStatus, setHorariosStatus] = useState({ isOpen: false, statusText: 'Consultando horario…' });
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState(null);
  const [detailModalQty, setDetailModalQty] = useState(1);
  const [isTrackingOpen, setIsTrackingOpen] = useState(() => Boolean(trackingOrderFromUrl()));
  const [latestOrder, setLatestOrder] = useState(() => {
    try {
      const fromUrl = trackingOrderFromUrl();
      if (fromUrl) return fromUrl;
      const raw = localStorage.getItem('distrito_latest_order');
      if (!raw) return null;
      const stored = JSON.parse(raw);
      if (!stored?.timestamp || (Date.now() - stored.timestamp > 12 * 60 * 60 * 1000)) {
        localStorage.removeItem('distrito_latest_order');
        return null;
      }
      return stored;
    } catch {
      return null;
    }
  });
  
  // Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  // Categories drag-to-scroll refs
  const categoriesRef = useRef(null);
  const isDraggingCategories = useRef(false);
  const startCategoriesX = useRef(0);
  const scrollLeftCategories = useRef(0);
  const draggedCategories = useRef(false);

  const handleCategoriesMouseDown = (e) => {
    isDraggingCategories.current = true;
    draggedCategories.current = false;
    startCategoriesX.current = e.pageX - (categoriesRef.current?.offsetLeft || 0);
    scrollLeftCategories.current = categoriesRef.current?.scrollLeft || 0;
  };

  const handleCategoriesMouseMove = (e) => {
    if (!isDraggingCategories.current || !categoriesRef.current) return;
    const x = e.pageX - (categoriesRef.current?.offsetLeft || 0);
    const walk = x - startCategoriesX.current;
    if (Math.abs(walk) > 5) {
      draggedCategories.current = true;
      categoriesRef.current.scrollLeft = scrollLeftCategories.current - walk;
    }
  };

  const handleCategoriesMouseUp = () => {
    isDraggingCategories.current = false;
  };

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

  const [copiedNequi, setCopiedNequi] = useState(false);
  const [copiedBanco, setCopiedBanco] = useState(false);

  const hasAutoShownClosedModal = useRef(false);

  useEffect(() => {
    const refreshSchedule = () => fetch(`${API_URL}/horarios/status`)
      .then(res => res.json()).then(data => {
        setHorariosStatus(data);
        if (data && data.isOpen === false && !hasAutoShownClosedModal.current) {
          hasAutoShownClosedModal.current = true;
          setIsScheduleModalOpen(true);
        }
      })
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
          const returning = localStorage.getItem('distrito_latest_order') ? '1' : '0';
          fetch(`${API_URL}/announcement?returning=${returning}`).then((response) => response.json()).then((campaign) => {
            if (shouldShowAnnouncement(campaign.announcement)) {
              setAnnouncement(campaign.announcement);
              setIsAnnouncementOpen(true);
              recordAnnouncement(campaign.announcement.id, 'view');
            }
          }).catch(() => {});
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
      return [featuredCategory, ...baseCategories];
    }
    return baseCategories;
  }, [products, categoriesData]);

  // Sincronizar categoría activa por defecto si no está seleccionada o ya no existe
  useEffect(() => {
    if (categories.length > 0) {
      const exists = categories.some(c => c.id === activeCategory);
      if (!exists) {
        setActiveCategory(categories[0].id);
      }
    }
  }, [categories, activeCategory]);

  const filteredProducts = useMemo(() => {
    let list = products;
    if (activeCategory === 'featured') {
      list = list.filter(p => p.is_featured);
    } else if (activeCategory) {
      list = list.filter(p => p.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(p => 
        (p.title && p.title.toLowerCase().includes(q)) || 
        (p.description && p.description.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeCategory, products, searchQuery]);

  const addToCart = (product, quantity = 1) => {
    if (product.track_stock && Number(product.stock) <= 0) return;
    const qtyToAdd = Math.max(1, Number(quantity) || 1);
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + qtyToAdd } : item);
      }
      return [...prev, { ...product, qty: qtyToAdd }];
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

  useEffect(() => {
    if (cart.length === 0 && checkoutStep > 1) {
      setCheckoutStep(1);
    }
  }, [cart.length, checkoutStep]);

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const deliveryFee = customer.deliveryType === 'domicilio' ? Math.max(0, Number(settings.delivery_cost || 0)) : 0;
  const orderTotal = subtotal + deliveryFee;
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
    if (customer.paymentMethod === 'efectivo' && !customer.cashAmount) {
      alert("Por favor ingresa con cuánto vas a pagar.");
      return;
    }
    if (customer.paymentMethod === 'efectivo' && Number(customer.cashAmount) < orderTotal) {
      alert(`El valor con el que pagas debe cubrir el total de ${formatter.format(orderTotal)}.`);
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
    let trackingToken = '';
    let confirmedSubtotal = subtotal;
    let confirmedDeliveryFee = deliveryFee;
    let confirmedTotal = orderTotal;
    let confirmedChange = customer.paymentMethod === 'efectivo' ? Math.max(0, Number(customer.cashAmount) - orderTotal) : 0;

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
      trackingToken = data.tracking_token || '';
      confirmedSubtotal = Number(data.subtotal ?? subtotal);
      confirmedDeliveryFee = Number(data.delivery_fee ?? deliveryFee);
      confirmedTotal = Number(data.total ?? orderTotal);
      confirmedChange = Number(data.change_required ?? (customer.paymentMethod === 'efectivo' ? Math.max(0, Number(customer.cashAmount) - confirmedTotal) : 0));
      if (!trackingToken) throw new Error('No fue posible generar el seguimiento temporal del pedido');
    } catch (error) {
      whatsappWindow?.close();
      setLoading(false);
      alert(error.message || 'No fue posible confirmar el pedido. No se realizó ningún cobro ni reserva.');
      return;
    }

    // URL corta de rastreo: /rastrear/ID?c=últimos4dígitosTel
    const phoneCode = customer.phone.replace(/\D/g, '').slice(-4);
    const trackingUrl = `https://www.distritobg.app/rastrear/${dbOrderId}?c=${phoneCode}`;

    const message = buildNewOrderWhatsAppMessage({
      orderId: dbOrderId,
      customer,
      items: cart,
      trackingUrl,
      subtotal: confirmedSubtotal,
      deliveryFee: confirmedDeliveryFee,
      total: confirmedTotal,
      change: confirmedChange,
      restaurantName: settings.restaurant_name || 'Distric House',
    });
    const whatsappUrl = createWhatsAppUrl(phoneNumber, message);


    const tracking = { id: dbOrderId, phone: customer.phone, token: trackingToken, timestamp: Date.now() };
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
        <div className="professional-spinner"></div>
        <p>Cargando menú...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Main Area */}
      <main className="main-content">
        {/* Top Navbar Minimalista Premium */}
        <header className="top-navbar">
          <div className="nav-left">
            <button 
              className="mobile-menu-btn" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menú de navegación"
            >
              <Menu size={22} color="#111111" />
            </button>
            <div className="nav-logo">
              <a href="#" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <img src={settings.web_logo || logoImg} alt={settings.restaurant_name || 'Distric House'} />
              </a>
            </div>
          </div>
          
          <nav className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
            <a 
              href="#menu" 
              className="active" 
              onClick={(e) => { 
                e.preventDefault(); 
                setIsMobileMenuOpen(false); 
                categoriesRef.current?.scrollIntoView({ behavior: 'smooth' }); 
              }}
            >
              MENÚ
            </a>
            <a 
              href="#promociones" 
              onClick={(e) => { 
                e.preventDefault(); 
                setIsMobileMenuOpen(false); 
                const promoCategory = categories.find(c => c.name.toLowerCase().includes('promo') || c.name.toLowerCase().includes('combo') || c.id === 'featured');
                if (promoCategory) setActiveCategory(promoCategory.id);
                categoriesRef.current?.scrollIntoView({ behavior: 'smooth' }); 
              }}
            >
              PROMOCIONES
            </a>
            <a 
              href="#nosotros" 
              onClick={(e) => { 
                e.preventDefault(); 
                setIsMobileMenuOpen(false); 
                document.getElementById('nosotros')?.scrollIntoView({ behavior: 'smooth' }); 
              }}
            >
              NOSOTROS
            </a>
            <a 
              href="#ubicaciones" 
              onClick={(e) => { 
                e.preventDefault(); 
                setIsMobileMenuOpen(false); 
                document.getElementById('ubicaciones')?.scrollIntoView({ behavior: 'smooth' }); 
              }}
            >
              UBICACIONES
            </a>
            <a 
              href="#contacto" 
              onClick={(e) => { 
                e.preventDefault(); 
                setIsMobileMenuOpen(false); 
                document.getElementById('contacto')?.scrollIntoView({ behavior: 'smooth' }); 
              }}
            >
              CONTACTO
            </a>
            <button 
              className="tracking-nav-button" 
              onClick={() => { setIsMobileMenuOpen(false); setIsTrackingOpen(true); }}
            >
              RASTREAR PEDIDO
            </button>
          </nav>
          
          <div className="nav-actions">
            {/* Buscador de escritorio integrado */}
            <div className="nav-search-bar">
              <Search size={16} className="nav-search-icon" />
              <input
                type="text"
                placeholder="Buscar en el menú..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="nav-search-input"
              />
              {searchQuery && (
                <button 
                  className="nav-search-clear" 
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div 
              className={`status-indicator ${!isOpen ? 'is-closed' : ''}`}
              role={!isOpen ? 'button' : undefined}
              tabIndex={!isOpen ? 0 : undefined}
              title={!isOpen ? 'Restaurante cerrado. Toca para ver horarios' : undefined}
              onClick={() => {
                if (!isOpen) setIsScheduleModalOpen(true);
              }}
              onKeyDown={(e) => {
                if (!isOpen && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setIsScheduleModalOpen(true);
                }
              }}
            >
              <span className="dot" style={{ backgroundColor: isOpen ? '#16A34A' : '#EF4444' }}></span>
              <div className="status-text-row">
                <strong>{isOpen ? 'Abierto' : 'Cerrado'}</strong>
                <span>{scheduleText}</span>
              </div>
            </div>

            {/* Botón lupa para móviles al lado del carrito */}
            <button 
              className="mobile-search-toggle-btn"
              onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
              aria-label={isMobileSearchOpen ? "Cerrar búsqueda" : "Abrir buscador"}
            >
              <Search size={20} color="#111111" />
            </button>

            <button 
              className="desktop-cart-icon" 
              onClick={() => setIsCartOpenMobile(true)}
              aria-label="Ver carrito"
            >
              <ShoppingCart size={20} color="#111111" />
              {cartTotalItems > 0 && <span className="badge">{cartTotalItems}</span>}
            </button>
          </div>
        </header>

        {/* Buscador desplegable para móviles al pulsar la lupa */}
        {isMobileSearchOpen && (
          <div className="mobile-search-bar-container is-open">
            <div className="mobile-search-bar">
              <Search size={18} className="nav-search-icon" />
              <input
                type="text"
                placeholder="¿Qué se te antoja hoy? Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mobile-search-input"
                autoFocus
              />
              {searchQuery && (
                <button 
                  className="nav-search-clear" 
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Banner Principal Minimalista Premium */}
        <section className="hero-banner-minimal">
          <div className="hero-banner-container">
            <div className="hero-logo-wrapper">
              <img 
                src={heroLogo || settings.logo || logoImg} 
                alt={settings.restaurant_name || 'Distric House'} 
                className="hero-logo-img"
              />
            </div>
          </div>
        </section>

        {/* Sección: Información Clave (Minimalista Premium) */}
        <section className="key-info-section" aria-label="Información clave">
          <div className="key-info-container">
            {/* Bloque 1: Horario de atención */}
            <div 
              className="key-info-card key-info-clickable" 
              onClick={() => setIsScheduleModalOpen(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsScheduleModalOpen(true); } }}
              title="Toca para ver el horario completo"
            >
              <div className="key-info-icon-wrapper">
                <Clock size={22} className="key-info-icon" />
              </div>
              <div className="key-info-content">
                <h3 className="key-info-title">Horario de atención</h3>
                <p className="key-info-text">
                  {scheduleText || (horariosStatus?.schedule ? 'Consulta nuestro horario' : 'Consulta nuestro horario')}
                </p>
                <span className="key-info-action">
                  Ver horarios detallados
                </span>
              </div>
            </div>

            {/* Bloque 2: Nuestra ubicación */}
            <div className="key-info-card">
              <div className="key-info-icon-wrapper">
                <MapPin size={22} className="key-info-icon" />
              </div>
              <div className="key-info-content">
                <h3 className="key-info-title">Nuestra ubicación</h3>
                <p className="key-info-text">
                  {settings.kitchen_address || settings.address || 'Ubicación disponible en tienda'}
                </p>
                {(settings.google_maps_url || settings.maps_url || settings.kitchen_address || settings.address) && (
                  <a 
                    href={settings.google_maps_url || settings.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.kitchen_address || settings.address)}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="key-info-action key-info-link"
                  >
                    Ver en el mapa <ExternalLink size={13} className="inline-action-icon" />
                  </a>
                )}
              </div>
            </div>

            {/* Bloque 3: ¿Dudas o pedidos? */}
            <div className="key-info-card">
              <div className="key-info-icon-wrapper">
                <MessageCircle size={22} className="key-info-icon" />
              </div>
              <div className="key-info-content">
                <h3 className="key-info-title">¿Dudas o pedidos?</h3>
                <p className="key-info-text">Escríbenos por WhatsApp</p>
                {settings.whatsapp_number ? (
                  <a 
                    href={`https://wa.me/${settings.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent('Hola Distric House, me gustaría hacer una consulta sobre su menú y pedidos.')}`}
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="key-info-action key-info-link"
                  >
                    Enviar mensaje <ExternalLink size={13} className="inline-action-icon" />
                  </a>
                ) : (
                  <span className="key-info-text-muted">Canal oficial activo</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Selector de Modo de Entrega (Únicamente 2 opciones: Recoger en local y Domicilio) */}
        <section className="delivery-mode-section">
          <div className="delivery-mode-container">
            <div className="delivery-mode-grid">
              <button
                type="button"
                className={`delivery-mode-card ${customer.deliveryType === 'recoger' ? 'active' : ''}`}
                onClick={() => setCustomer(prev => ({ ...prev, deliveryType: 'recoger' }))}
              >
                <div className="delivery-mode-icon-circle">
                  <ShoppingBag size={24} strokeWidth={2.2} />
                </div>
                <div className="delivery-mode-info">
                  <span className="delivery-mode-title">Recoger en local</span>
                  <span className="delivery-mode-subtitle">Listo para recoger</span>
                </div>
              </button>

              <button
                type="button"
                className={`delivery-mode-card ${customer.deliveryType === 'domicilio' ? 'active' : ''}`}
                onClick={() => setCustomer(prev => ({ ...prev, deliveryType: 'domicilio' }))}
              >
                <div className="delivery-mode-icon-circle">
                  <Car size={24} strokeWidth={2.2} />
                </div>
                <div className="delivery-mode-info">
                  <span className="delivery-mode-title">Domicilio</span>
                  <span className="delivery-mode-subtitle">Te llevamos tu pedido</span>
                </div>
              </button>
            </div>
          </div>
        </section>

        <div className="menu-header-bar" id="menu">
          <h2 className="section-title">NUESTRO MENÚ</h2>
          {searchQuery && (
            <p className="search-active-indicator">
              Mostrando resultados para: <strong>"{searchQuery}"</strong> (
              <button className="search-reset-btn" onClick={() => setSearchQuery('')}>borrar filtro</button>)
            </p>
          )}
        </div>

        <div className="shop-layout">
          <div className="shop-products">
            {/* Categories */}
            <div
              className="categories"
              ref={categoriesRef}
              onMouseDown={handleCategoriesMouseDown}
              onMouseMove={handleCategoriesMouseMove}
              onMouseUp={handleCategoriesMouseUp}
              onMouseLeave={handleCategoriesMouseUp}
            >
              {categories.map(cat => {
                return (
                  <button 
                    key={cat.id} 
                    className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                    onClick={() => {
                      if (draggedCategories.current) return;
                      setActiveCategory(cat.id);
                    }}
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
              <div
                key={product.id}
                className={`product-card ${soldOut ? 'sold-out' : ''}`}
                role="button"
                tabIndex={soldOut || !isOpen ? -1 : 0}
                aria-disabled={soldOut || !isOpen}
                aria-label={`Agregar ${product.title} al pedido`}
                onClick={(event) => {
                  if (event.target.closest('button, a, input, .interactive-star, .product-qty-controls')) return;
                  setSelectedProductDetail(product);
                  setDetailModalQty(1);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedProductDetail(product);
                    setDetailModalQty(1);
                  }
                }}
              >
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
                      <button 
                        className="add-btn" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProductDetail(product);
                          setDetailModalQty(1);
                        }} 
                        disabled={soldOut}
                      >
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
      </div>
    </div>

      {/* Cart Drawer & Overlay (Disponible cuando se toca "Ver pedido" o el icono del carrito) */}
      <div className={`cart-overlay ${isCartOpenMobile ? 'open' : ''}`} onClick={() => setIsCartOpenMobile(false)}></div>

      <aside className={`cart-sidebar ${isCartOpenMobile ? 'open' : ''}`}>
          <div className="cart-header">
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
            {checkoutStep > 1 && (
              <button className="back-btn" onClick={() => setCheckoutStep(prev => prev - 1)} aria-label="Volver">
                <ArrowLeft size={20} />
              </button>
            )}
            <h2>
              {checkoutStep === 1 && '🛒 Tu Pedido'}
              {checkoutStep === 2 && 'Forma de Entrega'}
              {checkoutStep === 3 && (customer.deliveryType === 'domicilio' ? 'Datos de Domicilio' : 'Datos para Recoger')}
            </h2>
            {checkoutStep === 1 && <span className="cart-count">{cartTotalItems}</span>}
          </div>
          <button className="close-cart-btn" onClick={() => setIsCartOpenMobile(false)} aria-label="Cerrar">
            <X size={24} />
          </button>
        </div>

        <div className="cart-content-scroll">
          {checkoutStep === 1 && (
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
          )}

          {checkoutStep === 2 && (
            <div className="delivery-step-wrapper">
              <div className="delivery-step-header">
                <h3 className="delivery-step-title">Selecciona forma de entrega</h3>
              </div>

              <div className="delivery-options-grid">
                <button
                  type="button"
                  className={`delivery-option-card ${customer.deliveryType === 'recoger' ? 'active' : ''}`}
                  onClick={() => setCustomer(prev => ({ ...prev, deliveryType: 'recoger' }))}
                >
                  <div className="delivery-option-icon">
                    <ShoppingBag size={30} strokeWidth={2} />
                  </div>
                  <span className="delivery-option-title">Recoger en local</span>
                  <span className="delivery-option-subtitle">Listo para recoger</span>
                </button>

                <button
                  type="button"
                  className={`delivery-option-card ${customer.deliveryType === 'domicilio' ? 'active' : ''}`}
                  onClick={() => setCustomer(prev => ({ ...prev, deliveryType: 'domicilio' }))}
                >
                  <div className="delivery-option-icon">
                    <Car size={30} strokeWidth={2} />
                  </div>
                  <span className="delivery-option-title">Domicilio</span>
                  <span className="delivery-option-subtitle">Te llevamos tu pedido</span>
                </button>
              </div>

              {customer.deliveryType === 'recoger' ? (
                <div className="delivery-info-banner">
                  <div className="delivery-info-icon-wrapper">
                    <Store size={22} />
                  </div>
                  <div className="delivery-info-text">
                    <strong>Retiras en el local</strong>
                    <p>{settings.kitchen_address || settings.address || 'Punto de venta principal'}</p>
                    <span className="delivery-info-badge">⏱️ Tiempo estimado: {settings.prep_time || '30 - 45 min'}</span>
                  </div>
                </div>
              ) : (
                <div className="delivery-info-banner">
                  <div className="delivery-info-icon-wrapper">
                    <Car size={22} />
                  </div>
                  <div className="delivery-info-text">
                    <strong>Entrega a domicilio</strong>
                    <p>Llevamos tu pedido caliente y seguro hasta tu dirección.</p>
                    {Number(settings.delivery_cost) > 0 ? (
                      <span className="delivery-info-badge">🛵 Domicilio: {formatter.format(Number(settings.delivery_cost))}</span>
                    ) : (
                      <span className="delivery-info-badge">🛵 Domicilio disponible</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {checkoutStep === 3 && (
            <div className="customer-form">
              <h3 className="form-section-title">Datos del Cliente</h3>
              <div className="form-group">
                <input type="text" className="form-input" placeholder="Nombre y Apellido" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
              </div>
              <div className="form-group">
                <input type="tel" className="form-input" placeholder="Teléfono (WhatsApp)" value={customer.phone} onChange={e => setCustomer({...customer, phone: e.target.value})} />
              </div>

              {!horariosStatus?.isOpen && (
                <div 
                  onClick={() => setIsScheduleModalOpen(true)}
                  style={{ backgroundColor: '#EF4444', color: '#FFF', padding: '16px', borderRadius: '12px', marginBottom: '24px', textAlign: 'center', fontWeight: '600', cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                >
                  Actualmente estamos cerrados. {horariosStatus?.currentSchedule ? `Nuestro horario hoy es de ${horariosStatus.currentSchedule.open_time} a ${horariosStatus.currentSchedule.close_time}.` : 'No hay atención el día de hoy.'}
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', textDecoration: 'underline', opacity: 0.95 }}>
                    📅 Toca aquí para ver todos los horarios de atención
                  </div>
                </div>
              )}

              {customer.deliveryType === 'domicilio' ? (
                <>
                  <h3 className="form-section-title">Dirección de Entrega</h3>
                  <div className="form-group">
                    <label htmlFor="delivery-address">Dirección</label>
                    <input 
                      id="delivery-address" 
                      type="text" 
                      className="form-input" 
                      placeholder="Ej. Calle 15 # 12-34" 
                      value={customer.address} 
                      onChange={e => setCustomer({...customer, address: e.target.value})} 
                      autoComplete="street-address"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="delivery-barrio">Barrio</label>
                    <input id="delivery-barrio" type="text" className="form-input" placeholder="Ej. Los Cortijos, San Joaquín..." value={customer.barrio} onChange={e => setCustomer({...customer, barrio: e.target.value})} />
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
              ) : (
                <div className="pickup-summary-card">
                  <div className="pickup-summary-header">
                    <Store size={22} color="var(--primary-color, #B30401)" />
                    <h4>Información de Retiro</h4>
                  </div>
                  <p className="pickup-address"><strong>Punto de recogida:</strong> {settings.kitchen_address || settings.address || 'Punto de venta principal'}</p>
                  <p className="pickup-time"><strong>Tiempo aprox. de preparación:</strong> {settings.prep_time || '30 - 45 min'}</p>
                  <div className="pickup-note">
                    ℹ️ Te contactaremos a tu WhatsApp cuando tu pedido esté listo para retirar en el local.
                  </div>
                </div>
              )}

              <div className="form-group">
                <input type="text" className="form-input" placeholder="Comentario (opcional)" value={customer.comment} onChange={e => setCustomer({...customer, comment: e.target.value})} />
              </div>

              <h3 className="form-section-title">Método de Pago</h3>
              <div className="payment-options-grid">
                {settings.payment_efectivo !== false && (
                  <button
                    type="button"
                    className={`payment-option-card ${customer.paymentMethod === 'efectivo' ? 'active' : ''}`}
                    onClick={() => setCustomer(prev => ({ ...prev, paymentMethod: 'efectivo' }))}
                  >
                    <div className="payment-option-icon">
                      <Banknote size={26} strokeWidth={2.2} />
                    </div>
                    <span className="payment-option-title">Efectivo</span>
                  </button>
                )}

                <button
                  type="button"
                  className={`payment-option-card ${customer.paymentMethod === 'transferencia' && customer.transferBank === 'nequi' ? 'active' : ''}`}
                  onClick={() => setCustomer(prev => ({ ...prev, paymentMethod: 'transferencia', transferBank: 'nequi' }))}
                >
                  <div className="payment-option-icon">
                    <Smartphone size={26} strokeWidth={2.2} />
                  </div>
                  <span className="payment-option-title">Nequi</span>
                </button>

                <button
                  type="button"
                  className={`payment-option-card ${customer.paymentMethod === 'transferencia' && customer.transferBank === 'banco' ? 'active' : ''}`}
                  onClick={() => setCustomer(prev => ({ ...prev, paymentMethod: 'transferencia', transferBank: 'banco' }))}
                >
                  <div className="payment-option-icon">
                    <KeyRound size={26} strokeWidth={2.2} />
                  </div>
                  <span className="payment-option-title">Llave Bre-B</span>
                </button>
              </div>

              {customer.paymentMethod === 'efectivo' && (
                <div className="payment-details-box animate-in fade-in">
                  <div className="form-group">
                    <label htmlFor="cash-amount">¿Con cuánto vas a pagar?</label>
                    <input
                      id="cash-amount"
                      type="number"
                      className="form-input"
                      placeholder={`Ej: ${orderTotal}`}
                      value={customer.cashAmount}
                      onChange={e => setCustomer({...customer, cashAmount: e.target.value})}
                    />
                  </div>
                  {Number(customer.cashAmount) > orderTotal && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--primary-color, #B30401)', fontWeight: '700' }}>
                      💵 Cambio: {formatter.format(Number(customer.cashAmount) - orderTotal)}
                    </div>
                  )}
                </div>
              )}

              {customer.paymentMethod === 'transferencia' && customer.transferBank === 'nequi' && (
                <div className="transfer-info animate-in fade-in">
                  <p className="transfer-desc" style={{ marginBottom: '8px', fontWeight: '800', color: '#111111', fontSize: '0.95rem' }}>
                    Transfiere a nuestra cuenta Nequi:
                  </p>
                  <button type="button" className="copy-btn" onClick={() => copyToClipboard(settings.nequi_number, 'nequi')}>
                    <span className="copy-text" style={{ color: '#111111', fontWeight: '800', fontSize: '1rem' }}>
                      Nequi: {settings.nequi_number || 'No configurado'}
                    </span>
                    {copiedNequi ? <Check size={18} color="#16a34a" /> : <Copy size={18} color="var(--primary-color, #B30401)" />}
                  </button>
                  <p style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666666', lineHeight: '1.4' }}>
                    💡 Toca para copiar el número. Envía el comprobante por WhatsApp al confirmar.
                  </p>
                </div>
              )}

              {customer.paymentMethod === 'transferencia' && customer.transferBank === 'banco' && (
                <div className="transfer-info animate-in fade-in">
                  <p className="transfer-desc" style={{ marginBottom: '8px', fontWeight: '800', color: '#111111', fontSize: '0.95rem' }}>
                    Transfiere mediante Llave Bre-B:
                  </p>
                  <button type="button" className="copy-btn" onClick={() => copyToClipboard(settings.bancolombia_number, 'banco')}>
                    <span className="copy-text" style={{ color: '#111111', fontWeight: '800', fontSize: '1rem' }}>
                      Llave Bre-B: {settings.bancolombia_number || 'No configurado'}
                    </span>
                    {copiedBanco ? <Check size={18} color="#16a34a" /> : <Copy size={18} color="var(--primary-color, #B30401)" />}
                  </button>
                  <p style={{ marginTop: '8px', fontSize: '0.8rem', color: '#666666', lineHeight: '1.4' }}>
                    💡 Toca para copiar la llave. Envía el comprobante por WhatsApp al confirmar.
                  </p>
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
              {checkoutStep > 1 && customer.deliveryType === 'domicilio' && (
                <div className="cart-summary">
                  <span>Domicilio</span>
                  <span>{deliveryFee > 0 ? formatter.format(deliveryFee) : 'Gratis'}</span>
                </div>
              )}
              {checkoutStep > 1 && customer.deliveryType === 'recoger' && (
                <div className="cart-summary">
                  <span>Domicilio</span>
                  <span style={{ color: 'var(--primary-color, #B30401)', fontWeight: '700' }}>Recoger en local (Gratis)</span>
                </div>
              )}
              <div className="checkout-total">
                <span>Total a Pagar</span>
                <span>{formatter.format(checkoutStep === 1 ? subtotal : orderTotal)}</span>
              </div>
              
              {checkoutStep === 1 && (
                <>
                  <button 
                    className="checkout-btn" 
                    onClick={() => setCheckoutStep(2)}
                    disabled={cart.length === 0}
                  >
                    Continuar Pedido
                  </button>
                  {cart.length > 0 && (
                    <button 
                      className="empty-cart-btn" 
                      onClick={() => setCart([])}
                      style={{ marginTop: '0.75rem' }}
                    >
                      Vaciar Pedido
                    </button>
                  )}
                </>
              )}

              {checkoutStep === 2 && (
                <>
                  <button 
                    className="checkout-btn" 
                    onClick={() => setCheckoutStep(3)}
                    disabled={cart.length === 0}
                  >
                    Continuar
                  </button>
                  <button 
                    className="empty-cart-btn" 
                    onClick={() => setCheckoutStep(1)}
                    style={{ marginTop: '0.75rem' }}
                  >
                    Volver
                  </button>
                </>
              )}

              {checkoutStep === 3 && (
                <>
                  <button 
                    className="checkout-btn" 
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || !horariosStatus?.isOpen}
                  >
                    {horariosStatus?.isOpen ? 'Confirmar por WhatsApp' : 'Restaurante Cerrado'}
                  </button>
                  <button 
                    className="empty-cart-btn" 
                    onClick={() => setCheckoutStep(2)}
                    style={{ marginTop: '0.75rem' }}
                  >
                    Volver
                  </button>
                </>
              )}
            </div>
            
        </aside>

        {/* PIE DE PÁGINA (FOOTER) MINIMALISTA PREMIUM */}
        <footer className="site-footer">
          <div className="footer-container">
            <div className="footer-grid">
              {/* Columna 1: Marca y descripción */}
              <div className="footer-col footer-col-brand" id="nosotros">
                <img 
                  src={settings.web_logo || logoImg} 
                  alt={settings.restaurant_name || 'Distric House'} 
                  className="footer-logo"
                />
                <p className="footer-desc">
                  Hamburguesas y comida rápida artesanal preparadas al momento con ingredientes frescos y 100% res de primera calidad.
                </p>
                <div className="footer-badges">
                  <span className="footer-pill">🍔 Hecho al instante</span>
                  <span className="footer-pill">⚡ Domicilio rápido</span>
                </div>
              </div>

              {/* Columna 2: Enlaces Rápidos */}
              <div className="footer-col">
                <h4 className="footer-title">NAVEGACIÓN</h4>
                <ul className="footer-links">
                  <li><a href="#menu" onClick={(e) => { e.preventDefault(); categoriesRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>Nuestro Menú</a></li>
                  <li><a href="#promociones" onClick={(e) => { e.preventDefault(); const promo = categories.find(c => c.name.toLowerCase().includes('promo') || c.id === 'featured'); if (promo) setActiveCategory(promo.id); categoriesRef.current?.scrollIntoView({ behavior: 'smooth' }); }}>Promociones y Combos</a></li>
                  <li><button className="footer-link-btn" onClick={() => setIsTrackingOpen(true)}>Rastrear mi pedido</button></li>
                  <li><button className="footer-link-btn" onClick={() => setIsScheduleModalOpen(true)}>Ver horarios de atención</button></li>
                </ul>
              </div>

              {/* Columna 3: Horarios y Ubicación */}
              <div className="footer-col" id="ubicaciones">
                <h4 className="footer-title">HORARIOS & UBICACIÓN</h4>
                <div className="footer-info-item">
                  <Clock size={16} className="footer-info-icon" />
                  <div>
                    <strong>Horario de atención:</strong>
                    <p>{scheduleText || 'Martes a Domingo'}</p>
                  </div>
                </div>
                <div className="footer-info-item">
                  <MapPin size={16} className="footer-info-icon" />
                  <div>
                    <strong>Punto de venta:</strong>
                    <p>{settings.kitchen_address || settings.address || 'Valledupar, Colombia'}</p>
                  </div>
                </div>
              </div>

              {/* Columna 4: Contacto */}
              <div className="footer-col" id="contacto">
                <h4 className="footer-title">CONTACTO</h4>
                <div className="footer-info-item">
                  <Phone size={16} className="footer-info-icon" />
                  <div>
                    <strong>WhatsApp Pedidos:</strong>
                    <p>
                      <a href={`https://wa.me/${settings.whatsapp_number?.replace(/\D/g, '') || '573000000000'}`} target="_blank" rel="noreferrer" className="footer-phone-link">
                        +{settings.whatsapp_number || '57 300 000 0000'}
                      </a>
                    </p>
                  </div>
                </div>
                {settings.instagram_user && (
                  <div className="footer-info-item">
                    <Instagram size={16} className="footer-info-icon" />
                    <div>
                      <strong>Instagram:</strong>
                      <p>
                        <a href={`https://instagram.com/${settings.instagram_user.replace('@', '')}`} target="_blank" rel="noreferrer" className="footer-phone-link">
                          @{settings.instagram_user.replace('@', '')}
                        </a>
                      </p>
                    </div>
                  </div>
                )}
                {settings.facebook_url && (
                  <div className="footer-info-item">
                    <Facebook size={16} className="footer-info-icon" />
                    <div>
                      <strong>Facebook:</strong>
                      <p>
                        <a href={settings.facebook_url} target="_blank" rel="noreferrer" className="footer-phone-link">
                          Distric House
                        </a>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sub-footer con copyright y términos */}
            <div className="footer-bottom">
              <p className="footer-copy">
                &copy; {new Date().getFullYear()} {settings.restaurant_name || 'Distric House'}. Todos los derechos reservados.
              </p>
              <div className="footer-legal">
                <span>Términos y condiciones</span>
                <span className="dot-sep">•</span>
                <span>Política de privacidad</span>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* MODAL DE ANUNCIO */}
      {isAnnouncementOpen && announcement && announcement.is_visible !== false && (
        <div className={`announcement-overlay announcement-${announcement.campaign_type || 'modal'}`} role="presentation" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: announcement.campaign_type === 'banner' ? 'flex-start' : 'center', justifyContent: 'center', padding: '20px' }}>
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
                  recordAnnouncement(announcement.id, 'click');
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
        <div className="install-banner" style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: '400px', backgroundColor: '#111', borderRadius: '16px', padding: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', border: '1px solid #B30401', zIndex: 10000, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="install-banner-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="install-banner-brand" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <img src="/icon-192.png" alt="Distric House" style={{ width: '48px', height: '48px', objectFit: 'contain', backgroundColor: '#FFF', borderRadius: '12px', padding: '2px', border: '1px solid #E5E7EB' }} />
              <div>
                <h3 style={{ margin: 0, color: '#FFF', fontSize: '18px', fontWeight: '800' }}>Instala Distric House</h3>
                <p style={{ margin: '4px 0 0 0', color: '#BDBDBD', fontSize: '14px' }}>Pide más rápido y directo</p>
              </div>
            </div>
            <button className="install-banner-close" aria-label="Cerrar instalación" onClick={() => setShowInstallBanner(false)} style={{ background: 'transparent', border: 'none', color: '#BDBDBD', cursor: 'pointer', padding: '0' }}>
              <X size={24} />
            </button>
          </div>
          {isIOS ? (
            <div className="install-banner-hint" style={{ backgroundColor: '#1A1A1A', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#FFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Share size={16} color="#B30401" style={{flexShrink: 0}} />
              <span>Toca <b>Compartir</b> y luego <b>"Agregar a inicio"</b></span>
            </div>
          ) : (
            <button className="install-banner-action" onClick={handleInstallClick} style={{ backgroundColor: '#B30401', color: '#FFF', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: '800', fontSize: '16px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
              <Download size={20} />
              Instalar App
            </button>
          )}
        </div>
      )}

      {/* MODAL VENTANA DE DETALLE DE PRODUCTO */}
      {selectedProductDetail && (
        <div 
          className="product-detail-overlay" 
          onClick={() => setSelectedProductDetail(null)}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="product-detail-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Botón cerrar */}
            <button 
              className="product-detail-close-btn" 
              onClick={() => setSelectedProductDetail(null)}
              aria-label="Cerrar detalle de producto"
            >
              <X size={20} />
            </button>

            {/* Cabecera / Imagen del producto */}
            <div className="product-detail-image-wrap">
              {selectedProductDetail.image ? (
                <img 
                  src={selectedProductDetail.image} 
                  alt={selectedProductDetail.title} 
                  className="product-detail-image" 
                />
              ) : (
                <div className="product-detail-placeholder">
                  <span>Sin Imagen</span>
                </div>
              )}
              {((selectedProductDetail.track_stock && Number(selectedProductDetail.stock) <= 0) || selectedProductDetail.status === 'Agotado') && (
                <span className="product-detail-soldout-badge">AGOTADO</span>
              )}
            </div>

            {/* Cuerpo del Modal */}
            <div className="product-detail-body">
              <div className="product-detail-meta">
                <span className="product-detail-category-badge">
                  {categoriesData.find(c => c.id === selectedProductDetail.category_id)?.name || 'Especialidad'}
                </span>
                {selectedProductDetail.rating_count > 0 && (
                  <div className="product-detail-rating">
                    <span className="star-icon">★</span>
                    <strong>{((selectedProductDetail.rating_sum || 0) / (selectedProductDetail.rating_count || 1)).toFixed(1)}</strong>
                    <span className="rating-count-sub">({selectedProductDetail.rating_count})</span>
                  </div>
                )}
              </div>

              <h2 className="product-detail-title">{selectedProductDetail.title}</h2>
              <div className="product-detail-price-main">
                {formatter.format(selectedProductDetail.price)}
              </div>

              {/* Caja de Descripción Completa y Detallada */}
              <div className="product-detail-desc-box">
                <h4 className="product-detail-desc-label">DESCRIPCIÓN</h4>
                <p className="product-detail-desc-text">
                  {selectedProductDetail.description || 'Hamburguesa artesanal preparada al instante con ingredientes 100% frescos y seleccionados de primera calidad.'}
                </p>
              </div>

              {/* Barra de acción: Selector de cantidad + Botón Agregar */}
              <div className="product-detail-footer">
                <div className="product-detail-qty-picker">
                  <button 
                    type="button" 
                    className="detail-qty-btn" 
                    onClick={() => setDetailModalQty(q => Math.max(1, q - 1))}
                    disabled={detailModalQty <= 1}
                    aria-label="Disminuir cantidad"
                  >
                    <Minus size={18} />
                  </button>
                  <span className="detail-qty-number">{detailModalQty}</span>
                  <button 
                    type="button" 
                    className="detail-qty-btn" 
                    onClick={() => {
                      if (selectedProductDetail.track_stock && detailModalQty >= Number(selectedProductDetail.stock || 0)) return;
                      setDetailModalQty(q => q + 1);
                    }}
                    aria-label="Aumentar cantidad"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                <button 
                  type="button"
                  className="product-detail-add-btn"
                  onClick={() => {
                    if (!horariosStatus?.isOpen) {
                      setIsScheduleModalOpen(true);
                      return;
                    }
                    if ((selectedProductDetail.track_stock && Number(selectedProductDetail.stock) <= 0) || selectedProductDetail.status === 'Agotado') {
                      return;
                    }
                    addToCart(selectedProductDetail, detailModalQty);
                    setSelectedProductDetail(null);
                  }}
                  disabled={(selectedProductDetail.track_stock && Number(selectedProductDetail.stock) <= 0) || selectedProductDetail.status === 'Agotado'}
                >
                  <ShoppingBag size={20} />
                  <span>
                    {(selectedProductDetail.track_stock && Number(selectedProductDetail.stock) <= 0) || selectedProductDetail.status === 'Agotado'
                      ? 'AGOTADO'
                      : !horariosStatus?.isOpen
                        ? 'HORARIO CERRADO'
                        : `AGREGAR • ${formatter.format(selectedProductDetail.price * detailModalQty)}`
                    }
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <OrderTracker open={isTrackingOpen} onClose={() => setIsTrackingOpen(false)} initialOrder={latestOrder} />

      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        horariosStatus={horariosStatus}
        settings={settings}
        defaultLogo={logoImg}
      />

      {/* BARRA INFERIOR FLOTANTE ("VER PEDIDO") */}
      {cartTotalItems > 0 && !isCartOpenMobile && !selectedProductDetail && (
        <aside 
          className="mobile-cart-bar floating-order-bar" 
          onClick={() => setIsCartOpenMobile(true)}
          role="button"
          tabIndex={0}
          aria-label="Ver pedido"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsCartOpenMobile(true); } }}
        >
          <div className="mobile-cart-bar-items">
            <span className="badge-count">{cartTotalItems}</span>
          </div>
          <div className="mobile-cart-bar-center">
            <ShoppingBag size={20} className="order-bar-icon" />
            <span className="mobile-cart-bar-text">VER PEDIDO</span>
          </div>
          <span className="mobile-cart-bar-total">{formatter.format(orderTotal)}</span>
        </aside>
      )}

    </div>
  );
}

export default App;
