/**
 * Layout inspector: measures exact distances between elements, inspects
 * computed CSS, surfaces global CSS variables and flags WCAG contrast issues
 * on hover.
 *
 * The probe runs inside the inspected page, so it must be self contained and
 * defensive: pages can be hostile and can navigate at any moment.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BoxInfo {
  margin: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
  padding: { top: number; right: number; bottom: number; left: number };
}

export interface ContrastInfo {
  color: string;
  background: string;
  ratio: number;
  /** AA threshold depends on font size: 4.5 normal, 3 for large text. */
  requiredAA: number;
  requiredAAA: number;
  fontSize: number;
  fontWeight: number;
  isLargeText: boolean;
  passesAA: boolean;
  passesAAA: boolean;
}

export interface Inspection {
  selector: string;
  tag: string;
  id: string;
  classes: string[];
  rect: Rect;
  box: BoxInfo;
  /** Edges of the element relative to the viewport, for distance rulers. */
  distances: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  display: string;
  position: string;
  fontSize: string;
  lineHeight: string;
  fontFamily: string;
  fontWeight: string;
  color: string;
  background: string;
  zIndex: string;
  overflow: string;
  cssVariables: Record<string, string>;
  contrast: ContrastInfo | null;
}

/** Installs (or removes) the hover probe and returns true while enabled. */
export const INSTALL_PROBE = `
(function () {
  var KEY = '__devbrowserInspector';

  if (!window[KEY]) {
    var overlay = document.createElement('div');
    overlay.setAttribute('data-devbrowser-overlay', '');
    overlay.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:2147483647',
      'border:1px solid #3b82f6',
      'background:rgba(59,130,246,0.15)',
      'border-radius:1px',
      'transition:all 0.05s linear'
    ].join(';');

    var label = document.createElement('div');
    label.setAttribute('data-devbrowser-label', '');
    label.style.cssText = [
      'position:fixed',
      'pointer-events:none',
      'z-index:2147483647',
      'background:#3b82f6',
      'color:#fff',
      'font:11px/1.4 ui-monospace,Menlo,Consolas,monospace',
      'padding:2px 5px',
      'border-radius:3px',
      'white-space:nowrap'
    ].join(';');

    window[KEY] = { overlay: overlay, label: label, enabled: false, target: null };

    // Track the element under the cursor without touching page behaviour.
    document.addEventListener('mousemove', function (e) {
      window[KEY].target = e.target;
    }, true);

    window.addEventListener('scroll', function () {
      window[KEY].target = window[KEY].target;
    }, true);
  }

  var state = window[KEY];

  if (!state.enabled) {
    if (state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    if (state.label.parentNode) state.label.parentNode.removeChild(state.label);
    state.enabled = false;
    return false;
  }

  if (!state.overlay.parentNode) {
    (document.body || document.documentElement).appendChild(state.overlay);
    (document.body || document.documentElement).appendChild(state.label);
  }

  state.enabled = true;
  return true;
})()
`;

