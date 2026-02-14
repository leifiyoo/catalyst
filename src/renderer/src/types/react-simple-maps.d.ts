declare module "react-simple-maps" {
    import { ComponentType, CSSProperties, ReactNode } from "react"

    interface ProjectionConfig {
        scale?: number
        center?: [number, number]
        rotate?: [number, number, number]
    }

    interface ComposableMapProps {
        projection?: string
        projectionConfig?: ProjectionConfig
        width?: number
        height?: number
        style?: CSSProperties
        className?: string
        children?: ReactNode
    }

    interface ZoomableGroupProps {
        center?: [number, number]
        zoom?: number
        minZoom?: number
        maxZoom?: number
        children?: ReactNode
    }

    interface GeographiesChildrenArgs {
        geographies: GeographyType[]
    }

    interface GeographiesProps {
        geography: string | object
        children: (args: GeographiesChildrenArgs) => ReactNode
    }

    interface GeographyType {
        rsmKey: string
        id: string
        properties: {
            name: string
            [key: string]: unknown
        }
        [key: string]: unknown
    }

    interface GeographyStyleProps {
        fill?: string
        stroke?: string
        strokeWidth?: number
        outline?: string
        cursor?: string
    }

    interface GeographyProps {
        geography: GeographyType
        key?: string
        onMouseEnter?: (event?: unknown) => void
        onMouseLeave?: (event?: unknown) => void
        onClick?: (event?: unknown) => void
        style?: {
            default?: GeographyStyleProps
            hover?: GeographyStyleProps
            pressed?: GeographyStyleProps
        }
        className?: string
    }

    export const ComposableMap: ComponentType<ComposableMapProps>
    export const ZoomableGroup: ComponentType<ZoomableGroupProps>
    export const Geographies: ComponentType<GeographiesProps>
    export const Geography: ComponentType<GeographyProps>
}
