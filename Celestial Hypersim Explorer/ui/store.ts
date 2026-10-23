"use client";
import { create } from "zustand";
import type { Department } from "../schemas/domain";

interface ExplorerState {
  query: string;
  department: Department | "all";
  selectedModule: string;
  setQuery: (query: string) => void;
  setDepartment: (department: Department | "all") => void;
  setModule: (selectedModule: string) => void;
}
// Ephemeral UI state only. Never persist roles, seals, personal notes, or credentials.
export const useExplorer = create<ExplorerState>(set => ({
  query: "", department: "all", selectedModule: "grand-archives",
  setQuery: query => set({ query }), setDepartment: department => set({ department }),
  setModule: selectedModule => set({ selectedModule }),
}));
