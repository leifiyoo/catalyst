import { useState, useEffect } from 'react';
import { motion } from "framer-motion";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { SpinnerButton } from "@/components/SpinnerButton";
import { TitleBar } from "@/components/TitleBar";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { DashboardPage } from "@/pages/DashboardPage";
import { ServersPage } from "@/pages/ServersPage";
import { ServerDetailPage } from "@/pages/ServerDetailPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { UpdateNotifier } from "@/components/UpdateNotifier";
import { ErrorPage } from "@/components/ErrorPage";

const SplashScreen = ({ showSpinner }: { showSpinner: boolean }) => {
    return (
        <motion.div
            className="relative z-[2] flex h-full flex-col items-center justify-center gap-6 px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
        >
            <div className="flex flex-col items-center gap-2">
                <p className="text-[11px] uppercase tracking-[0.4em] text-muted-foreground">
                    Catalyst
                </p>
                <h1 className="text-3xl font-semibold md:text-4xl">Server studio</h1>
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
            { index: true, element: <DashboardPage />, errorElement: <ErrorPage /> },
            { path: "servers", element: <ServersPage />, errorElement: <ErrorPage /> },
            { path: "servers/:id", element: <ServerDetailPage />, errorElement: <ErrorPage /> },
            { path: "settings", element: <SettingsPage />, errorElement: <ErrorPage /> },
        ],
    },
]);

const App = () => {
    const [showSpinner, setShowSpinner] = useState(false);
    const [showTitleBar, setShowTitleBar] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [showDashboard, setShowDashboard] = useState(false);

    useEffect(() => {
        window.context?.setAlwaysOnTop?.(true);
        const showSpinnerTimer = setTimeout(() => {
            setShowSpinner(true);
        }, 3000);

        const showDashboardTimer = setTimeout(() => {
            setShowDashboard(true);
            setShowTitleBar(true);
            window.context?.setAlwaysOnTop?.(false);
        }, 4800);

        const resizeTimer = setTimeout(() => {
            if (window.context?.resizeWindow) {
                window.context.resizeWindow();
            }
        }, 5000);

        const unsubscribe = window.context?.onResizeStep?.(() => {
            window.dispatchEvent(new Event("ballpit-resize-now"));
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
            clearTimeout(showDashboardTimer);
            clearTimeout(resizeTimer);
            unsubscribe?.();
            unsubscribeWindowState?.();
        };
    }, []);

    return (
        <div className="relative w-full h-screen bg-background text-foreground" style={{ borderRadius: '12px', overflow: 'hidden' }}>
            {showTitleBar && !showDashboard && <TitleBar isMaximized={isMaximized} />}
            {!showDashboard && (
                <>
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_bottom,rgba(0,0,0,0.35),transparent_50%)]" />
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
                    <UpdateNotifier />
                </motion.div>
            )}
        </div>
    );
};

export default App;
