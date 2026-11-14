import type { ComponentProps } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import type { IconSvgElement } from "@hugeicons/react"
import {
  Analytics01Icon,
  Cancel01Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckIcon,
  Copy02Icon,
  DashboardSquare02Icon,
  MinusSignIcon,
  Search01Icon,
  ServerStack02Icon,
  Settings02Icon,
  SquareIcon,
} from "@hugeicons/core-free-icons"

type CatalystIconProps = Omit<ComponentProps<"svg">, "ref"> & {
  size?: number | string
  strokeWidth?: number
}

function withHugeIcon(icon: IconSvgElement) {
  return function CatalystIcon({
    className,
    size,
    strokeWidth = 1.7,
    ...props
  }: CatalystIconProps) {
    return (
      <HugeiconsIcon
        aria-hidden="true"
        icon={icon}
        className={className}
        size={size ?? "1em"}
        strokeWidth={strokeWidth}
        {...props}
      />
    )
  }
}

export const Activity = withHugeIcon(Analytics01Icon)
export const Check = withHugeIcon(CheckIcon)
export const ChevronDown = withHugeIcon(ChevronDownIcon)
export const ChevronUp = withHugeIcon(ChevronUpIcon)
export const Copy = withHugeIcon(Copy02Icon)
export const LayoutGrid = withHugeIcon(DashboardSquare02Icon)
export const Minus = withHugeIcon(MinusSignIcon)
export const Search = withHugeIcon(Search01Icon)
export const Server = withHugeIcon(ServerStack02Icon)
export const Settings = withHugeIcon(Settings02Icon)
export const Square = withHugeIcon(SquareIcon)
export const X = withHugeIcon(Cancel01Icon)
