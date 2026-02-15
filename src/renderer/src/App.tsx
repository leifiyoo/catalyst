import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion } from "motion/react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { SpinnerButton } from "@/components/SpinnerButton";
import { TitleBar } from "@/components/TitleBar";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ErrorPage } from "@/components/ErrorPage";
import { UpdateNotifier } from "@/components/UpdateNotifier";
import { Spinner } from "@/components/ui/spinner";
import catalystLogo from "@/assets/catalystwithlogotransparent.png";

// Lazy-load page components for better initial load performance
const DashboardPage = lazy(() => import("@/pages/DashboardPage").then(m => ({ default: m.DashboardPage })));
const ServersPage = lazy(() => import("@/pages/ServersPage").then(m => ({ default: m.ServersPage })));
const ServerDetailPage = lazy(() => import("@/pages/ServerDetailPage").then(m => ({ default: m.ServerDetailPage })));
const SettingsPage = lazy(() => import("@/pages/SettingsPage").then(m => ({ default: m.SettingsPage })));

const PageFallback = () => (
    <div className="flex items-center justify-center h-full min-h-[200px]">
        <Spinner className="h-8 w-8 text-primary" />
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

const SPLASH_MIN_DURATION_MS = 1500;
const SPLASH_FALLBACK_TIMEOUT_MS = 8000;

const App = () => {
    const [showSpinner, setShowSpinner] = useState(false);
    const [showTitleBar, setShowTitleBar] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);

    const transitionToDashboard = useCallback(() => {
        setShowDashboard(true);
        setShowTitleBar(true);
        window.context?.setAlwaysOnTop?.(false);
        // Resize after a short delay to allow the dashboard to render
        setTimeout(() => {
            window.context?.resizeWindow?.();
        }, 200);
    }, []);

    useEffect(() => {
        window.context?.setAlwaysOnTop?.(true);
        const mountTime = Date.now();
        let transitioned = false;

        // Show spinner after a short delay so fast loads feel instant
        const showSpinnerTimer = setTimeout(() => {
            setShowSpinner(true);
        }, 1200);

        const doTransition = () => {
            if (transitioned) return;
            transitioned = true;
            // Ensure minimum splash duration for smooth UX
            const elapsed = Date.now() - mountTime;
            const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - elapsed);
            setTimeout(transitionToDashboard, remaining);
        };

        // Listen for the main process "app-ready" event
        const unsubscribeReady = window.context?.onAppReady?.(doTransition);

        // Fallback timeout in case the event never fires
        const fallbackTimer = setTimeout(doTransition, SPLASH_FALLBACK_TIMEOUT_MS);

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
            unsubscribeReady?.();
            unsubscribeWindowState?.();
        };
    }, [transitionToDashboard]);

    return (
        <div className="relative w-full h-full min-h-screen bg-background text-foreground" style={{ borderRadius: '12px', overflow: 'auto' }}>
            {showTitleBar && !showDashboard && <TitleBar isMaximized={isMaximized} />}
            {!showDashboard && (
                <SplashScreen showSpinner={showSpinner} />
            )}

            {showDashboard && (
                <motion.div
                    className="relative z-[9999] h-full w-full"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <RouterProvider router={router} />
                    <UpdateNotifier />
                </motion.div>
            )}
        </div>
    );
};

export default App;
