"use client";

/** Palette swatches + a native color input for arbitrary hex values. */
export function ColorPicker({ value, onChange, colors, label = "Couleur" }: {
  value: string;
  onChange: (c: string) => void;
  colors: string[];
  label?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className="size-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{ backgroundColor: c, borderColor: value === c ? "var(--foreground)" : "transparent" }}
          />
        ))}
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-6 rounded cursor-pointer border border-border"
        />
      </div>
    </div>
  );
}
