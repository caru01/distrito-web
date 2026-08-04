const HEX = /^#[0-9A-Fa-f]{6}$/;

export function applyWebTheme(settings = {}) {
  const values = {
    '--primary-color': settings.web_primary_color,
    '--primary-hover': settings.web_primary_color,
    '--bg-color': settings.web_background_color,
    '--card-bg': settings.web_surface_color,
    '--text-main': settings.web_text_color,
  };
  Object.entries(values).forEach(([property, value]) => {
    if (HEX.test(String(value || ''))) document.documentElement.style.setProperty(property, value);
  });
}
