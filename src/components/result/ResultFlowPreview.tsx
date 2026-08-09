import { calculateHouseEquivalent } from "../../services/houseEquivalentService";
import { HOUSE_EQUIVALENT_FIXTURES } from "../../test/fixtures/houseEquivalent";
import { ResultFlow } from "./ResultFlow";

type ResultFlowPreviewProps = {
  onExit: () => void;
};

export function ResultFlowPreview({ onExit }: ResultFlowPreviewProps) {
  return (
    <ResultFlow
      houseEquivalentPreview={calculateHouseEquivalent(
        HOUSE_EQUIVALENT_FIXTURES.multipleWithProgress,
      )}
      onExit={onExit}
    />
  );
}
