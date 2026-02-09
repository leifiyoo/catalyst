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

import Ballpit from './Ballpit';

const BlurInText = ({ text = "Blur In Effect" }: { text?: string }) => {
    return (
        <h2
            className="text-4xl md:text-6xl text-center text-foreground select-none"
            style={{
                userSelect: "none",
                WebkitUserSelect: "none",
                fontFamily: "Outfit, system-ui, -apple-system, 'Segoe UI', sans-serif",
                fontWeight: 300,
            }}
        >
            {text.split('').map((char, i) => (
                <motion.span
                    key={i}
                    initial={{
                        opacity: 0,
                        filter: "blur(10px)"
                    }}
                    animate={{
                        opacity: 1,
                        filter: "blur(0px)"
                    }}
                    transition={{
                        delay: i * 0.05,
                        duration: 0.8,
                        ease: "easeOut"
                    }}
                    className="inline-block"
                >
                    {char === ' ' ? '\u00A0' : char}
                </motion.span>
            ))}
        </h2>
    );
};

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
                <div style={{ width: '100%', height: '100%', position: 'fixed', top: 0, left: 0, zIndex: 0 }}>
                    <Ballpit />
                </div>
            )}
            {!showDashboard && (
                <motion.div
                    className="relative flex flex-col items-center justify-center h-full gap-8 pt-12"
                    style={{ zIndex: 9999 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                >
                    <motion.div
                        animate={{
                            y: showSpinner ? -15 : 0
                        }}
                        transition={{
                            duration: 0.6,
                            ease: [0.4, 0, 0.2, 1]
                        }}
                    >
                        <BlurInText text="Welcome to catalyst." />
                    </motion.div>
                    <motion.div
                        initial={{
                            opacity: 0,
                            y: 10
                        }}
                        animate={{
                            opacity: showSpinner ? 1 : 0,
                            y: showSpinner ? 0 : 10
                        }}
                        transition={{
                            duration: 0.6,
                            ease: [0.4, 0, 0.2, 1],
                            delay: 0.1
                        }}
                    >
                        {showSpinner && <SpinnerButton />}
                    </motion.div>
                </motion.div>
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
