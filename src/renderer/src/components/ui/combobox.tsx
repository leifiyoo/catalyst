import * as React from "react"

import { cn } from "@/utils"

type ComboboxContextValue = {
  items: string[]
  filteredItems: string[]
  value: string
  isOpen: boolean
  setValue: (value: string) => void
  setQuery: (value: string) => void
  setOpen: (open: boolean) => void
}

const ComboboxContext = React.createContext<ComboboxContextValue | null>(null)

function useComboboxContext() {
  const context = React.useContext(ComboboxContext)
  if (!context) {
    throw new Error("Combobox components must be used within <Combobox>")
  }
  return context
}

function Combobox({
  items,
  children,
  className
}: React.HTMLAttributes<HTMLDivElement> & { items: string[] }) {
  const [value, setValue] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [isOpen, setOpen] = React.useState(false)

  const filteredItems = React.useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter(item => item.toLowerCase().includes(normalized))
  }, [items, query])

  const contextValue = React.useMemo(
    () => ({
      items,
      filteredItems,
      value,
      isOpen,
      setValue,
      setQuery,
      setOpen
    }),
    [items, filteredItems, value, isOpen]
  )

  return (
    <ComboboxContext.Provider value={contextValue}>
      <div className={cn("relative w-full", className)}>{children}</div>
    </ComboboxContext.Provider>
  )
}

function ComboboxInput({ className, ...props }: React.ComponentProps<"input">) {
  const { value, setValue, setQuery, setOpen } = useComboboxContext()
  return (
    <input
      {...props}
      value={value}
      onChange={event => {
        setValue(event.target.value)
        setQuery(event.target.value)
        props.onChange?.(event)
      }}
      onFocus={event => {
        setOpen(true)
        props.onFocus?.(event)
      }}
      onBlur={event => {
        setTimeout(() => setOpen(false), 120)
        props.onBlur?.(event)
      }}
      onKeyDown={event => {
        if (event.key === "Escape") setOpen(false)
        props.onKeyDown?.(event)
      }}
      className={cn(
        "flex h-10 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40",
        className
      )}
    />
  )
}

function ComboboxContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { isOpen } = useComboboxContext()
  if (!isOpen) return null
  return (
    <div
      className={cn(
        "absolute left-0 right-0 top-[calc(100%+8px)] z-[99999] rounded-xl border border-white/10 bg-popover p-2 shadow-[0_16px_30px_rgba(0,0,0,0.4)]",
        className
      )}
      {...props}
    />
  )
}

function ComboboxList({
  children
}: {
  children: (item: string) => React.ReactNode
}) {
  const { filteredItems } = useComboboxContext()
  return <div className="flex max-h-48 flex-col gap-1 overflow-auto">{filteredItems.map(children)}</div>
}

function ComboboxItem({
  value,
  className,
  children
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { setValue, setQuery, setOpen } = useComboboxContext()
  return (
    <button
      type="button"
      onMouseDown={event => event.preventDefault()}
      onClick={() => {
        setValue(value)
        setQuery(value)
        setOpen(false)
      }}
      className={cn(
        "w-full rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-white/5",
        className
      )}
    >
      {children ?? value}
    </button>
  )
}

function ComboboxEmpty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-2 text-sm text-muted-foreground">{children}</div>
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
}
