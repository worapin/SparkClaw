<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  type BadgeVariant = "default" | "success" | "warning" | "error" | "info";
  type BadgeSize = "sm" | "md";

  interface Props extends HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    size?: BadgeSize;
    dot?: boolean;
  }

  let {
    variant = "default",
    size = "md",
    dot = false,
    children,
    ...restProps
  }: Props = $props();

  const variantClasses: Record<BadgeVariant, string> = {
    default: "bg-warm-100 text-warm-700",
    success: "bg-green-100 text-green-700",
    warning: "bg-amber-100 text-amber-700",
    error: "bg-red-100 text-red-700",
    info: "bg-blue-100 text-blue-700",
  };

  const dotColors: Record<BadgeVariant, string> = {
    default: "bg-warm-500",
    success: "bg-green-500",
    warning: "bg-amber-500",
    error: "bg-red-500",
    info: "bg-blue-500",
  };

  const sizeClasses: Record<BadgeSize, string> = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-xs",
  };
</script>

<span
  class="inline-flex items-center gap-1.5 font-semibold rounded-full {variantClasses[variant]} {sizeClasses[size]}"
  {...restProps}
>
  {#if dot}
    <span class="w-1.5 h-1.5 rounded-full {dotColors[variant]}"></span>
  {/if}
  {#if children}
    {@render children()}
  {/if}
</span>
