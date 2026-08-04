import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, MapPin, PackageCheck, Search, Truck, X } from 'lucide-react';
import LiveDeliveryMap from './LiveDeliveryMap.jsx';
import { API_URL } from '../config/api';

const STEPS = ['Nuevo', 'En preparación', 'Listo', 'En camino', 'Entregado'];
const finalStatuses = new Set(['Entregado', 'Completado', 'Cancelado']);

function trackingQuery(token, phone) {
  return token
    ? `token=${encodeURIComponent(token)}`
    : `phone=${encodeURIComponent(phone)}`;
}

function durationLabel(seconds) {
  if (!Number.isFinite(Number(seconds))) return null;
  const minutes = Math.max(1, Math.ceil(Number(seconds) / 60));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export default function OrderTracker({ open, onClose, initialOrder }) {
  const [orderId, setOrderId] = useState(initialOrder?.id || '');
  const [phone, setPhone] = useState(initialOrder?.phone || '');
  const [token, setToken] = useState(initialOrder?.token || '');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!initialOrder) return;
    setOrderId(initialOrder.id);
    setPhone(initialOrder.phone || '');
    setToken(initialOrder.token || '');
  }, [initialOrder]);

  const search = useCallback(async ({ silent = false } = {}) => {
    if (!orderId || (!token && String(phone).replace(/\D/g, '').length < 7)) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/track/${orderId}?${trackingQuery(token, phone)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No encontramos el pedido');
      setOrder(data.order);
    } catch (requestError) {
      if (!silent) {
        setOrder(null);
        setError(requestError.message);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId, phone, token]);

  useEffect(() => {
    if (!open || !initialOrder) return undefined;
    search();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !finalStatuses.has(order?.order_status)) search({ silent: true });
    }, 30_000);
    return () => clearInterval(timer);
  }, [initialOrder, open, order?.order_status, search]);

  useEffect(() => {
    if (!open || !order || finalStatuses.has(order.order_status)) return undefined;
    const stream = new EventSource(`${API_URL}/track/${order.id}/stream?${trackingQuery(token, phone)}`);
    const refresh = () => search({ silent: true });
    const updateDriverLocation = (event) => {
      try {
        const data = JSON.parse(event.data || '{}');
        if (Number(data.orderId) !== Number(order.id)) return;
        setOrder((current) => {
          if (!current) return current;
          const point = { latitude: Number(data.latitude), longitude: Number(data.longitude), recorded_at: new Date().toISOString() };
          const currentTrail = current.driver?.trail || [];
          return {
            ...current,
            driver: {
              ...(current.driver || {}),
              id: data.deliveryUserId || current.driver?.id,
              latitude: point.latitude,
              longitude: point.longitude,
              updated_at: point.recorded_at,
              trail: [...currentTrail, point].slice(-120),
            },
          };
        });
      } catch {
        refresh();
      }
    };
    const expired = (event) => {
      try { setError(JSON.parse(event.data).error); } catch { setError('El seguimiento temporal finalizó'); }
      stream.close();
    };
    ['order_updated', 'order_assigned'].forEach((eventName) => stream.addEventListener(eventName, refresh));
    stream.addEventListener('delivery_location', updateDriverLocation);
    stream.addEventListener('tracking_expired', expired);
    return () => stream.close();
  }, [open, order?.id, order?.order_status, phone, token, search]);

  if (!open) return null;
  const status = order?.order_status;
  const currentIndex = status === 'Completado' ? 4 : STEPS.indexOf(status);
  const hasDriverLocation = order?.driver?.latitude != null && order?.driver?.longitude != null;
  const deliveredDuration = durationLabel(order?.delivery_duration_seconds);
  const liveDrivers = hasDriverLocation ? [{
    id: order.driver.id || 'driver',
    name: order.driver.name || 'Tu domiciliario',
    latitude: order.driver.latitude,
    longitude: order.driver.longitude,
    orderId: order.id,
    status: 'Ocupado',
  }] : [];

  return <div className="tracker-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="tracker-panel" aria-modal="true" role="dialog"><header><div><span>Seguimiento en tiempo real</span><h2>¿Dónde está mi pedido?</h2></div><button onClick={onClose} aria-label="Cerrar"><X /></button></header>
    {!token && <form onSubmit={(event) => { event.preventDefault(); search(); }} className="tracker-form"><label><span>Número de pedido</span><input inputMode="numeric" value={orderId} onChange={(event) => { setOrderId(event.target.value.replace(/\D/g, '')); setOrder(null); }} placeholder="Ej. 125" required /></label><label><span>Teléfono usado en el pedido</span><input inputMode="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setOrder(null); }} placeholder="300 000 0000" required /></label><button disabled={loading}><Search size={18} /> {loading ? 'Consultando…' : 'Consultar pedido'}</button></form>}
    {token && loading && <div className="tracker-loading">Cargando ubicación del pedido…</div>}
    {error && <div className="tracker-error">{error}{token && <button type="button" onClick={() => { setToken(''); setOrder(null); setError(''); }}>Consultar con pedido y teléfono</button>}</div>}
    {order && <div className="tracker-result"><div className="tracker-order-heading"><div><span>Pedido #{order.id}</span><h3>{order.customer_name}</h3></div><div className="tracker-status-group"><strong className={`tracker-status ${status === 'Cancelado' ? 'cancelled' : ''}`}>{status}</strong>{status === 'Entregado' && deliveredDuration && <small>Entregado en {deliveredDuration}</small>}</div></div>
      {order.delivery_status === 'En camino' && <section className="tracker-live-map"><div className="tracker-driver-heading"><div><span className="tracker-live-dot"/><div><b>{order.driver?.name || 'Tu domiciliario'} va en camino</b><small>{[order.driver?.vehicle_type, order.driver?.plate].filter(Boolean).join(' · ') || (hasDriverLocation ? 'Ubicación en vivo' : 'Esperando la primera señal GPS')}</small></div></div>{hasDriverLocation && <a href={`https://www.google.com/maps/search/?api=1&query=${order.driver.latitude},${order.driver.longitude}`} target="_blank" rel="noreferrer">Abrir mapa</a>}</div><LiveDeliveryMap apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''} mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'} store={order.store} destination={order.destination} drivers={liveDrivers} trail={order.driver?.trail || []} selectedDriverId={liveDrivers[0]?.id || null} showJourney ariaLabel="Recorrido en vivo del domiciliario"/><small>Última ubicación: {order.driver?.updated_at ? new Date(order.driver.updated_at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : 'esperando señal GPS…'}</small></section>}
      {status === 'Cancelado' ? <div className="tracker-cancelled">Este pedido fue cancelado. Comunícate con el restaurante si necesitas ayuda.</div> : <div className="tracker-timeline">{STEPS.map((step, index) => <div className={`tracker-step ${index <= currentIndex ? 'done' : ''} ${index === currentIndex ? 'current' : ''}`} key={step}><span>{index < currentIndex ? <CheckCircle /> : index === 3 ? <Truck /> : index === 4 ? <MapPin /> : index === 2 ? <PackageCheck /> : <Clock />}</span><small>{step}</small></div>)}</div>}
      <div className="tracker-summary"><div><span>Actualizado</span><strong>{new Date(order.updated_at || order.created_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</strong></div><div><span>Total</span><strong>${Number(order.total).toLocaleString('es-CO')}</strong></div></div>
      <ul>{order.items.map((item, index) => <li key={`${item.title}-${index}`}><span>{item.quantity} × {item.title}</span></li>)}</ul>
      {initialOrder?.whatsappUrl && <a className="tracker-whatsapp" href={initialOrder.whatsappUrl} target="_blank" rel="noreferrer">Reenviar detalle por WhatsApp</a>}
      {finalStatuses.has(status) && token && (
        <button type="button" style={{ width: '100%', marginTop: '1rem', padding: '12px', background: '#2a2a2a', color: '#fff', border: '1px solid #333', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => {
          localStorage.removeItem('distrito_latest_order');
          setToken('');
          setOrderId('');
          setPhone('');
          setOrder(null);
        }}>Consultar otro pedido</button>
      )}
    </div>}
  </section></div>;
}
