<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
  type Size = "sm" | "md" | "lg";

  interface Props extends HTMLButtonAttributes {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    icon?: Snippet;
    children?: Snippet;
  }

  let {
    variant = "primary",
    size = "md",
    loading = false,
    disabled = false,
    icon,
    children,
    ...restProps
  }: Props = $props();

  const variantClasses: Record<Variant, string> = {
    primary: "bg-terra-500 text-white hover:bg-terra-600 focus:ring-terra-500",
    secondary: "bg-warm-100 text-warm-900 hover:bg-warm-200 focus:ring-warm-400",
    outline: "bg-transparent border-2 border-warm-300 text-warm-700 hover:border-terra-500 hover:text-terra-500 focus:ring-terra-500",
    ghost: "bg-transparent text-warm-600 hover:bg-warm-100 focus:ring-warm-400",
    danger: "bg-red-500 text-white hover:bg-red-600 focus:ring-red-500",
  };

  const sizeClasses: Record<Size, string> = {
    sm: "px-3 py-1.5 text-sm rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-xl",
  };
</script>

<button
  type="button"
  disabled={disabled || loading}
  class="inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed {variantClasses[variant]} {sizeClasses[size]}"
  {...restProps}
>
  {#if loading}
    <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  {:else if icon}
    {@render icon()}
  {/if}
  {#if children}
    {@render children()}
  {/if}
</button>
