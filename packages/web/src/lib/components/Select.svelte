<script lang="ts">
  import type { HTMLSelectAttributes } from "svelte/elements";

  interface Option {
    value: string;
    label: string;
  }

  interface Props extends HTMLSelectAttributes {
    label?: string;
    options: Option[];
    error?: string;
    value?: string;
  }

  let {
    label,
    options,
    error,
    value = $bindable(""),
    ...restProps
  }: Props = $props();
</script>

<div class="w-full">
  {#if label}
    <label class="block text-sm font-medium text-warm-700 mb-1.5">
      {label}
    </label>
  {/if}
  <select
    bind:value
    class="w-full px-4 py-2.5 text-sm rounded-xl border bg-white transition-all duration-200
      {error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-warm-200 focus:border-terra-500 focus:ring-terra-500'}
      focus:outline-none focus:ring-2 focus:ring-offset-0 appearance-none cursor-pointer"
    {...restProps}
  >
    {#each options as option}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if error}
    <p class="mt-1.5 text-sm text-red-600">{error}</p>
  {/if}
</div>
