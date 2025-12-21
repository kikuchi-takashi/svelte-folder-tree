<script lang="ts">
  import type { TreeNode } from '$lib/stores/treeStore';
  import { activeNodeId, isLoading, treeStore } from '$lib/stores/treeStore';
  import Icon from './Icon.svelte';
  import TreeItem from './TreeItem.svelte';

  let isDragOverExternal = false;
  let fileInput: HTMLInputElement;

  function getParentId(): string | null {
    const state = { nodes: [], activeNodeId: $activeNodeId, isLoading: false, draggingNodeId: null };
    treeStore.subscribe(s => Object.assign(state, s))();
    return treeStore.getActiveFolder(state);
  }

  async function handleFileSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      return;
    }

    const parentId = getParentId();
    for (const file of Array.from(files)) {
      const uniqueName = treeStore.getUniqueFileName(parentId, file.name);
      await treeStore.addFile(uniqueName, parentId || undefined);
    }
    input.value = '';
  }

  function handleAddFolder() {
    const parentId = getParentId();
    const folderName = treeStore.getUniqueFolderName(parentId);
    treeStore.addFolder(folderName, parentId || undefined);
  }

  function handleDragOver(e: DragEvent) {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      isDragOverExternal = true;
    }
  }

  function handleDragLeave(e: DragEvent) {
    const target = e.currentTarget as HTMLElement;
    if (!target.contains(e.relatedTarget as HTMLElement)) {
      isDragOverExternal = false;
    }
  }

  async function processEntry(entry: FileSystemEntry, parentId: string | null): Promise<void> {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject);
      });
      const uniqueName = treeStore.getUniqueFileName(parentId, file.name);
      await treeStore.addFile(uniqueName, parentId || undefined);
    } else if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry;
      const folderName = treeStore.getUniqueFolderName(parentId, entry.name);
      
      await treeStore.addFolder(folderName, parentId || undefined);
      
      const state = { nodes: [], activeNodeId: null, isLoading: false };
      treeStore.subscribe(s => Object.assign(state, s))();
      const newFolder = findNodeByName(state.nodes, parentId, folderName);
      const newFolderId = newFolder?.id || null;

      const reader = dirEntry.createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });

      for (const childEntry of entries) {
        await processEntry(childEntry, newFolderId);
      }
    }
  }

  function findNodeByName(nodes: TreeNode[], parentId: string | null, name: string): TreeNode | null {
    const searchInner = (items: TreeNode[]): TreeNode | null => {
      for (const item of items) {
        if (item.name === name) {
          return item;
        }
        if (item.type === 'folder' && item.children) {
          const found = searchInner(item.children);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    
    if (parentId === null) {
      return nodes.find(n => n.name === name) || null;
    }
    
    const findParent = (items: TreeNode[]): TreeNode[] | null => {
      for (const item of items) {
        if (item.id === parentId && item.type === 'folder') {
          return item.children;
        }
        if (item.type === 'folder' && item.children) {
          const found = findParent(item.children);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };
    
    const children = findParent(nodes);
    return children?.find(n => n.name === name) || null;
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOverExternal = false;

    const items = e.dataTransfer?.items;
    const files = e.dataTransfer?.files;
    
    const parentId = getParentId();

    if (items && items.length > 0 && !!items[0].webkitGetAsEntry) {
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) {
          await processEntry(entry, parentId);
        }
      }
      return;
    }

    if (!files?.length) {
      return;
    }

    for (const file of Array.from(files)) {
      const uniqueName = treeStore.getUniqueFileName(parentId, file.name);
      await treeStore.addFile(uniqueName, parentId || undefined);
    }
  }
</script>

<input bind:this={fileInput} type="file" multiple class="hidden" on:change={handleFileSelected} />

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div 
  class="w-80 h-full bg-gray-900 border-r border-gray-700 flex flex-col relative" 
  role="tree"
  tabindex="0"
  on:dragover={handleDragOver} 
  on:dragleave={handleDragLeave} 
  on:drop={handleDrop}
>
  <!-- Header -->
  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-700">
    <h2 class="text-lg font-semibold text-white">ファイルツリー</h2>
    <div class="flex gap-1">
      <button
        class="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
        on:click={() => fileInput?.click()}
        disabled={$isLoading}
        title="ファイルを追加"
      >
        <Icon name="plus-file" className="w-4 h-4" />
      </button>
      <button
        class="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
        on:click={handleAddFolder}
        disabled={$isLoading}
        title="フォルダを追加"
      >
        <Icon name="plus-folder" className="w-4 h-4" />
      </button>
    </div>
  </div>

  <!-- Loading Overlay -->
  {#if $isLoading}
    <div class="absolute inset-0 bg-gray-900/70 flex items-center justify-center z-50">
      <div class="flex items-center gap-3 text-white">
        <Icon name="spinner" className="animate-spin h-6 w-6" />
        <span>処理中...</span>
      </div>
    </div>
  {/if}

  <!-- Tree Content -->
  <div class="flex-1 overflow-y-auto py-2 px-2 relative {isDragOverExternal ? 'bg-blue-900/20 ring-2 ring-blue-400 ring-inset' : ''}">
    {#if isDragOverExternal}
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <div class="text-blue-400 text-sm font-medium flex items-center gap-2">
          <Icon name="upload" className="w-8 h-8" />
          ファイル/フォルダをドロップ
        </div>
      </div>
    {/if}
    {#each $treeStore.nodes as node (node.id)}
      <TreeItem {node} />
    {/each}
  </div>

  <!-- Hint -->
  <div class="px-4 py-2 border-t border-gray-700 text-xs text-gray-500">
    💡 Finderからファイルやフォルダをドラッグ&ドロップ
  </div>
</div>
