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
        releaseName?: string;
        publishedAt?: string;
        releaseNotes?: string;
        changelog?: ChangelogEntry[];
    } | null>(null);

    useEffect(() => {
        if (!window.context?.checkForUpdates) return;

        let cancelled = false;

        const delayTimer = setTimeout(async () => {
            try {
                const result = await window.context.checkForUpdates();
                if (cancelled) return;
                if (result.updateAvailable) {
                    setUpdateInfo({
                        latestVersion: result.latestVersion,
                        currentVersion: result.currentVersion,
                        releaseUrl: result.releaseUrl,
                        releaseName: result.releaseName,
                        publishedAt: result.publishedAt,
                        releaseNotes: result.releaseNotes,
                        changelog: result.changelog,
                    });
                    setOpen(true);
                }
            } catch (err) {
                console.error("Failed to check for updates:", err);
            }
        }, 6000);

        return () => {
            cancelled = true;
            clearTimeout(delayTimer);
        };
    }, []);

    const handleUpdate = () => {
        if (updateInfo?.releaseUrl && window.context?.openExternal) {
            window.context.openExternal(updateInfo.releaseUrl);
        }
        setOpen(false);
    };

    if (!updateInfo) return null;

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogContent className="flex max-h-[80vh] flex-col border-border bg-popover">
                <AlertDialogHeader>
                    <AlertDialogTitle>Update available</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="text-muted-foreground">
                            <p>
                                A new version of Catalyst is available.
                                <br />
                                Current:{" "}
                                <span className="font-medium text-destructive">
                                    {updateInfo.currentVersion}
                                </span>
                                {" -> "}
                                Latest:{" "}
                                <span className="font-medium text-primary">
                                    {updateInfo.latestVersion}
                                </span>
                            </p>
                            {(updateInfo.releaseName || updateInfo.publishedAt) && (
                                <p className="mt-2 text-xs">
                                    {updateInfo.releaseName || `Catalyst ${updateInfo.latestVersion}`}
                                    {updateInfo.publishedAt
                                        ? ` - ${updateInfo.publishedAt.slice(0, 10)}`
                                        : ""}
                                </p>
                            )}
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {updateInfo.releaseNotes ? (
                    <div className="max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 pr-4 text-sm leading-relaxed text-muted-foreground">
                        {updateInfo.releaseNotes}
                    </div>
                ) : updateInfo.changelog && updateInfo.changelog.length > 0 ? (
                    <div className="-mr-1 max-h-[40vh] space-y-4 overflow-y-auto pr-1">
                        {updateInfo.changelog.map((entry) => (
                            <div key={entry.version} className="space-y-1.5">
                                <h4 className="text-sm font-semibold text-foreground">
                                    v{entry.version}
                                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                                        {entry.date}
                                        {entry.title ? ` - ${entry.title}` : ""}
                                    </span>
                                </h4>
                                <ul className="list-inside list-disc space-y-0.5 pl-1 text-sm text-muted-foreground">
                                    {entry.changes.map((change, i) => (
                                        <li key={i}>{change}</li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                ) : null}

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
