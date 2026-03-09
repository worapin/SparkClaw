<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "./Button.svelte";

  interface Props {
    open: boolean;
    title?: string;
    size?: "sm" | "md" | "lg";
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    children?: Snippet;
  }

  let {
    open,
    title,
    size = "md",
    onClose,
    onConfirm,
    confirmText = "Confirm",
    cancelText = "Cancel",
    loading = false,
    children,
  }: Props = $props();

  const sizeClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
  };
</script>

{#if open}
  <!-- Backdrop -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed inset-0 bg-black/50 z-50 animate-fade-up"
    onclick={onClose}
    role="presentation"
    aria-hidden="true"
  >
    <!-- Modal -->
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full {sizeClasses[size]} bg-white rounded-2xl shadow-xl"
      onclick={(e) => e.stopPropagation()}
    >
      {#if title}
        <div class="px-6 py-4 border-b border-warm-100">
          <h2 class="font-display text-xl">{title}</h2>
        </div>
      {/if}
      
      <div class="p-6">
        {#if children}
          {@render children()}
        {/if}
      </div>
      
      <div class="px-6 py-4 bg-warm-50 rounded-b-2xl flex justify-end gap-3">
        <Button variant="ghost" onclick={onClose}>
          {cancelText}
        </Button>
        {#if onConfirm}
          <Button variant="primary" onclick={onConfirm} {loading}>
            {confirmText}
          </Button>
        {/if}
      </div>
    </div>
  </div>
{/if}
