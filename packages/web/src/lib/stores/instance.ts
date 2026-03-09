import { writable } from "svelte/store";
import type { InstanceResponse } from "@sparkclaw/shared/types";

function createSelectedInstanceStore() {
  const stored = typeof localStorage !== "undefined"
    ? localStorage.getItem("sparkclaw_selected_instance")
    : null;

  const { subscribe, set, update } = writable<string | null>(stored);

  return {
    subscribe,
    set(id: string | null) {
      if (typeof localStorage !== "undefined") {
        if (id) {
          localStorage.setItem("sparkclaw_selected_instance", id);
        } else {
          localStorage.removeItem("sparkclaw_selected_instance");
        }
      }
      set(id);
    },
    update,
  };
}

export const selectedInstanceId = createSelectedInstanceStore();
export const userInstances = writable<InstanceResponse[]>([]);
