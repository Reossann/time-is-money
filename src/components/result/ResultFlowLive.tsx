import type { SessionResult } from "../../types/sessionResult";
import { ResultFlow } from "./ResultFlow";

type ResultFlowLiveProps = Readonly<{
  onExit: () => void;
  result: SessionResult;
  saveFinalizedSession?: () => Promise<unknown>;
}>;

/** Renders one immutable finalized session through the live result flow. */
export function ResultFlowLive({
  onExit,
  result,
  saveFinalizedSession,
}: ResultFlowLiveProps) {
  return (
    <ResultFlow
      onExit={onExit}
      result={result}
      saveFinalizedSession={saveFinalizedSession}
    />
  );
}
