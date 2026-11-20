import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Sparkles, ArrowRight, Tag, Flame } from 'lucide-react';
import { useBackModal } from '../utils/modalBackHandler';
import districStar from '../assets/distric-star.png';
import './AnnouncementModal.css';

export default function AnnouncementModal({
  isOpen,
  announcement,
  onClose,
  onAction,
}) {
  const [copied, setCopied] = useState(false);

  // Manejo de botón Atrás en Android (Capacitor y PWA)
  useBackModal(isOpen, onClose, 'announcement-modal');

  // Cerrar con Escape en PC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !announcement || announcement.is_visible === false) return null;

  const styleType = announcement.popup_style || 'modern_card';
  const hasImage = Boolean(announcement.image_url);
  const hasBody = Boolean(announcement.body && announcement.body.trim().length > 0);
  const hasTitle = Boolean(announcement.title && announcement.title.trim().length > 0);
  const coupon = announcement.coupon_code;
  const hasText = hasTitle || hasBody || Boolean(coupon);

  const handleCopyCoupon = (e) => {
    e.stopPropagation();
    if (!coupon) return;
    try {
      navigator.clipboard.writeText(coupon);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // fallback
    }
  };

  const handleCtaClick = () => {
    if (typeof onAction === 'function') {
      onAction(announcement);
    }
  };

  return (
    <div
      className="announcement-modal-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* =================================================================
          PLANTILLA 2: POSTER_FULL (Póster / Flyer Full)
          ================================================================= */}
      {styleType === 'poster_full' ? (
        <div
          className="announcement-card-poster"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="announcement-modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar anuncio"
          >
            <X size={20} />
          </button>

          {hasImage && (
            <div className="announcement-poster-media">
              <img
                className="announcement-poster-img"
                src={announcement.image_url}
                alt={announcement.title || 'Anuncio Distric House'}
                decoding="async"
              />
            </div>
          )}

          <div className={`announcement-poster-overlay ${!hasText ? 'compact' : ''}`}>
            {hasTitle && (
              <h3 className="announcement-poster-title">{announcement.title}</h3>
            )}
            {hasBody && (
              <p className="announcement-poster-desc">{announcement.body}</p>
            )}

            {coupon && (
              <div className="announcement-coupon-box">
                <div className="announcement-coupon-info">
                  <Tag size={18} className="announcement-coupon-icon" />
                  <div>
                    <span className="announcement-coupon-label">Cupón exclusivo</span>
                    <span className="announcement-coupon-code">{coupon}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`announcement-coupon-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopyCoupon}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className="announcement-modern-btn"
              onClick={handleCtaClick}
            >
              <span>{announcement.cta_label || 'Ver menú'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : styleType === 'dark_street' ? (
        /* =================================================================
           PLANTILLA 3: DARK_STREET (Dark Street Food / Urban Night)
           ================================================================= */
        <div
          className="announcement-card-dark"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="announcement-modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar anuncio"
          >
            <X size={20} />
          </button>

          <div className="announcement-dark-header">
            <span className="announcement-dark-pill">
              <Flame size={14} />
              <span>DISTRITO HOUSE • NOVEDAD</span>
            </span>
          </div>

          {hasImage && (
            <div className="announcement-dark-media">
              <img
                className="announcement-dark-img"
                src={announcement.image_url}
                alt={announcement.title || 'Anuncio Distric House'}
                decoding="async"
              />
            </div>
          )}

          <div className={`announcement-dark-body ${!hasText ? 'compact' : ''}`}>
            {hasTitle && (
              <h3 className="announcement-dark-title">{announcement.title}</h3>
            )}
            {hasBody && (
              <p className="announcement-dark-desc">{announcement.body}</p>
            )}

            {coupon && (
              <div className="announcement-coupon-box">
                <div className="announcement-coupon-info">
                  <Tag size={18} className="announcement-coupon-icon" />
                  <div>
                    <span className="announcement-coupon-label">Cupón exclusivo</span>
                    <span className="announcement-coupon-code">{coupon}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`announcement-coupon-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopyCoupon}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className="announcement-modern-btn"
              onClick={handleCtaClick}
            >
              <span>{announcement.cta_label || 'Pedir ahora'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      ) : (
        /* =================================================================
           PLANTILLA 1: MODERN_CARD (Tarjeta Moderna Cristal - Predeterminada)
           ================================================================= */
        <div
          className="announcement-card-modern"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="announcement-modal-close-btn"
            onClick={onClose}
            aria-label="Cerrar anuncio"
          >
            <X size={20} />
          </button>

          <div className="announcement-modern-header">
            <span className="announcement-brand-pill">
              <img src={districStar} alt="" />
              <span>DISTRITO HOUSE • ESPECIAL</span>
            </span>
          </div>

          {hasImage && (
            <div className="announcement-modern-media">
              <img
                className="announcement-modern-img"
                src={announcement.image_url}
                alt={announcement.title || 'Anuncio Distric House'}
                decoding="async"
              />
            </div>
          )}

          <div className={`announcement-modern-body ${!hasText ? 'compact' : ''}`}>
            {hasTitle && (
              <h3 className="announcement-modern-title">{announcement.title}</h3>
            )}
            {hasBody && (
              <p className="announcement-modern-desc">{announcement.body}</p>
            )}

            {coupon && (
              <div className="announcement-coupon-box">
                <div className="announcement-coupon-info">
                  <Tag size={18} className="announcement-coupon-icon" />
                  <div>
                    <span className="announcement-coupon-label">Cupón de descuento</span>
                    <span className="announcement-coupon-code">{coupon}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`announcement-coupon-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={handleCopyCoupon}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              className="announcement-modern-btn"
              onClick={handleCtaClick}
            >
              <Sparkles size={14} />
              <span>{announcement.cta_label || 'Ver más'}</span>
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
