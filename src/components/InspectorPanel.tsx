import type { Inspection } from "../lib/inspector";

interface InspectorPanelProps {
  inspection: Inspection | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className="text-[11px] uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="truncate font-mono text-xs text-neutral-200">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-800 px-3 py-2.5 last:border-b-0">
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ContrastBadge({ inspection }: { inspection: Inspection }) {
  const { contrast } = inspection;
  if (!contrast) return null;

  const tone = contrast.passesAAA
    ? "bg-emerald-500/15 text-emerald-300"
    : contrast.passesAA
      ? "bg-amber-500/15 text-amber-300"
      : "bg-red-500/15 text-red-300";

  const label = contrast.passesAAA
    ? "AAA"
    : contrast.passesAA
      ? "AA"
      : "Falla";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
          style={{
            background: contrast.background,
            color: contrast.color,
          }}
        >
          {contrast.ratio}:1 {label}
        </span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone}`}>
          {contrast.ratio.toFixed(2)} / AA {contrast.requiredAA}
        </span>
      </div>
      <Row label="Texto" value={contrast.color} />
      <Row label="Fondo" value={contrast.background} />
      <Row
        label="Tamaño"
        value={`${contrast.fontSize}px / ${contrast.fontWeight}`}
      />
      {!contrast.passesAA && (
        <p className="text-[11px] leading-snug text-red-300">
          Contraste insuficiente. WCAG AA requiere {contrast.requiredAA}:1 para{" "}
          {contrast.isLargeText ? "texto grande" : "texto normal"}.
        </p>
      )}
    </div>
  );
}

export function InspectorPanel({ inspection, onClose }: InspectorPanelProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-neutral-800 bg-neutral-900">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Inspector
        </h2>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
          title="Cerrar inspector"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!inspection ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="text-xs leading-relaxed text-neutral-600">
            Pasa el cursor sobre un elemento de la página para medirlo.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <Section title="Elemento">
            <p className="mb-1 truncate font-mono text-sm text-blue-300">
              {inspection.selector}
            </p>
            <Row label="Rect" value={`${Math.round(inspection.rect.width)} × ${Math.round(inspection.rect.height)}`} />
            <Row label="Display" value={inspection.display} />
            <Row label="Position" value={inspection.position} />
            <Row label="Z-index" value={inspection.zIndex} />
            {inspection.classes.length > 0 && (
              <Row label="Clases" value={inspection.classes.join(" ")} />
            )}
          </Section>

          <Section title="Distancias al viewport">
            <div className="grid grid-cols-4 gap-1 text-center">
              {(
                [
                  ["top", inspection.distances.top],
                  ["right", inspection.distances.right],
                  ["bottom", inspection.distances.bottom],
                  ["left", inspection.distances.left],
                ] as const
              ).map(([side, value]) => (
                <div key={side} className="rounded bg-neutral-800 px-1 py-1">
                  <p className="text-[10px] uppercase text-neutral-500">{side}</p>
                  <p className="font-mono text-xs text-neutral-200">{value}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Modelo de caja">
            <Row label="Margin" value={`${inspection.box.margin.top} ${inspection.box.margin.right} ${inspection.box.margin.bottom} ${inspection.box.margin.left}`} />
            <Row label="Border" value={`${inspection.box.border.top} ${inspection.box.border.right} ${inspection.box.border.bottom} ${inspection.box.border.left}`} />
            <Row label="Padding" value={`${inspection.box.padding.top} ${inspection.box.padding.right} ${inspection.box.padding.bottom} ${inspection.box.padding.left}`} />
          </Section>

          <Section title="Tipografía">
            <Row label="Font size" value={inspection.fontSize} />
            <Row label="Line height" value={inspection.lineHeight} />
            <Row label="Weight" value={inspection.fontWeight} />
            <Row label="Family" value={inspection.fontFamily} />
            <Row label="Overflow" value={inspection.overflow} />
          </Section>

          <Section title="Contraste (WCAG)">
            <ContrastBadge inspection={inspection} />
          </Section>

          <Section title="Variables CSS">
            {Object.keys(inspection.cssVariables).length === 0 ? (
              <p className="text-[11px] text-neutral-600">
                Sin variables CSS definidas en :root
              </p>
            ) : (
              <div className="space-y-1">
                {Object.entries(inspection.cssVariables).map(([name, value]) => (
                  <div key={name} className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-mono text-[11px] text-blue-300">
                      {name}
                    </span>
                    <span className="truncate font-mono text-[11px] text-neutral-400">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </aside>
  );
}