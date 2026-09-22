import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, CheckCircle2 } from 'lucide-react';
import { useBackModal } from '../utils/modalBackHandler';
import './ScheduleModal.css';

// Días de la semana en orden estándar de atención
const WEEK_DAYS_ORDER = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function ScheduleModal({ isOpen, onClose, horariosStatus, settings, defaultLogo }) {
  // Manejador del botón físico o gesto Atrás en Android (Capacitor y Web/PWA)
  useBackModal(isOpen, onClose, 'schedule-modal');

  // Detectar el día actual en Colombia
  const todayName = useMemo(() => {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('es-CO', { weekday: 'long', timeZone: 'America/Bogota' });
      const raw = formatter.format(now);
      // Normalizar tildes y mayúsculas (ej: 'miércoles' -> 'Miércoles')
      const normalized = raw.charAt(0).toUpperCase() + raw.slice(1);
      // Normalizar posibles diferencias de tilde
      const match = WEEK_DAYS_ORDER.find(d => d.localeCompare(normalized, 'es', { sensitivity: 'base' }) === 0);
      return match || normalized;
    } catch {
      return 'Lunes';
    }
  }, []);

  // Día seleccionado (por defecto hoy)
  const [selectedDay, setSelectedDay] = useState(todayName);

  // Al abrir el modal, asegurar que el día seleccionado sea el día de hoy
  useEffect(() => {
    if (isOpen) {
      setSelectedDay(todayName);
    }
  }, [isOpen, todayName]);

  // Cerrar con tecla Escape en teclado físico / PC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lista organizada de horarios semanales
  const daysList = useMemo(() => {
    const rawList = Array.isArray(horariosStatus?.horarios) ? horariosStatus.horarios : [];
    if (rawList.length === 0) {
      return WEEK_DAYS_ORDER.map(d => ({
        day_of_week: d,
        is_active: false,
        open_time: '17:00',
        close_time: '23:30'
      }));
    }

    // Ordenar según WEEK_DAYS_ORDER
    return [...rawList].sort((a, b) => {
      const indexA = WEEK_DAYS_ORDER.indexOf(a.day_of_week);
      const indexB = WEEK_DAYS_ORDER.indexOf(b.day_of_week);
      return (indexA !== -1 ? indexA : 99) - (indexB !== -1 ? indexB : 99);
    });
  }, [horariosStatus?.horarios]);

  if (!isOpen) return null;

  const isStoreCurrentlyOpen = Boolean(horariosStatus?.isOpen);
  const logoSrc = settings?.web_logo || settings?.logo || defaultLogo;
  const storeName = settings?.restaurant_name || 'Distrito BG';

  // Formato legible de hora HH:MM (ej. 17:00:00 -> 17:00)
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return String(timeStr).slice(0, 5);
  };

  return (
    <div
      className="schedule-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="schedule-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
      >
        {/* Encabezado con logo circular, nombre y botón X */}
        <header className="schedule-modal-header">
          <div className="schedule-header-brand">
            <div className="schedule-brand-logo-container">
              {logoSrc ? (
                <img src={logoSrc} alt={storeName} className="schedule-brand-logo" />
              ) : (
                <Clock size={20} color="#D4A017" />
              )}
            </div>
            <div className="schedule-brand-info">
              <h2 className="schedule-brand-name">{storeName}</h2>
              <div className="schedule-brand-badge">
                <span className={`schedule-status-dot-sm ${isStoreCurrentlyOpen ? 'open' : 'closed'}`} />
                <span>{isStoreCurrentlyOpen ? 'Abierto ahora' : 'Cerrado ahora'}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="schedule-modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar ventana de horarios"
          >
            <X size={18} />
          </button>
        </header>

        {/* Línea divisoria */}
        <div className="schedule-modal-divider" />

        {/* Título de sección */}
        <div className="schedule-modal-subheader">
          <h3 id="schedule-modal-title" className="schedule-section-title">
            <Clock size={16} color="#D4A017" />
            Horarios de atención
          </h3>
          <span className={`schedule-current-status-pill ${isStoreCurrentlyOpen ? 'open' : 'closed'}`}>
            {isStoreCurrentlyOpen ? 'En servicio' : 'Fuera de servicio'}
          </span>
        </div>

        {/* Lista de opciones / tarjetas independientes */}
        <div className="schedule-options-list">
          {daysList.map((day) => {
            const isSelected = selectedDay === day.day_of_week;
            const isToday = todayName.localeCompare(day.day_of_week, 'es', { sensitivity: 'base' }) === 0;
            const isOpenDay = Boolean(day.is_active);

            return (
              <div
                key={day.day_of_week}
                className={`schedule-day-card ${isSelected ? 'selected' : ''} ${!isOpenDay ? 'is-closed' : ''}`}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => setSelectedDay(day.day_of_week)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedDay(day.day_of_week);
                  }
                }}
              >
                {/* Selector circular a la izquierda + nombre del día */}
                <div className="schedule-card-left">
                  <div className="schedule-radio-outer">
                    <div className="schedule-radio-inner" />
                  </div>

                  <div className="schedule-day-details">
                    <div className="schedule-day-title-row">
                      <span className="schedule-day-name">{day.day_of_week}</span>
                      {isToday && <span className="schedule-today-badge">Hoy</span>}
                    </div>

                    <span className={`schedule-day-hours ${!isOpenDay ? 'closed-text' : ''}`}>
                      {isOpenDay
                        ? `${formatTime(day.open_time)} – ${formatTime(day.close_time)}`
                        : 'No disponible'}
                    </span>
                  </div>
                </div>

                {/* Badge de estado a la derecha */}
                <div className="schedule-card-right">
                  <span className={`schedule-status-badge ${isOpenDay ? 'open' : 'closed'}`}>
                    {isOpenDay ? 'Abierto' : 'Cerrado'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pie del modal con botón de cierre */}
        <footer className="schedule-modal-footer">
          <div className="schedule-footer-info">
            <span>Zona horaria: <strong>Colombia (GMT-5)</strong></span>
          </div>
          <button
            type="button"
            className="schedule-modal-done-btn"
            onClick={onClose}
          >
            Entendido
          </button>
        </footer>
      </div>
    </div>
  );
}
