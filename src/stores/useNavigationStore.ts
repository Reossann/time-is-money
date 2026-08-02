import { create } from "zustand";

import type { NavigationId } from "@/constants/navigation";

type NavigationState = {
  currentPage: NavigationId;
  setCurrentPage: (page: NavigationId) => void;
};

export const useNavigationStore = create<NavigationState>((set) => ({
  currentPage: "dashboard",
  setCurrentPage: (page) => set({ currentPage: page }),
}));
