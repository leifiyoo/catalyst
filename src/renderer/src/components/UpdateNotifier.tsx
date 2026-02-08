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
            <AlertDialogContent className="bg-[#121218] border-white/10">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">Update Available</AlertDialogTitle>
                    <AlertDialogDescription className="text-white/70">
                        A new version of Catalyst is available.<br/>
                        Current: <span className="text-red-400">{updateInfo.currentVersion}</span> <br/> 
                        Latest: <span className="text-green-400">{updateInfo.latestVersion}</span>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                        Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handleUpdate}
                        className="bg-cyan-500 text-black hover:bg-cyan-400"
                    >
                        View Release
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
