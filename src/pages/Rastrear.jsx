import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, MapPin, PackageCheck, Truck, AlertCircle, Package, RefreshCw } from 'lucide-react';
import LiveDeliveryMap from '../components/LiveDeliveryMap.jsx';
import { API_URL } from '../config/api';

const STEPS = ['Nuevo', 'En preparación', 'Listo', 'En camino', 'Entregado'];
const finalStatuses = new Set(['Entregado', 'Completado', 'Cancelado']);

function durationLabel(seconds) {
  if (!Number.isFinite(Number(seconds))) return null;
  const minutes = Math.max(1, Math.ceil(Number(seconds) / 60));
  return minutes < 60
    ? `${minutes} min`
    : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function statusColor(status) {
  const map = {
    'Nuevo': '#D4A017',
    'En preparación': '#60A5FA',
    'Listo': '#4ADE80',
    'En camino': '#FBBF24',
    'Entregado': '#4ADE80',
    'Completado': '#4ADE80',
    'Cancelado': '#F87171',
  };
  return map[status] || '#BDBDBD';
}

/** Lee ?c=XXXX de la URL */
function getCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('c') || '').replace(/\D/g, '').slice(-4);
}

/** Lee el ID del path: /rastrear/246 */
function getIdFromPath() {
  const parts = window.location.pathname.split('/');
  const idx = parts.findIndex((p) => p === 'rastrear');
  return idx >= 0 ? parseInt(parts[idx + 1], 10) : null;
}

