import "@testing-library/jest-dom";
import "./utils/window.mock";
import { cleanup } from "@testing-library/react";
import { render, screen } from "./utils";
import { describe, beforeEach, afterEach, expect, test, vi } from "vitest";
import { act } from "react";
import App from "@/App";

describe("Catalyst app shell", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    await act(async () => {
      render(<App />);
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("renders the Catalyst splash screen", () => {
    expect(screen.getByAltText("Catalyst")).toBeInTheDocument();
    expect(screen.getByText(/Preparing your workspace and syncing server state/i)).toBeInTheDocument();
    expect(window.context.setAlwaysOnTop).toHaveBeenCalledWith(true);
    expect(window.context.appReady).toHaveBeenCalled();
  });

  test("shows the loading spinner after the splash delay", async () => {
    expect(screen.queryByRole("status", { name: /loading/i })).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(screen.getByRole("status", { name: /loading/i })).toBeInTheDocument();
  });
});
