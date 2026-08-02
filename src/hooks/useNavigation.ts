import { useNavigationStore } from "@/stores/useNavigationStore";

export function useNavigation() {
  const currentPage = useNavigationStore((state) => state.currentPage);
  const setCurrentPage = useNavigationStore((state) => state.setCurrentPage);

  return {
    currentPage,
    setCurrentPage,
  };
}
