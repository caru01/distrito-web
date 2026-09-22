import { useEffect, useRef } from 'react';

// Pila global de modales abiertos
const modalStack = [];
let capacitorListenerAttached = false;
let isInternalBack = false;

// Inicializa el listener nativo de Capacitor si está presente en el entorno
function setupCapacitorListener() {
  if (capacitorListenerAttached) return;
  
  const AppPlugin = window.Capacitor?.Plugins?.App;
  if (AppPlugin && typeof AppPlugin.addListener === 'function') {
    capacitorListenerAttached = true;
    try {
      AppPlugin.addListener('backButton', () => {
        if (modalStack.length > 0) {
          const topModal = modalStack[modalStack.length - 1];
          if (topModal && typeof topModal.close === 'function') {
            topModal.close();
          }
        }
      });
    } catch (err) {
      console.warn('No se pudo suscribir al evento backButton de Capacitor:', err);
    }
  }
}

/**
 * Hook para registrar un modal y capturar el botón físico o gesto Atrás en Android.
 * Compatible con:
 * 1. Capacitor Android (Plugin App backButton)
 * 2. Web móvil y PWA (history.pushState + popstate)
 * 
 * @param {boolean} isOpen - Estado del modal
 * @param {function} onClose - Función que cierra el modal
 * @param {string} [modalKey='schedule-modal'] - Identificador opcional
 */
export function useBackModal(isOpen, onClose, modalKey = 'schedule-modal') {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const historyPushedRef = useRef(false);

  useEffect(() => {
    setupCapacitorListener();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    // Objeto descriptor en el stack
    const modalItem = {
      key: modalKey,
      close: () => {
        onCloseRef.current?.();
      }
    };

    modalStack.push(modalItem);

    // En navegador / PWA: empujar estado a history para capturar el botón atrás físico
    const stateObj = { [modalKey]: true, timestamp: Date.now() };
    try {
      window.history.pushState(stateObj, '');
      historyPushedRef.current = true;
    } catch (e) {
      // Ignorar si el navegador restringe pushState
    }

    const handlePopState = () => {
      if (isInternalBack) {
        isInternalBack = false;
        return;
      }

      // Si el usuario presionó el botón atrás del navegador/dispositivo
      const index = modalStack.indexOf(modalItem);
      if (index !== -1) {
        modalStack.splice(index, 1);
        historyPushedRef.current = false;
        onCloseRef.current?.();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // Quitar del stack si aún sigue
      const index = modalStack.indexOf(modalItem);
      if (index !== -1) {
        modalStack.splice(index, 1);
      }

      // Si el modal se cerró por botón X o backdrop (no por popstate),
      // retirar el estado del historial para mantenerlo limpio
      if (historyPushedRef.current) {
        historyPushedRef.current = false;
        isInternalBack = true;
        try {
          window.history.back();
        } catch (e) {}
      }
    };
  }, [isOpen, modalKey]);
}
