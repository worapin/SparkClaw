<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    title?: string;
    subtitle?: string;
    headerAction?: Snippet;
    footer?: Snippet;
    hoverable?: boolean;
    children?: Snippet;
  }

  let {
    title,
    subtitle,
    headerAction,
    footer,
    hoverable = false,
    children,
    ...restProps
  }: Props = $props();
</script>

<div
  class="bg-white rounded-2xl border border-warm-200 overflow-hidden
    {hoverable ? 'card-hover cursor-pointer' : ''}"
  {...restProps}
>
  {#if title || headerAction}
    <div class="px-6 py-4 border-b border-warm-100 flex items-center justify-between">
      <div>
        {#if title}
          <h3 class="font-display text-lg">{title}</h3>
        {/if}
        {#if subtitle}
          <p class="text-sm text-warm-500 mt-0.5">{subtitle}</p>
        {/if}
      </div>
      {#if headerAction}
        {@render headerAction()}
      {/if}
    </div>
  {/if}
  
  <div class="p-6">
    {#if children}
      {@render children()}
    {/if}
  </div>
  
  {#if footer}
    <div class="px-6 py-4 bg-warm-50 border-t border-warm-100">
      {@render footer()}
    </div>
  {/if}
</div>
