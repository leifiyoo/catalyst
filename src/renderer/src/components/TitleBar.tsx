import { memo } from "react"
import minimizeIcon from "../assets/titlebar/minimieren.svg"
import closeIcon from "../assets/titlebar/close.svg"
import fullscreenIcon from "../assets/titlebar/fullscreen.svg"
import restoreIcon from "../assets/titlebar/kleiner.svg"
import titlebarLogo from "../assets/transparentlogo.png"

export const TitleBar = memo(({ isMaximized }: { isMaximized: boolean }) => {
    const handleControl = (action: "minimize" | "toggle-maximize" | "close") => {
        window.context?.windowControl?.(action);
    };

    return (
        <div className="titlebar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <div className="titlebar-title" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div
                    style={{
                        height: '14px',
                        width: '14px',
                        WebkitMaskImage: `url(${titlebarLogo})`,
                        maskImage: `url(${titlebarLogo})`,
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain',
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        backgroundColor: 'hsl(var(--primary))',
                    }}
                />
                catalyst
            </div>
            <div className="titlebar-controls" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <button
                    className="titlebar-button"
                    onClick={() => handleControl("minimize")}
                    aria-label="Minimize"
                    type="button"
                >
                    <img className="titlebar-icon" src={minimizeIcon} alt="" />
                </button>
                <button
                    className="titlebar-button"
                    onClick={() => handleControl("toggle-maximize")}
                    aria-label={isMaximized ? "Restore" : "Maximize"}
                    type="button"
                >
                    <img
                        className="titlebar-icon"
                        src={isMaximized ? restoreIcon : fullscreenIcon}
                        alt=""
                    />
                </button>
                <button
                    className="titlebar-button titlebar-button-close"
                    onClick={() => handleControl("close")}
                    aria-label="Close"
                    type="button"
                >
                    <img className="titlebar-icon" src={closeIcon} alt="" />
                </button>
            </div>
        </div>
    );
})
