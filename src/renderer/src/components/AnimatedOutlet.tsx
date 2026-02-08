import { useRef } from "react"
import { useOutlet, useLocation } from "react-router-dom"
import { AnimatePresence, motion } from "motion/react"

export function AnimatedOutlet() {
    const location = useLocation()
    const outlet = useOutlet()

    // Keep a ref of the current outlet keyed by pathname so AnimatePresence
    // can render the exiting element while the new one enters.
    const outletRef = useRef<Record<string, React.ReactNode>>({})
    outletRef.current[location.pathname] = outlet

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
            >
                {outletRef.current[location.pathname]}
            </motion.div>
        </AnimatePresence>
    )
}
