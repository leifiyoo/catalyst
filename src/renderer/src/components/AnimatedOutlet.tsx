import { useLocation, useOutlet } from "react-router-dom"
import { AnimatePresence, motion } from "motion/react"

export function AnimatedOutlet() {
    const outlet = useOutlet()
    const location = useLocation()

    return (
        <div className="flex min-h-full flex-col overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={location.pathname}
                    className="flex min-h-full flex-col"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                >
                    {outlet}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}
