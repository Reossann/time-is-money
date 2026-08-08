import { useActivityStore } from "../stores/useActivityStore";
import {
  retrySessionFinalization,
  stopAndFinalizeMeasurement,
} from "../services/sessionFinalizationController";

export function useSessionFinalization() {
  const measurementStatus = useActivityStore(
    (state) => state.measurementStatus,
  );
  const result = useActivityStore((state) => state.finalizedResult);
  const errorCode = useActivityStore((state) => state.finalizationErrorCode);

  return {
    status: measurementStatus,
    result,
    errorCode,
    stopAndFinalizeMeasurement,
    retrySessionFinalization,
  } as const;
}
