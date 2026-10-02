import React, { useState, useEffect } from 'react';

/**
 * DevEnvironmentWrapper
 * Entorno de Pruebas y Simulador Local para Distrito BG
 * 
 * Activo únicamente en modo desarrollo local (import.meta.env.DEV).
 * Permite cambiar de vistas (?view=customer | admin | split)
 * y alternar entre simulador de celular (?mode=mobile) y pantalla completa (?mode=desktop).
 */
export default function DevEnvironmentWrapper({ children }) {
  // En producción, no intervenir en absoluto
  if (!import.meta.env.DEV) {
    return <>{children}</>;
  }

  const getQueryParam = (key, defaultVal) => {
    if (typeof window === 'undefined') return defaultVal;
    const params = new URLSearchParams(window.location.search);
    return params.get(key) || defaultVal;
  };

  const initialView = getQueryParam('view', 'customer');
  const initialMode = getQueryParam('mode', 'desktop');

  const [currentView, setCurrentView] = useState(initialView);
  const [currentMode, setCurrentMode] = useState(initialMode);
  const [isToolbarOpen, setIsToolbarOpen] = useState(true);

  // Sincronizar estado cuando el usuario cambia la URL manualmente
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.has('view')) setCurrentView(params.get('view'));
      if (params.has('mode')) setCurrentMode(params.get('mode'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Actualizar query params en la URL sin recargar
  const updateUrlParams = (newView, newMode) => {
    const url = new URL(window.location.href);
    if (newView) url.searchParams.set('view', newView);
    if (newMode) url.searchParams.set('mode', newMode);
    window.history.replaceState({}, '', url.toString());
  };

  const switchView = (view) => {
    setCurrentView(view);
    updateUrlParams(view, currentMode);
  };

  const switchMode = (mode) => {
    setCurrentMode(mode);
    updateUrlParams(currentView, mode);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A0A0A', position: 'relative' }}>
      
      {/* BARRA SUPERIOR DE DESARROLLO (DEV TOOLBAR) */}
      {isToolbarOpen ? (
        <div style={{
          position: 'fixed',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 999999,
          backgroundColor: 'rgba(18, 18, 18, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(212, 160, 23, 0.4)',
          borderRadius: '30px',
          padding: '6px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          fontSize: '13px',
          color: '#FFFFFF'
        }}>
          {/* Logo Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            paddingRight: '8px',
            borderRight: '1px solid rgba(255,255,255,0.15)',
            fontWeight: '800',
            color: '#D4A017',
            fontSize: '12px'
          }}>
            <span>⚡ DEV HUB</span>
          </div>

          {/* Selector de Vistas */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              onClick={() => switchView('customer')}
              style={{
                backgroundColor: currentView === 'customer' ? '#D4A017' : 'transparent',
                color: currentView === 'customer' ? '#000000' : '#CCCCCC',
                border: 'none',
                borderRadius: '16px',
                padding: '4px 10px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Ver Tienda del Cliente (?view=customer)"
            >
              🍔 Cliente
            </button>

            <button
              type="button"
              onClick={() => switchView('admin')}
              style={{
                backgroundColor: currentView === 'admin' ? '#D4A017' : 'transparent',
                color: currentView === 'admin' ? '#000000' : '#CCCCCC',
                border: 'none',
                borderRadius: '16px',
                padding: '4px 10px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Ver Panel de Administración (?view=admin)"
            >
              📊 Admin
            </button>

            <button
              type="button"
              onClick={() => switchView('split')}
              style={{
                backgroundColor: currentView === 'split' ? '#FF441F' : 'transparent',
                color: currentView === 'split' ? '#FFFFFF' : '#CCCCCC',
                border: 'none',
                borderRadius: '16px',
                padding: '4px 10px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
              title="Modo Laboratorio: Celular y Admin lado a lado (?view=split)"
            >
              ⚡ Dividido
            </button>
          </div>

          {/* Separador */}
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.15)' }} />

          {/* Selector de Modo (Celular vs Escritorio) */}
          {currentView !== 'split' && (
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                onClick={() => switchMode(currentMode === 'mobile' ? 'desktop' : 'mobile')}
                style={{
                  backgroundColor: currentMode === 'mobile' ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
                  color: currentMode === 'mobile' ? '#60A5FA' : '#AAAAAA',
                  border: currentMode === 'mobile' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                  borderRadius: '16px',
                  padding: '4px 10px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
                title="Alternar marco de teléfono móvil (?mode=mobile)"
              >
                {currentMode === 'mobile' ? '📱 Celular' : '🖥️ Pantalla Completa'}
              </button>
            </div>
          )}

          {/* Botón Minimizar */}
          <button
            type="button"
            onClick={() => setIsToolbarOpen(false)}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#666666',
              cursor: 'pointer',
              fontSize: '14px',
              padding: '2px 6px',
              marginLeft: '4px'
            }}
            title="Ocultar barra de desarrollo"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsToolbarOpen(true)}
          style={{
            position: 'fixed',
            bottom: '16px',
            right: '16px',
            zIndex: 999999,
            backgroundColor: '#D4A017',
            color: '#000000',
            fontWeight: '800',
            border: 'none',
            borderRadius: '20px',
            padding: '8px 14px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
            fontSize: '12px'
          }}
          title="Abrir Dev Hub"
        >
          ⚡ Dev Hub
        </button>
      )}

      {/* RENDERIZADO SEGÚN LA VISTA Y MODO */}

      {/* CASO 1: VISTA SPLIT (LABORATORIO EN VIVO: CELULAR + ADMIN) */}
      {currentView === 'split' ? (
        <div style={{
          display: 'flex',
          height: '100vh',
          width: '100vw',
          overflow: 'hidden',
          backgroundColor: '#0F0F0F'
        }}>
          {/* LADO IZQUIERDO: SIMULADOR DE CELULAR DEL CLIENTE */}
          <div style={{
            width: '450px',
            minWidth: '450px',
            height: '100%',
            borderRight: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#070707',
            padding: '20px'
          }}>
            <div style={{ color: '#D4A017', fontSize: '12px', fontWeight: '700', marginBottom: '8px', letterSpacing: '1px' }}>
              📱 VISTA DEL CLIENTE (MÓVIL)
            </div>
            
            {/* Marco iPhone */}
            <div style={{
              width: '390px',
              height: '760px',
              borderRadius: '44px',
              border: '10px solid #242424',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)',
              overflow: 'hidden',
              position: 'relative',
              backgroundColor: '#000000'
            }}>
              {/* Dynamic Island / Notch */}
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '110px',
                height: '24px',
                backgroundColor: '#000000',
                borderRadius: '16px',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#181818', marginRight: '6px' }} />
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#111111' }} />
              </div>

              {/* Contenido de la tienda con scroll nativo */}
              <div style={{ width: '100%', height: '100%', overflowY: 'auto' }}>
                {children}
              </div>
            </div>
          </div>

          {/* LADO DERECHO: PANEL DE ADMINISTRACIÓN EN TIEMPO REAL */}
          <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{
              height: '40px',
              backgroundColor: '#151515',
              borderBottom: '1px solid #252525',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              color: '#AAAAAA',
              fontSize: '12px'
            }}>
              <span style={{ fontWeight: '700', color: '#FFFFFF' }}>
                📊 Panel de Control en Tiempo Real (Módulo de Pedidos)
              </span>
              <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} />
                Sincronización en vivo 0ms
              </span>
            </div>
            <iframe
              src="http://localhost:5174/admin/pedidos"
              style={{ flex: 1, width: '100%', border: 'none', backgroundColor: '#0A0A0A' }}
              title="Panel de Pedidos Distrito BG"
            />
          </div>
        </div>
      ) : currentView === 'admin' ? (
        /* CASO 2: VISTA ADMIN COMPLETA */
        <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
          <iframe
            src="http://localhost:5174/admin/pedidos"
            style={{ width: '100%', height: '100%', border: 'none', backgroundColor: '#0A0A0A' }}
            title="Panel de Administración"
          />
        </div>
      ) : (
        /* CASO 3: VISTA CLIENTE */
        currentMode === 'mobile' ? (
          /* En marco de celular */
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            backgroundColor: '#070707'
          }}>
            <div style={{
              width: '400px',
              height: '840px',
              borderRadius: '48px',
              border: '12px solid #222222',
              boxShadow: '0 25px 70px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08)',
              overflow: 'hidden',
              position: 'relative',
              backgroundColor: '#000000'
            }}>
              {/* Dynamic Island */}
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '116px',
                height: '26px',
                backgroundColor: '#000000',
                borderRadius: '16px',
                zIndex: 9999
              }} />

              {/* Contenido con scroll */}
              <div style={{ width: '100%', height: '100%', overflowY: 'auto' }}>
                {children}
              </div>
            </div>
          </div>
        ) : (
          /* En pantalla completa normal */
          <div style={{ width: '100%', minHeight: '100vh' }}>
            {children}
          </div>
        )
      )}

    </div>
  );
}
