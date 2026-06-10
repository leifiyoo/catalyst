import { useOutlet } from "react-router-dom"

export function AnimatedOutlet() {
    const outlet = useOutlet()

    return (
        <div className="flex min-h-full flex-col">
            {outlet}
        </div>
    )
}
