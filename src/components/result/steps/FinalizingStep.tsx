import {
  ResultStepPlaceholder,
  type ResultStepProps,
} from "./ResultStepPlaceholder";

export function FinalizingStep(props: ResultStepProps) {
  return <ResultStepPlaceholder step="finalizing" {...props} />;
}
