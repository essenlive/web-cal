"use client";

/** Palette swatches + a native color input for arbitrary hex values. `softColors`: optional
 *  second row (e.g. the theme editor's calmer accents), same radiogroup. */
export function ColorPicker({ value, onChange, colors, softColors, label = "Couleur" }: {
  value: string;
  onChange: (c: string) => void;
  colors: string[];
  softColors?: string[];
  label?: string;
}) {
  const swatch = (c: string) => (
    <button
      key={c}
      type="button"
      role="radio"
      aria-checked={value === c}
      aria-pressed={value === c}
      onClick={() => onChange(c)}
      className="size-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-hidden focus:ring-2 focus:ring-primary/50"
      style={{ backgroundColor: c, borderColor: value === c ? "var(--foreground)" : "transparent" }}
    />
  );
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label={label}>
        {colors.map(swatch)}
        {softColors && <div className="basis-full h-0" aria-hidden />}
        {softColors?.map(swatch)}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Couleur personnalisée"
          className="size-6 rounded cursor-pointer border border-border"
        />
      </div>
    </div>
  );
}
