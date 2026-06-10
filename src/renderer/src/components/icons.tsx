import type { ComponentProps } from "react"
import {
  IconAspectRatioSquare2Outline18,
  IconChartBarTrendUpOutline18,
  IconCheckOutline18,
  IconChevronDownOutline18,
  IconChevronUpOutline18,
  IconComputerOutline18,
  IconFiles2Outline18,
  IconGear2Outline18,
  IconGridCirclePlusOutline18,
  IconMagnifierOutline18,
  IconMinusOutline18,
  IconXmarkOutline18,
} from "nucleo-ui-essential-outline-18"

type NucleoIcon = typeof IconCheckOutline18
type NucleoIconProps = ComponentProps<NucleoIcon>

function withOnePxStroke(Icon: NucleoIcon) {
  return function CatalystIcon(props: NucleoIconProps) {
    return <Icon aria-hidden="true" strokeWidth={1} {...props} />
  }
}

export const Activity = withOnePxStroke(IconChartBarTrendUpOutline18)
export const Check = withOnePxStroke(IconCheckOutline18)
export const ChevronDown = withOnePxStroke(IconChevronDownOutline18)
export const ChevronUp = withOnePxStroke(IconChevronUpOutline18)
export const Copy = withOnePxStroke(IconFiles2Outline18)
export const LayoutGrid = withOnePxStroke(IconGridCirclePlusOutline18)
export const Minus = withOnePxStroke(IconMinusOutline18)
export const Search = withOnePxStroke(IconMagnifierOutline18)
export const Server = withOnePxStroke(IconComputerOutline18)
export const Settings = withOnePxStroke(IconGear2Outline18)
export const Square = withOnePxStroke(IconAspectRatioSquare2Outline18)
export const X = withOnePxStroke(IconXmarkOutline18)
