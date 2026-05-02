import { create } from "zustand";

export type NavigationMenu = "tasks" | "members" | "groups";

interface UiState {
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  selectedTaskId: number | null;
  activeMenu: NavigationMenu;
  toggleSidebar: () => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  selectTask: (taskId: number | null) => void;
  setActiveMenu: (menu: NavigationMenu) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  selectedTaskId: null,
  activeMenu: "tasks",
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  openMobileSidebar: () => set({ mobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ mobileSidebarOpen: false }),
  selectTask: (taskId) => set({ selectedTaskId: taskId }),
  setActiveMenu: (menu) =>
    set((state) => ({
      activeMenu: menu,
      mobileSidebarOpen: false,
      selectedTaskId: menu === "tasks" ? state.selectedTaskId : null
    }))
}));
