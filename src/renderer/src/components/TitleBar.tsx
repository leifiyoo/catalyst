import minimizeIcon from "../assets/titlebar/minimieren.svg"
import closeIcon from "../assets/titlebar/close.svg"
import fullscreenIcon from "../assets/titlebar/fullscreen.svg"
import restoreIcon from "../assets/titlebar/kleiner.svg"

export const TitleBar = ({ isMaximized }: { isMaximized: boolean }) => {
    const handleControl = (action: "minimize" | "toggle-maximize" | "close") => {
        window.context?.windowControl?.(action);
    };

    return (
        <div className="titlebar" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
            <div className="titlebar-title">catalyst</div>
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
};
