import { useEffect } from "react"
import { motion, useSpring, useTransform } from "motion/react"

interface AnimatedNumberProps {
    value: number
    format?: (value: number) => string
    className?: string
}

/**
 * Spring-driven count-up number. Renders straight from the motion value,
 * so there are no per-frame React re-renders.
 */
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
    const spring = useSpring(0, { stiffness: 100, damping: 22 })

    useEffect(() => {
        spring.set(value)
    }, [spring, value])

    const display = useTransform(spring, (v) =>
        format ? format(v) : Math.round(v).toLocaleString()
    )

    return <motion.span className={className}>{display}</motion.span>
}
