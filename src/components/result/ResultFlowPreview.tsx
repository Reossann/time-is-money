import { useState } from "react";

import { calculateHouseEquivalent } from "../../services/houseEquivalentService";
import { getSavedSessionRecord } from "../../services/sessionRecordPersistenceController";
import { HOUSE_EQUIVALENT_FIXTURES } from "../../test/fixtures/houseEquivalent";
import { ResultFlow } from "./ResultFlow";

type ResultFlowPreviewProps = {
  onExit: () => void;
};

export function ResultFlowPreview({ onExit }: ResultFlowPreviewProps) {
  const [savedRecord] = useState(() => getSavedSessionRecord());

  return (
    <ResultFlow
      houseEquivalentPreview={calculateHouseEquivalent(
        HOUSE_EQUIVALENT_FIXTURES.multipleWithProgress,
      )}
      calendarPreviewRecord={savedRecord ?? undefined}
      calendarPreviewRecords={savedRecord ? [savedRecord] : undefined}
      onExit={onExit}
    />
  );
}
