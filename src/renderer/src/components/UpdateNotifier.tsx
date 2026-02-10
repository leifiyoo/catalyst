import { useEffect, useState } from "react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { ChangelogEntry } from "@shared/types";

export function UpdateNotifier() {
    const [open, setOpen] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<{
        latestVersion: string;
        currentVersion: string;
        releaseUrl: string;
        changelog?: ChangelogEntry[];
    } | null>(null);

    useEffect(() => {
        const check = async () => {
            try {
                // Wait a bit to ensure the app is fully loaded visually
                await new Promise(resolve => setTimeout(resolve, 6000));
                
                const result = await window.context.checkForUpdates();
                if (result.updateAvailable) {
                    setUpdateInfo({
                        latestVersion: result.latestVersion,
                        currentVersion: result.currentVersion,
                        releaseUrl: result.releaseUrl,
                        changelog: result.changelog,
                    });
                    setOpen(true);
                }
            } catch (err) {
                console.error("Failed to check for updates:", err);
            }
        };

        check();
    }, []);

    const handleUpdate = () => {
        if (updateInfo?.releaseUrl) {
            window.context.openExternal(updateInfo.releaseUrl);
        }
        setOpen(false);
    };

    if (!updateInfo) return null;

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent className="bg-popover border-border max-h-[80vh] flex flex-col">
                <AlertDialogHeader>
                    <AlertDialogTitle>Update Available</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="text-muted-foreground">
                            <p>
                                A new version of Catalyst is available.<br/>
                                Current: <span className="text-destructive font-medium">{updateInfo.currentVersion}</span>
                                {" → "}
                                Latest: <span className="text-primary font-medium">{updateInfo.latestVersion}</span>
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {updateInfo.changelog && updateInfo.changelog.length > 0 && (
                    <div className="overflow-y-auto max-h-[40vh] pr-1 -mr-1 space-y-4">
                        {updateInfo.changelog.map((entry) => (
                            <div key={entry.version} className="space-y-1.5">
                                <h4 className="text-sm font-semibold text-foreground">
                                    v{entry.version}
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        {entry.date}
                                        {entry.title ? ` — ${entry.title}` : ""}
                                    </span>
                                </h4>
                                <ul className="space-y-0.5 text-sm text-muted-foreground list-disc list-inside pl-1">
                                    {entry.changes.map((change, i) => (
                                        <li key={i}>{change}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}

                <AlertDialogFooter>
                    <AlertDialogCancel className="border-border bg-transparent text-foreground hover:bg-muted">
                        Later
                    </AlertDialogCancel>
                    <AlertDialogAction onClick={handleUpdate}>
                        Download
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
