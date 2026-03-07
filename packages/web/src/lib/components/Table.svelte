<script lang="ts">
  import type { Snippet } from "svelte";

  interface Column {
    key: string;
    header: string;
    width?: string;
  }

  type RowActionRender = (row: Record<string, unknown>) => string | null | undefined;

  interface Props {
    columns: Column[];
    rows: Record<string, unknown>[];
    loading?: boolean;
    emptyMessage?: string;
    rowAction?: Snippet<[Record<string, unknown>]> | RowActionRender;
  }

  let {
    columns,
    rows,
    loading = false,
    emptyMessage = "No data available",
    rowAction,
  }: Props = $props();

  function isSnippet(value: unknown): value is Snippet<[Record<string, unknown>]> {
    return typeof value === "function" && value.length === 1;
  }
</script>

<div class="overflow-x-auto">
  <table class="w-full">
    <thead>
      <tr class="border-b border-warm-200">
        {#each columns as col}
          <th
            class="px-4 py-3 text-left text-sm font-semibold text-warm-700 {col.width ?? ''}"
          >
            {col.header}
          </th>
        {/each}
        {#if rowAction}
          <th class="px-4 py-3 text-right text-sm font-semibold text-warm-700 w-24">Actions</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#if loading}
        <tr>
          <td colspan={columns.length + (rowAction ? 1 : 0)} class="px-4 py-12 text-center">
            <div class="flex justify-center">
              <div class="w-8 h-8 border-3 border-warm-200 border-t-terra-500 rounded-full animate-spin"></div>
            </div>
          </td>
        </tr>
      {:else if rows.length === 0}
        <tr>
          <td colspan={columns.length + (rowAction ? 1 : 0)} class="px-4 py-12 text-center text-warm-500">
            {emptyMessage}
          </td>
        </tr>
      {:else}
        {#each rows as row}
          <tr class="border-b border-warm-100 hover:bg-warm-50 transition-colors">
            {#each columns as col}
              <td class="px-4 py-3 text-sm">
                {row[col.key] ?? "-"}
              </td>
            {/each}
            {#if rowAction}
              <td class="px-4 py-3 text-right">
                {#if isSnippet(rowAction)}
                  {@render rowAction(row)}
                {:else}
                  {@html rowAction(row) ?? ''}
                {/if}
              </td>
            {/if}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>