export default function Rastrear() {
  const orderId = getIdFromPath();
  const code = getCodeFromUrl();

  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetch_ = useCallback(async ({ silent = false } = {}) => {
    if (!orderId || !code) {
      setError('Enlace inválido. Verifica que el enlace sea correcto.');
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/rastrear/${orderId}?c=${code}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo consultar el pedido');
      setOrder(data.order);
      setLastRefresh(new Date());
    } catch (err) {
      if (!silent) {
        setOrder(null);
        setError(err.message);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId, code]);

  // Carga inicial
  useEffect(() => { fetch_(); }, [fetch_]);

  // Actualización automática cada 30 segundos mientras no esté finalizado
  useEffect(() => {
    if (!order || finalStatuses.has(order.order_status)) return undefined;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetch_({ silent: true });
    }, 30_000);
    return () => clearInterval(timer);
  }, [order?.order_status, fetch_]);

  // SSE para ubicación en tiempo real cuando está "En camino"
  useEffect(() => {
    if (!order || finalStatuses.has(order.order_status)) return undefined;
    const stream = new EventSource(`${API_URL}/track/${order.id}/stream?phone=${encodeURIComponent('')}`);
    const updateDriverLocation = (event) => {
      try {
        const data = JSON.parse(event.data || '{}');
        if (Number(data.orderId) !== Number(order.id)) return;
        setOrder((current) => {
          if (!current) return current;
          const point = {
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            recorded_at: new Date().toISOString(),
          };
          const trail = current.driver?.trail || [];
          return {
            ...current,
            driver: {
              ...(current.driver || {}),
              latitude: point.latitude,
              longitude: point.longitude,
              updated_at: point.recorded_at,
              trail: [...trail, point].slice(-120),
            },
          };
        });
      } catch { fetch_({ silent: true }); }
    };
    ['order_updated', 'order_assigned'].forEach((ev) => stream.addEventListener(ev, () => fetch_({ silent: true })));
    stream.addEventListener('delivery_location', updateDriverLocation);
    return () => stream.close();
  }, [order?.id, order?.order_status, fetch_]);

  const status = order?.order_status;
  const deliveryStatus = order?.delivery_status;
  const currentIndex = status === 'Completado' ? 4 : STEPS.indexOf(status);
  const hasDriverLocation = order?.driver?.latitude != null && order?.driver?.longitude != null;
  const deliveredDuration = durationLabel(order?.delivery_duration_seconds);
  const isFinal = finalStatuses.has(status);

  const liveDrivers = hasDriverLocation ? [{
    id: 'driver',
    name: order.driver?.name || 'Domiciliario',
    latitude: order.driver.latitude,
    longitude: order.driver.longitude,
    orderId: order.id,
    status: 'Ocupado',
  }] : [];

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0A0A0A',
      color: '#FFFFFF',
      fontFamily: "'Montserrat', 'Inter', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0 16px 40px',
    }}>
      {/* Header */}
      <header style={{
        width: '100%',
        maxWidth: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 0 20px',
        borderBottom: '1px solid #1E1E1E',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 28 }}>🛵</span>
          <div>
            <div style={{ fontSize: 11, color: '#BDBDBD', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Distrito BG</div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Rastrear pedido</div>
          </div>
        </div>
        {!loading && (
          <button
            onClick={() => fetch_()}
            title="Actualizar"
            style={{ background: 'none', border: '1px solid #2A2A2A', borderRadius: 8, padding: '6px 10px', color: '#BDBDBD', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <RefreshCw size={15} /> Actualizar
          </button>
        )}
      </header>

      <main style={{ width: '100%', maxWidth: 600, marginTop: 28 }}>
        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#BDBDBD' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
            <p>Consultando tu pedido…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div style={{
            backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 16, padding: '24px', textAlign: 'center',
          }}>
            <AlertCircle size={36} color="#F87171" style={{ marginBottom: 12 }} />
            <p style={{ color: '#F87171', fontWeight: 600, margin: '0 0 8px' }}>{error}</p>
            <p style={{ color: '#BDBDBD', fontSize: 13, margin: 0 }}>
              Verifica que el enlace sea el que te enviaron por WhatsApp.
            </p>
          </div>
        )}

        {/* Pedido encontrado */}
        {!loading && order && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Encabezado del pedido */}
            <div style={{
              backgroundColor: '#111111', borderRadius: 20, padding: '24px',
              border: '1px solid #1E1E1E', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, color: '#BDBDBD', fontWeight: 600 }}>Pedido</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF' }}>#{order.id}</div>
                <div style={{ fontSize: 13, color: '#BDBDBD', marginTop: 4 }}>
                  {new Date(order.created_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{
                  backgroundColor: `${statusColor(status)}22`,
                  color: statusColor(status),
                  padding: '8px 16px', borderRadius: 999, fontSize: 14, fontWeight: 700,
                }}>
                  {status}
                </span>
                {status === 'Entregado' && deliveredDuration && (
                  <div style={{ color: '#4ADE80', fontSize: 12, marginTop: 6 }}>
                    ✓ Entregado en {deliveredDuration}
                  </div>
                )}
              </div>
            </div>

            {/* Mapa en vivo — solo cuando está en camino */}
            {deliveryStatus === 'En camino' && (
              <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid #1E1E1E' }}>
                <div style={{ backgroundColor: '#111', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#4ADE80', display: 'inline-block', boxShadow: '0 0 0 4px rgba(74,222,128,0.2)', animation: 'pulse 1.5s infinite' }} />
                  <div>
                    <b style={{ fontSize: 14 }}>{order.driver?.name || 'Tu domiciliario'} va en camino</b>
                    <div style={{ color: '#BDBDBD', fontSize: 12, marginTop: 2 }}>
                      {[order.driver?.vehicle_type, order.driver?.plate].filter(Boolean).join(' · ') || 'Ubicación en vivo'}
                    </div>
                  </div>
                  {hasDriverLocation && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${order.driver.latitude},${order.driver.longitude}`}
                      target="_blank" rel="noreferrer"
                      style={{ marginLeft: 'auto', fontSize: 12, color: '#D4A017', textDecoration: 'none', fontWeight: 600 }}
                    >
                      Abrir en Maps
                    </a>
                  )}
                </div>
                <LiveDeliveryMap
                  apiKey={typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GOOGLE_MAPS_API_KEY || '' : ''}
                  mapId={typeof import.meta !== 'undefined' ? import.meta.env?.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID' : 'DEMO_MAP_ID'}
                  store={order.store}
                  destination={order.destination}
                  drivers={liveDrivers}
                  trail={order.driver?.trail || []}
                  selectedDriverId={liveDrivers[0]?.id || null}
                  showJourney
                  ariaLabel="Recorrido en vivo del domiciliario"
                  className=""
                  style={{ minHeight: 280 }}
                />
                <div style={{ backgroundColor: '#111', padding: '10px 20px', fontSize: 12, color: '#6B7280', textAlign: 'right' }}>
                  Última señal GPS: {order.driver?.updated_at
                    ? new Date(order.driver.updated_at).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
                    : 'esperando…'}
                </div>
              </div>
            )}

            {/* Timeline de estados */}
            {status !== 'Cancelado' ? (
              <div style={{ backgroundColor: '#111111', borderRadius: 20, padding: '24px', border: '1px solid #1E1E1E' }}>
                <div style={{ fontSize: 13, color: '#BDBDBD', fontWeight: 600, marginBottom: 20, textTransform: 'uppercase', letterSpacing: 1 }}>Estado del pedido</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                  {/* Línea de progreso */}
                  <div style={{ position: 'absolute', top: 18, left: '10%', right: '10%', height: 2, backgroundColor: '#1E1E1E', zIndex: 0 }} />
                  <div style={{
                    position: 'absolute', top: 18, left: '10%', height: 2,
                    width: `${Math.max(0, currentIndex / (STEPS.length - 1)) * 80}%`,
                    backgroundColor: '#D4A017', zIndex: 1, transition: 'width 0.5s ease',
                  }} />
                  {STEPS.map((step, index) => {
                    const done = index <= currentIndex;
                    const current = index === currentIndex;
                    return (
                      <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flex: 1, position: 'relative', zIndex: 2 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          backgroundColor: done ? (current ? '#D4A017' : '#1A3A1A') : '#1E1E1E',
                          border: `2px solid ${done ? '#D4A017' : '#2A2A2A'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: done ? (current ? '#000' : '#4ADE80') : '#4A4A4A',
                          transition: 'all 0.3s',
                        }}>
                          {index < currentIndex ? <CheckCircle size={16} />
                            : index === 3 ? <Truck size={16} />
                            : index === 4 ? <MapPin size={16} />
                            : index === 2 ? <PackageCheck size={16} />
                            : <Clock size={16} />}
                        </div>
                        <span style={{ fontSize: 11, color: done ? '#FFFFFF' : '#4A4A4A', fontWeight: done ? 600 : 400, textAlign: 'center' }}>
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: 20, textAlign: 'center', color: '#F87171' }}>
                Este pedido fue cancelado. Comunícate con el restaurante si necesitas ayuda.
              </div>
            )}

            {/* Resumen de productos */}
            <div style={{ backgroundColor: '#111111', borderRadius: 20, padding: '24px', border: '1px solid #1E1E1E' }}>
              <div style={{ fontSize: 13, color: '#BDBDBD', fontWeight: 600, marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
                <Package size={14} style={{ marginRight: 6 }} />Productos
              </div>
              {(order.items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: i < order.items.length - 1 ? '1px solid #1E1E1E' : 'none' }}>
                  <span style={{ color: '#E5E5E5', fontSize: 14 }}>{item.quantity} × {item.title}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, marginTop: 4, borderTop: '2px solid #2A2A2A' }}>
                <span style={{ fontWeight: 700, color: '#FFFFFF' }}>Total</span>
                <span style={{ fontWeight: 800, color: '#D4A017', fontSize: 16 }}>
                  ${Number(order.total).toLocaleString('es-CO')}
                </span>
              </div>
            </div>

            {/* Última actualización */}
            {lastRefresh && (
              <div style={{ textAlign: 'center', fontSize: 12, color: '#4A4A4A' }}>
                Actualizado: {lastRefresh.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                {!isFinal && ' · Se actualiza cada 30 segundos'}
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(74,222,128,0.2); }
          50% { box-shadow: 0 0 0 8px rgba(74,222,128,0.05); }
        }
      `}</style>
    </div>
  );
}
