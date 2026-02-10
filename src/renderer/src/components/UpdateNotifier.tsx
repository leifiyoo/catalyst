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

export function UpdateNotifier() {
    const [open, setOpen] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<{
        latestVersion: string;
        currentVersion: string;
        releaseUrl: string;
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
                        releaseUrl: result.releaseUrl
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
            <AlertDialogContent className="bg-popover border-border">
                <AlertDialogHeader>
                    <AlertDialogTitle>Update Available</AlertDialogTitle>
                    <AlertDialogDescription className="text-muted-foreground">
                        A new version of Catalyst is available.<br/>
                        Current: <span className="text-destructive">{updateInfo.currentVersion}</span> <br/> 
                        Latest: <span className="text-primary">{updateInfo.latestVersion}</span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="border-border bg-transparent text-foreground hover:bg-muted">
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleUpdate}
                    >
                        View Release
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
