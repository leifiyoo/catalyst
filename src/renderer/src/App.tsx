import { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { motion } from "motion/react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { SpinnerButton } from "@/components/SpinnerButton";
import { TitleBar } from "@/components/TitleBar";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ErrorPage } from "@/components/ErrorPage";
import catalystLogo from "@/assets/catalystwithlogotransparent.png";

// Lazy-load heavy page components for better initial load performance
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const ServersPage = lazy(() => import("@/pages/ServersPage").then(m => ({ default: m.ServersPage })));
const ServerDetailPage = lazy(() => import("@/pages/ServerDetailPage").then(m => ({ default: m.ServerDetailPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));
const UpdateNotifier = lazy(() => import("@/components/UpdateNotifier").then(m => ({ default: m.UpdateNotifier })));

const PageFallback = () => (
    <div className="flex items-center justify-center h-full min-h-[200px]">
        <SpinnerButton />
    </div>
);

const SplashScreen = ({ showSpinner }: { showSpinner: boolean }) => {
    return (
        <motion.div
            className="relative z-[2] flex h-full flex-col items-center justify-center gap-6 px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
        >
            <div className="flex flex-col items-center gap-4">
                <motion.img
                    src={catalystLogo}
                    alt="Catalyst"
                    className="h-20 object-contain"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                />
                <p className="max-w-md text-sm text-muted-foreground">
                    Preparing your workspace and syncing server state.
                </p>
            </div>
            {showSpinner && <SpinnerButton />}
        </motion.div>
    )
}

const router = createHashRouter([
    {
        path: "/",
        element: <DashboardLayout />,
        errorElement: <ErrorPage />,
        children: [
            { index: true, element: <Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>, errorElement: <ErrorPage /> },
            { path: "servers", element: <Suspense fallback={<PageFallback />}><ServersPage /></Suspense>, errorElement: <ErrorPage /> },
            { path: "servers/:id", element: <Suspense fallback={<PageFallback />}><ServerDetailPage /></Suspense>, errorElement: <ErrorPage /> },
            { path: "settings", element: <Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>, errorElement: <ErrorPage /> },
        ],
    },
]);

// Minimum splash display time (ms) to avoid jarring flash
const MIN_SPLASH_MS = 1500;

const App = () => {
    const [showSpinner, setShowSpinner] = useState(false);
    const [showTitleBar, setShowTitleBar] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);

    const transitionToDashboard = useCallback(() => {
        setShowDashboard(true);
        setShowTitleBar(true);
        window.context?.setAlwaysOnTop?.(false);
        // Resize after a short delay to let the dashboard render
        setTimeout(() => {
            window.context?.resizeWindow?.();
        }, 200);
    }, []);

    useEffect(() => {
        window.context?.setAlwaysOnTop?.(true);

        // Show spinner after a brief delay (indicates loading)
        const showSpinnerTimer = setTimeout(() => {
            setShowSpinner(true);
        }, 800);

        const startTime = Date.now();

        // Event-based readiness: signal the main process and wait for confirmation
        // Also use a maximum timeout as fallback to prevent infinite splash
        let resolved = false;

        const onReady = () => {
            if (resolved) return;
            resolved = true;

            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);

            // Ensure minimum splash display time for smooth UX
            setTimeout(transitionToDashboard, remaining);
        };

        // Try IPC-based readiness signal
        window.context?.appReady?.()
            .then(() => onReady())
            .catch(() => onReady());

        // Fallback timeout in case IPC fails (max 6 seconds)
        const fallbackTimer = setTimeout(onReady, 6000);

        const unsubscribe = window.context?.onResizeStep?.(() => {
            window.dispatchEvent(new Event("resize"));
        });

        let unsubscribeWindowState: (() => void) | undefined;
        window.context?.getWindowState?.().then(state => {
            setIsMaximized(state.isMaximized);
        });
        unsubscribeWindowState = window.context?.onWindowStateChanged?.(state => {
            setIsMaximized(state.isMaximized);
        });

        return () => {
            clearTimeout(showSpinnerTimer);
            clearTimeout(fallbackTimer);
            unsubscribe?.();
            unsubscribeWindowState?.();
        };
    }, [transitionToDashboard]);

    return (
        <div className="relative w-full h-full min-h-screen bg-background text-foreground" style={{ borderRadius: '12px', overflow: 'auto' }}>
            {showTitleBar && !showDashboard && <TitleBar isMaximized={isMaximized} />}
            {!showDashboard && (
                <>
                    <SplashScreen showSpinner={showSpinner} />
                </>
            )}

            {showDashboard && (
                <motion.div
                    className="relative z-[9999] h-full w-full"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <RouterProvider router={router} />
                    <Suspense fallback={null}>
                        <UpdateNotifier />
                    </Suspense>
                </motion.div>
            )}
        </div>
    );
};

export default App;
