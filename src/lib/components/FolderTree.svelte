<script lang="ts">
  import { activeNodeId, isLoading, treeStore } from '$lib/stores/treeStore';
  import TreeItem from './TreeItem.svelte';

  let isDragOverExternal = false;
  let fileInput: HTMLInputElement;

  function handleAddFileClick() {
    fileInput?.click();
  }

  async function handleFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) return;

    let parentId: string | null = null;
    const state = { nodes: [], activeNodeId: $activeNodeId, isLoading: false };
    treeStore.subscribe(s => Object.assign(state, s))();
    parentId = treeStore.getActiveFolder(state);

    for (const file of Array.from(files)) {
      // Generate unique name if duplicate exists
      const uniqueName = treeStore.getUniqueFileName(parentId, file.name);
      await treeStore.addFile(uniqueName, parentId || undefined);
    }

    input.value = '';
  }

  function handleAddFolder() {
    let parentId: string | null = null;
    const state = { nodes: [], activeNodeId: $activeNodeId, isLoading: false };
    treeStore.subscribe(s => Object.assign(state, s))();
    parentId = treeStore.getActiveFolder(state);

    // Get unique folder name automatically
    const folderName = treeStore.getUniqueFolderName(parentId, '新規フォルダ');
    
    treeStore.addFolder(folderName, parentId || undefined);
  }

  function handleDragOver(event: DragEvent) {
    if (event.dataTransfer?.types.includes('Files')) {
      event.preventDefault();
      isDragOverExternal = true;
    }
  }

  function handleDragLeave(event: DragEvent) {
    const target = event.currentTarget as HTMLElement;
    const relatedTarget = event.relatedTarget as HTMLElement | null;
    if (!target.contains(relatedTarget)) {
      isDragOverExternal = false;
    }
  }

  async function handleDrop(event: DragEvent) {
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) {
      isDragOverExternal = false;
      return;
    }

    event.preventDefault();
    isDragOverExternal = false;

    let parentId: string | null = null;
    const state = { nodes: [], activeNodeId: $activeNodeId, isLoading: false };
    treeStore.subscribe(s => Object.assign(state, s))();
    parentId = treeStore.getActiveFolder(state);

    for (const file of Array.from(files)) {
      // Generate unique name if duplicate exists
      const uniqueName = treeStore.getUniqueFileName(parentId, file.name);
      await treeStore.addFile(uniqueName, parentId || undefined);
    }
  }
</script>

<input
  bind:this={fileInput}
  type="file"
  multiple
  class="hidden"
  on:change={handleFileSelected}
/>

<div
  class="w-80 h-full bg-gray-900 border-r border-gray-700 flex flex-col relative"
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
  on:drop={handleDrop}
>
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
    <h2 class="text-lg font-semibold text-white">ファイルツリー</h2>
    <div class="flex gap-1">
      <button
        class="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={handleAddFileClick}
        disabled={$isLoading}
        title="ファイルを追加"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </button>
      <button
        class="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        on:click={handleAddFolder}
        disabled={$isLoading}
        title="フォルダを追加"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        </svg>
      </button>
    </div>
  </div>

  <!-- Loading Overlay -->
  {#if $isLoading}
    <div class="absolute inset-0 bg-gray-900/70 flex items-center justify-center z-50">
      <div class="flex items-center gap-3 text-white">
        <svg class="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>処理中...</span>
      </div>
    </div>
  {/if}

  <!-- Tree Content -->
  <div
    class="flex-1 overflow-y-auto py-2 px-2 relative
           {isDragOverExternal ? 'bg-blue-900/20 ring-2 ring-blue-400 ring-inset' : ''}"
  >
    {#if isDragOverExternal}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div class="text-blue-400 text-sm font-medium flex items-center gap-2">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
          ファイルをドロップしてください
        </div>
      </div>
    {/if}

    {#each $treeStore.nodes as node (node.id)}
      <TreeItem {node} />
    {/each}
  </div>

  <!-- Drop hint at bottom -->
  <div class="px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
    💡 Finderからファイルをドラッグ&ドロップで追加できます
  </div>
</div>
