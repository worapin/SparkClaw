<script lang="ts">
  interface Props {
    class?: string;
    width?: string;
    height?: string;
    rounded?: "sm" | "md" | "lg" | "xl" | "full";
  }

  let {
    class: className = "",
    width,
    height,
    rounded = "md",
  }: Props = $props();

  const roundedClasses: Record<string, string> = {
    sm: "rounded",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
    full: "rounded-full",
  };
</script>

<div
  class="animate-pulse bg-warm-200 {roundedClasses[rounded]} {className}"
  style:width={width}
  style:height={height}
></div>
