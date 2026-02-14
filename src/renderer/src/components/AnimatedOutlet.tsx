import { useRef } from "react"
import { useOutlet, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "motion/react"

export function AnimatedOutlet() {
    const location = useLocation()
    const outlet = useOutlet()

    // Only keep the current and previous outlet (for exit animation),
    // then discard old ones to prevent memory leaks.
    const outletRef = useRef<{ key: string; node: React.ReactNode }[]>([])

    // Update the ref: keep only the previous entry (if different) and the current one
    const existing = outletRef.current
    const prev = existing.find((e) => e.key !== location.pathname)
    const current = { key: location.pathname, node: outlet }

    outletRef.current = prev ? [prev, current] : [current]

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
            >
                {outletRef.current.find((e) => e.key === location.pathname)?.node}
            </motion.div>
        </AnimatePresence>
    )
}
