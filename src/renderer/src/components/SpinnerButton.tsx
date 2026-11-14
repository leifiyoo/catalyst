import { Spinner } from "@/components/ui/spinner"

export function SpinnerButton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Spinner className="h-5 w-5 text-muted-foreground" />
    </div>
  )
}
