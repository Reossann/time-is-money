import { ResultFlow } from "./ResultFlow";

type ResultFlowPreviewProps = {
  onExit: () => void;
};

export function ResultFlowPreview({ onExit }: ResultFlowPreviewProps) {
  return <ResultFlow onExit={onExit} />;
}
