// Marca HomeLab para superficies fuera de React (documentos imprimibles, correo)
// que no pueden leer src/app/homelab-tokens.css.
//
//  - DOC_TOKENS_CSS: bloque :root para el <style> de un documento HTML autónomo.
//    Valores oklch copiados de homelab-tokens.css (§1–§9). Excepción deliberada
//    (paso 15): el fondo/borde de pantalla llevan un croma frío mínimo que un
//    documento imprimible NO debe tener — acá se mantienen los neutrales puros.
//  - BRAND_HEX: equivalentes sRGB para el correo (los clientes de correo no
//    soportan oklch() ni var()).

export const LOGO_PATH = '/homelab-logo.png'
export const LOGO_ASPECT = 537 / 278 // 1.9317 — proporción real del PNG

/** Alto de render del logo en documentos; el ancho se deriva del aspect ratio. */
export const LOGO_RENDER_HEIGHT = 48
export const LOGO_RENDER_WIDTH = Math.round(LOGO_RENDER_HEIGHT * LOGO_ASPECT) // 93

/**
 * Tokens del HomeLab Design System para un documento imprimible autónomo.
 * Se inyecta tal cual dentro de <style>. Espejo de homelab-tokens.css:26-144.
 */
export const DOC_TOKENS_CSS = `
  :root {
    /* Neutrales */
    --neutral-0:   oklch(1 0 0);
    --neutral-50:  oklch(0.985 0 0);
    --neutral-100: oklch(0.970 0 0);
    --neutral-200: oklch(0.922 0 0);
    --neutral-300: oklch(0.870 0 0);
    --neutral-400: oklch(0.708 0 0);
    --neutral-500: oklch(0.556 0 0);
    --neutral-600: oklch(0.440 0 0);
    --neutral-700: oklch(0.371 0 0);
    --neutral-900: oklch(0.205 0 0);
    --neutral-950: oklch(0.145 0 0);

    /* Marca */
    --brand-blue:          oklch(0.559 0.126 244.3);
    --brand-blue-strong:   oklch(0.513 0.119 244.7);
    --brand-orange:        oklch(0.724 0.157 47.5);
    --brand-orange-soft:   oklch(0.960 0.040 60);
    --brand-orange-fg:     oklch(0.530 0.150 47);

    /* Semánticos */
    --color-bg:            var(--neutral-100);
    --color-surface:       var(--neutral-0);
    --color-surface-muted: var(--neutral-100);
    --color-fg:            var(--neutral-950);
    --color-fg-muted:      var(--neutral-500);
    --color-fg-subtle:     var(--neutral-400);
    --color-border:        var(--neutral-200);
    --color-primary:       var(--brand-blue);
    --color-primary-fg:    var(--neutral-0);

    /* Tipografía */
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
    --text-xs:   11px;
    --text-sm:   12px;
    --text-base: 13px;
    --text-md:   14px;
    --text-lg:   16px;
    --text-xl:   20px;
    --tracking-label: 0.06em;

    /* Radios */
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 10px;

    /* Elevación */
    --shadow-sm: 0 1px 3px oklch(0 0 0 / 0.07), 0 1px 2px oklch(0 0 0 / 0.04);

    /* Densidad (medium) */
    --row-py:  12px;
    --cell-px: 16px;
  }
`

/** Paleta de marca en hex sRGB — para HTML de correo. */
export const BRAND_HEX = {
  blue: '#1F7AB8',
  blueStrong: '#166CA6',
  orange: '#F38345',
  fg: '#0a0a0a',
  fgMuted: '#737373',
  fgSubtle: '#a3a3a3',
  border: '#e5e5e5',
  surface: '#ffffff',
  surfaceMuted: '#f5f5f5',
} as const
