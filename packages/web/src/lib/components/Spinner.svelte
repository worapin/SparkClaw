<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";

  type SpinnerSize = "sm" | "md" | "lg";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    size?: SpinnerSize;
  }

  let { size = "md", ...restProps }: Props = $props();

  const sizeClasses: Record<SpinnerSize, string> = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };
</script>

<div
  class="inline-block rounded-full border-warm-200 border-t-terra-500 animate-spin {sizeClasses[size]}"
  {...restProps}
></div>
