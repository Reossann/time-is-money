import { calculateHouseEquivalent } from "../../services/houseEquivalentService";
import { buildSessionRecord } from "../../services/sessionRecordService";
import { HOUSE_EQUIVALENT_FIXTURES } from "../../test/fixtures/houseEquivalent";
import { validSessionResult } from "../../test/fixtures/sessionResult";
import { ResultFlow } from "./ResultFlow";

type ResultFlowPreviewProps = {
  onExit: () => void;
};

export function ResultFlowPreview({ onExit }: ResultFlowPreviewProps) {
  const baseRecord = buildSessionRecord({
    result: validSessionResult,
    ownerId: "development-preview",
    now: Date.UTC(2026, 7, 16),
  });
  const calendarPreviewRecords = Array.from({ length: 15 }, (_, index) => ({
    ...baseRecord,
    sessionId: `${baseRecord.sessionId.slice(0, -2)}${String(index + 1).padStart(2, "0")}`,
    localDateKey: `2026-08-${String(index + 1).padStart(2, "0")}`,
    totals: {
      ...baseRecord.totals,
      netYen: index % 3 === 0 ? 300 : index % 3 === 1 ? -150 : 100,
    },
  }));

  return (
    <ResultFlow
      houseEquivalentPreview={calculateHouseEquivalent(
        HOUSE_EQUIVALENT_FIXTURES.multipleWithProgress,
      )}
      calendarPreviewRecord={calendarPreviewRecords[0]}
      calendarPreviewRecords={calendarPreviewRecords}
      onExit={onExit}
    />
  );
}
