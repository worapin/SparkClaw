<script lang="ts">
  import { formatError } from "$lib/utils/errors";
  import type { ErrorGuidance } from "$lib/utils/errors";

  interface Props {
    error: unknown;
    onRetry?: () => void;
    onDismiss?: () => void;
  }

  let { error, onRetry, onDismiss }: Props = $props();

  let guidance = $derived(formatError(error));
</script>

<div class="bg-red-50 border border-red-200 rounded-xl p-4">
  <div class="flex items-start gap-3">
    <!-- Icon -->
    <div class="shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
      <svg class="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>

    <!-- Content -->
    <div class="flex-1 min-w-0">
      <h4 class="font-semibold text-red-800 text-sm">{guidance.title}</h4>
      <p class="text-red-700 text-sm mt-0.5">{guidance.message}</p>

      <!-- Actions -->
      {#if guidance.action || onDismiss}
        <div class="flex items-center gap-3 mt-3">
          {#if guidance.actionLink}
            <a
              href={guidance.actionLink}
              class="text-sm font-medium text-red-700 hover:text-red-800 underline"
            >
              {guidance.action}
            </a>
          {:else if guidance.action && onRetry}
            <button
              onclick={onRetry}
              class="text-sm font-medium text-red-700 hover:text-red-800 underline"
            >
              {guidance.action}
            </button>
          {/if}

          {#if onDismiss}
            <button
              onclick={onDismiss}
              class="text-sm text-red-600 hover:text-red-700"
            >
              Dismiss
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
