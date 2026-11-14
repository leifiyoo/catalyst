import { Component, type ReactNode, useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { createHashRouter, RouterProvider } from "react-router-dom";
import { SpinnerButton } from "@/components/SpinnerButton";
import { TitleBar } from "@/components/TitleBar";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ErrorPage } from "@/components/ErrorPage";
import catalystLogo from "@/assets/catalystwithlogotransparent.png";

const loadDashboardPage = () => import("@/pages/DashboardPage");
const loadServersPage = () => import("@/pages/ServersPage");
const loadServerDetailPage = () => import("@/pages/ServerDetailPage");
const loadSettingsPage = () => import("@/pages/SettingsPage");
const loadAnalyticsPage = () => import("@/pages/AnalyticsPage");

const DashboardPage = lazy(() => loadDashboardPage().then(m => ({ default: m.DashboardPage })));
const ServersPage = lazy(() => loadServersPage().then(m => ({ default: m.ServersPage })));
const ServerDetailPage = lazy(() => loadServerDetailPage().then(m => ({ default: m.ServerDetailPage })));
const SettingsPage = lazy(() => loadSettingsPage().then(m => ({ default: m.SettingsPage })));
const AnalyticsPage = lazy(() => loadAnalyticsPage().then(m => ({ default: m.AnalyticsPage })));
const UpdateNotifier = lazy(() => import("@/components/UpdateNotifier").then(m => ({ default: m.UpdateNotifier })));

class DashboardErrorBoundary extends Component<
    { children: ReactNode },
    { error: Error | null }
> {
    state: { error: Error | null } = { error: null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error) {
        console.error("Dashboard render failed", error);
    }

    render() {
        if (this.state.error) {
            return (
                <div className="flex min-h-screen w-full items-center justify-center bg-background p-6 text-foreground">
                    <div className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                            Renderer error
                        </p>
                        <h1 className="mt-3 text-2xl font-semibold">Dashboard failed to render</h1>
                        <pre className="mt-4 max-h-72 overflow-auto rounded-md bg-muted p-4 text-xs text-muted-foreground">
                            {this.state.error.stack || this.state.error.message}
                        </pre>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

const SplashScreen = ({ showSpinner }: { showSpinner: boolean }) => {
    return (
        <div
            className="relative z-[2] flex h-full flex-col items-center justify-center gap-6 px-6 text-center"
        >
            <div className="flex flex-col items-center gap-4">
                <img
                    src={catalystLogo}
                    alt="Catalyst"
                    className="h-20 object-contain"
                />
                <p className="max-w-md text-sm text-muted-foreground">
                    Preparing your workspace and syncing server state.
                </p>
            </div>
            {showSpinner && <SpinnerButton />}
        </div>
    )
}

const RouteSkeleton = () => (
    <section className="mx-auto flex w-full max-w-[1200px] flex-col gap-5 px-8 py-8">
        <div className="h-8 w-48 rounded-lg bg-muted/70" />
        <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-32 rounded-lg border border-border bg-card" />
            ))}
        </div>
        <div className="h-[420px] rounded-lg border border-border bg-card" />
    </section>
)

const router = createHashRouter([
    {
        path: "/",
        element: <DashboardLayout />,
        errorElement: <ErrorPage />,
        children: [
            { index: true, element: <Suspense fallback={<RouteSkeleton />}><DashboardPage /></Suspense>, errorElement: <ErrorPage /> },
            { path: "servers", element: <Suspense fallback={<RouteSkeleton />}><ServersPage /></Suspense>, errorElement: <ErrorPage /> },
            { path: "servers/:id", element: <Suspense fallback={<RouteSkeleton />}><ServerDetailPage /></Suspense>, errorElement: <ErrorPage /> },
            { path: "analytics", element: <Suspense fallback={<RouteSkeleton />}><AnalyticsPage /></Suspense>, errorElement: <ErrorPage /> },
            { path: "settings", element: <Suspense fallback={<RouteSkeleton />}><SettingsPage /></Suspense>, errorElement: <ErrorPage /> },
        ],
    },
]);

// Minimum splash display time (ms) to avoid jarring flash
const MIN_SPLASH_MS = 650;

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
        }, 300);

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

        // Fallback timeout in case IPC fails
        const fallbackTimer = setTimeout(onReady, 2500);

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
                <div
                    className="relative z-[9999] h-full w-full"
                >
                    <DashboardErrorBoundary>
                        <RouterProvider router={router} />
                        <Suspense fallback={null}>
                            <UpdateNotifier />
                        </Suspense>
                    </DashboardErrorBoundary>
                </div>
            )}
        </div>
    );
};

export default App;
