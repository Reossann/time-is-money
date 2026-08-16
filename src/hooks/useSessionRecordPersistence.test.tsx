import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveOnce: vi.fn(async () => {}),
  retrySave: vi.fn(async () => {}),
  removeSaved: vi.fn(async () => {}),
  getSaved: vi.fn(() => null),
}));

vi.mock("../services/sessionRecordPersistenceController", () => ({
  saveFinalizedSessionRecordOnce: mocks.saveOnce,
  retrySaveFinalizedSessionRecord: mocks.retrySave,
  removeSavedSessionRecord: mocks.removeSaved,
  getSavedSessionRecord: mocks.getSaved,
}));

import { useSessionRecordSaveStore } from "../stores/useSessionRecordSaveStore";
import { useSessionRecordPersistence } from "./useSessionRecordPersistence";

function Probe() {
  const { status, errorCode, savedSessionId, savedRecord, retry, remove } =
    useSessionRecordPersistence();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="error">{errorCode ?? "none"}</span>
      <span data-testid="saved">{savedSessionId ?? "none"}</span>
      <span data-testid="record">{savedRecord?.sessionId ?? "none"}</span>
      <button type="button" onClick={retry}>
        retry
      </button>
      <button type="button" onClick={remove}>
        remove
      </button>
    </div>
  );
}

describe("useSessionRecordPersistence", () => {
  beforeEach(() => {
    useSessionRecordSaveStore.getState().reset();
    mocks.saveOnce.mockClear();
    mocks.retrySave.mockClear();
    mocks.removeSaved.mockClear();
    mocks.getSaved.mockClear();
  });

  afterEach(() => {
    useSessionRecordSaveStore.getState().reset();
  });

  it("triggers the one-time save on mount", () => {
    render(<Probe />);
    expect(mocks.saveOnce).toHaveBeenCalledTimes(1);
  });

  it("reflects the save store state", () => {
    render(<Probe />);
    expect(screen.getByTestId("status")).toHaveTextContent("idle");

    act(() => {
      useSessionRecordSaveStore.getState().markSaved("session-1");
    });

    expect(screen.getByTestId("status")).toHaveTextContent("saved");
    expect(screen.getByTestId("saved")).toHaveTextContent("session-1");
    expect(mocks.getSaved).toHaveBeenCalled();
  });

  it("surfaces the failure error code", () => {
    render(<Probe />);
    act(() => {
      useSessionRecordSaveStore.getState().markFailed("SAVE_FAILED");
    });

    expect(screen.getByTestId("status")).toHaveTextContent("failed");
    expect(screen.getByTestId("error")).toHaveTextContent("SAVE_FAILED");
  });

  it("delegates retry and remove to the controller", () => {
    render(<Probe />);
    fireEvent.click(screen.getByRole("button", { name: "retry" }));
    fireEvent.click(screen.getByRole("button", { name: "remove" }));

    expect(mocks.retrySave).toHaveBeenCalledTimes(1);
    expect(mocks.removeSaved).toHaveBeenCalledTimes(1);
  });
});
