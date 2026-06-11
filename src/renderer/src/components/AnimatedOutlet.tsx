import { useLocation, useOutlet } from "react-router-dom"
import { AnimatePresence, motion } from "motion/react"

export function AnimatedOutlet() {
    const outlet = useOutlet()
    const location = useLocation()

    return (
        <div className="flex min-h-full flex-col overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                    key={location.pathname}
                    className="flex min-h-full flex-col"
                    initial={{ opacity: 0, y: 18, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.992 }}
                    transition={{
                        opacity: { duration: 0.22, ease: "easeOut" },
                        y: { type: "spring", stiffness: 260, damping: 30, mass: 0.72 },
                        scale: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
                    }}
                >
                    {outlet}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}
