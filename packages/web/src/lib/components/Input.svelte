<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  type InputSize = "sm" | "md" | "lg";

  interface Props extends HTMLInputAttributes {
    label?: string;
    error?: string;
    hint?: string;
    inputSize?: InputSize;
    id?: string;
  }

  let {
    label,
    error,
    hint,
    inputSize = "md",
    id = `input-${crypto.randomUUID()}`,
    value = $bindable(""),
    ...restProps
  }: Props = $props();

  const sizeClasses: Record<InputSize, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-4 py-3 text-base",
  };
</script>

<div class="w-full">
  {#if label}
    <label for={id} class="block text-sm font-medium text-warm-700 mb-1.5">
      {label}
    </label>
  {/if}
  <input
    {id}
    bind:value
    class="w-full rounded-xl border bg-white transition-all duration-200
      {sizeClasses[inputSize]}
      {error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-warm-200 focus:border-terra-500 focus:ring-terra-500'}
      focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:bg-warm-50 disabled:text-warm-400 disabled:cursor-not-allowed"
    {...restProps}
  />
  {#if error}
    <p class="mt-1.5 text-sm text-red-600">{error}</p>
  {:else if hint}
    <p class="mt-1.5 text-sm text-warm-500">{hint}</p>
  {/if}
</div>
