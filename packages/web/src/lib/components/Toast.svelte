<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  type ToastType = "success" | "error" | "warning" | "info";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    type: ToastType;
    message: string;
    onClose?: () => void;
  }

  let { type, message, onClose }: Props = $props();

  const typeStyles: Record<ToastType, { bg: string; icon: string }> = {
    success: {
      bg: "bg-green-50 border-green-200 text-green-800",
      icon: "✓",
    },
    error: {
      bg: "bg-red-50 border-red-200 text-red-800",
      icon: "✕",
    },
    warning: {
      bg: "bg-amber-50 border-amber-200 text-amber-800",
      icon: "⚠",
    },
    info: {
      bg: "bg-blue-50 border-blue-200 text-blue-800",
      icon: "ℹ",
    },
  };
</script>

<div
  class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-lg animate-fade-up {typeStyles[type].bg}"
>
  <span class="font-semibold">{typeStyles[type].icon}</span>
  <span>{message}</span>
  {#if onClose}
    <button
      onclick={onClose}
      class="ml-2 hover:opacity-70 transition-opacity"
    >
      ✕
    </button>
  {/if}
</div>
