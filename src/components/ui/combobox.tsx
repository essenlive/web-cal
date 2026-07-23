"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { Popover, PopoverTrigger, PopoverContent } from "./popover"
import { Input } from "./input"

export interface ComboboxOption {
  value: string
  label: string
}

export interface ComboboxProps {
  options: ComboboxOption[]
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  className?: string
}

/** Single-select searchable combobox — built on the existing Popover primitive, no new dependency. */
export function Combobox({ options, value, onChange, placeholder = "Rechercher…", emptyText = "Aucun résultat.", className }: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const selected = options.find((o) => o.value === value)
  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
            "focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
            !selected && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown size={14} className="shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1.5" align="start">
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="mb-1.5 h-8 text-xs"
        />
        <div className="max-h-56 overflow-y-auto flex flex-col gap-0.5">
          {filtered.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">{emptyText}</p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); setQuery(""); }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-left hover:bg-muted transition-colors",
                o.value === value && "bg-muted"
              )}
            >
              <Check size={12} className={cn("shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{o.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