/** Reads the currently hovered element and returns its full inspection. */
export const READ_TARGET = `
(function () {
  var KEY = '__devbrowserInspector';
  var state = window[KEY];
  if (!state || !state.enabled) return null;

  var el = state.target;
  if (!el || el.nodeType !== 1) return null;
  // Never inspect our own overlay.
  if (el.hasAttribute && (el.hasAttribute('data-devbrowser-overlay') || el.hasAttribute('data-devbrowser-label'))) return null;

  var rect = el.getBoundingClientRect();
  var cs = window.getComputedStyle(el);

  function px(value) {
    var n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  }
  function side(prefix) {
    return {
      top: px(cs[prefix + 'Top']),
      right: px(cs[prefix + 'Right']),
      bottom: px(cs[prefix + 'Bottom']),
      left: px(cs[prefix + 'Left'])
    };
  }

  var fontSize = px(cs.fontSize);
  var fontWeight = parseInt(cs.fontWeight, 10);
  if (isNaN(fontWeight)) fontWeight = 400;
  // WCAG large text: >=24px, or >=18.66px when bold.
  var isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);

  function parseColor(value) {
    var m = value && value.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    var parts = m[1].split(',').map(function (p) { return parseFloat(p); });
    if (parts.length < 3 || parts.some(isNaN)) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
  }

  function channel(c) {
    var v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  function luminance(c) {
    return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
  }

  // Walk ancestors until a non transparent background is found.
  function effectiveBackground(node) {
    var current = node;
    while (current && current.nodeType === 1) {
      var c = parseColor(window.getComputedStyle(current).backgroundColor);
      if (c && c.a > 0) {
        if (c.a === 1) return c;
        // Composite against white, which is what browsers assume by default.
        return { r: c.r * c.a + 255 * (1 - c.a), g: c.g * c.a + 255 * (1 - c.a), b: c.b * c.a + 255 * (1 - c.a), a: 1 };
      }
      current = current.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  function rgb(c) {
    return 'rgb(' + Math.round(c.r) + ', ' + Math.round(c.g) + ', ' + Math.round(c.b) + ')';
  }

  var contrast = null;
  var fg = parseColor(cs.color);
  if (fg) {
    if (fg.a < 1) {
      var bg = effectiveBackground(el);
      fg = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 };
    }
    var bgFinal = effectiveBackground(el);
    var l1 = luminance(fg);
    var l2 = luminance(bgFinal);
    var ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    var requiredAA = isLarge ? 3 : 4.5;
    var requiredAAA = isLarge ? 4.5 : 7;
    contrast = {
      color: rgb(fg),
      background: rgb(bgFinal),
      ratio: Math.round(ratio * 100) / 100,
      requiredAA: requiredAA,
      requiredAAA: requiredAAA,
      fontSize: fontSize,
      fontWeight: fontWeight,
      isLargeText: isLarge,
      passesAA: ratio >= requiredAA,
      passesAAA: ratio >= requiredAAA
    };
  }

  // Build a short, readable selector.
  var selector = el.tagName.toLowerCase();
  if (el.id) selector += '#' + el.id;
  var classes = (el.className && typeof el.className === 'string')
    ? el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 6)
    : [];
  if (classes.length && !el.id) selector += '.' + classes.join('.');

  // Global custom properties defined on :root.
  var cssVariables = {};
  var rootStyle = window.getComputedStyle(document.documentElement);
  for (var i = 0; i < rootStyle.length; i++) {
    var name = rootStyle[i];
    if (name.indexOf('--') === 0) {
      var value = rootStyle.getPropertyValue(name);
      if (value) cssVariables[name] = value.trim();
    }
  }

  var vw = window.innerWidth;
  var vh = window.innerHeight;

  return {
    selector: selector,
    tag: el.tagName.toLowerCase(),
    id: el.id || '',
    classes: classes,
    rect: {
      x: rect.x, y: rect.y,
      width: rect.width, height: rect.height,
      top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left
    },
    box: { margin: side('margin'), border: side('border'), padding: side('padding') },
    distances: {
      top: Math.round(rect.top),
      right: Math.round(vw - rect.right),
      bottom: Math.round(vh - rect.bottom),
      left: Math.round(rect.left)
    },
    display: cs.display,
    position: cs.position,
    fontSize: cs.fontSize,
    lineHeight: cs.lineHeight,
    fontFamily: cs.fontFamily,
    fontWeight: cs.fontWeight,
    color: cs.color,
    background: cs.backgroundColor,
    zIndex: cs.zIndex,
    overflow: cs.overflow,
    cssVariables: cssVariables,
    contrast: contrast
  };
})()
`;

/** Draws the highlight box over the inspected element. */
export const HIGHLIGHT = `
(function () {
  var KEY = '__devbrowserInspector';
  var state = window[KEY];
  if (!state || !state.enabled) return false;

  var el = state.target;
  if (!el || el.nodeType !== 1) return false;
  if (el.hasAttribute && (el.hasAttribute('data-devbrowser-overlay') || el.hasAttribute('data-devbrowser-label'))) return false;

  var r = el.getBoundingClientRect();
  state.overlay.style.left = r.left + 'px';
  state.overlay.style.top = r.top + 'px';
  state.overlay.style.width = r.width + 'px';
  state.overlay.style.height = r.height + 'px';

  var cs = window.getComputedStyle(el);
  var text = el.tagName.toLowerCase() + '  ' + Math.round(r.width) + ' x ' + Math.round(r.height);
  if (cs && parseFloat(cs.fontSize)) text += '  ' + cs.fontSize;

  state.label.textContent = text;
  // Flip the label below the element when it would fall off screen.
  if (r.top > 24) {
    state.label.style.left = r.left + 'px';
    state.label.style.top = (r.top - 22) + 'px';
  } else {
    state.label.style.left = r.left + 'px';
    state.label.style.top = (r.bottom + 6) + 'px';
  }

  return true;
})()
`;