<script lang="ts">
  import type { TreeNode } from '$lib/stores/treeStore';
  import { activeNodeId, isLoading, treeStore } from '$lib/stores/treeStore';
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let node: TreeNode;
  export let depth: number = 0;
  export let parentDragOver: boolean = false;

  const dispatch = createEventDispatcher<{ dragOverParent: { isDragOver: boolean } }>();
  const HOVER_EXPAND_DELAY = 800;

  let isEditing = false;
  let editName = node.name;
  let showMenu = false;
  let inputElement: HTMLInputElement;
  let isDragOver = false;
  let hoverExpandTimer: ReturnType<typeof setTimeout> | null = null;
  let childDragOver = false;

  $: isActive = $activeNodeId === node.id;
  $: isDisabled = $isLoading;
  // Only the folder itself should show the visual effect, not propagate to children items
  $: isDropTarget = node.type === 'folder' && (isDragOver || childDragOver);

  function handleClick() {
    if (isDisabled) return;
    treeStore.setActive(node.id);
    if (node.type === 'folder') {
      treeStore.toggleExpand(node.id);
    }
  }

  function handleDoubleClick() {
    if (isDisabled) return;
    isEditing = true;
    editName = node.name;
    setTimeout(() => inputElement?.focus(), 0);
  }

  function handleRename() {
    const trimmedName = editName.trim();
    
    if (!trimmedName) {
      isEditing = false;
      editName = node.name;
      return;
    }
    
    if (trimmedName === node.name) {
      isEditing = false;
      showMenu = false;
      return;
    }
    
    const isDuplicate = treeStore.checkDuplicate(node.id, trimmedName);
    
    if (isDuplicate) {
      const itemType = node.type === 'folder' ? 'フォルダ' : 'ファイル';
      alert(`「${trimmedName}」という名前の${itemType}は既に存在します。別の名前を入力してください。`);
      setTimeout(() => inputElement?.focus(), 0);
      return;
    }
    
    treeStore.rename(node.id, trimmedName);
    isEditing = false;
    showMenu = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleRename();
    } else if (event.key === 'Escape') {
      isEditing = false;
      editName = node.name;
    }
  }

  async function handleDelete() {
    showMenu = false;
    await treeStore.delete(node.id);
  }

  function handleDragStart(event: DragEvent) {
    if (isDisabled) return;
    event.dataTransfer?.setData('text/plain', node.id);
    event.dataTransfer!.effectAllowed = 'move';
  }

  function handleDragOver(event: DragEvent) {
    if (isDisabled) return;
    event.preventDefault();
    event.stopPropagation();
    
    if (!isDragOver) {
      isDragOver = true;
      
      // Notify parent folder about drag over (for file items)
      if (node.type === 'file') {
        dispatch('dragOverParent', { isDragOver: true });
      }
      
      // For folders: start timer to expand
      if (node.type === 'folder' && !node.expanded && !hoverExpandTimer) {
        hoverExpandTimer = setTimeout(() => {
          treeStore.setExpanded(node.id, true);
          hoverExpandTimer = null;
        }, HOVER_EXPAND_DELAY);
      }
    }
  }

  function handleDragLeave(event: DragEvent) {
    event.stopPropagation();
    isDragOver = false;
    
    if (node.type === 'file') {
      dispatch('dragOverParent', { isDragOver: false });
    }
    
    if (hoverExpandTimer) {
      clearTimeout(hoverExpandTimer);
      hoverExpandTimer = null;
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    isDragOver = false;
    childDragOver = false;
    
    if (node.type === 'file') {
      dispatch('dragOverParent', { isDragOver: false });
    }
    
    if (hoverExpandTimer) {
      clearTimeout(hoverExpandTimer);
      hoverExpandTimer = null;
    }
    
    if (isDisabled) return;

    const draggedId = event.dataTransfer?.getData('text/plain');
    if (!draggedId || draggedId === node.id) return;

    const targetFolderId = treeStore.getParentFolderId(node.id);
    
    if (draggedId !== targetFolderId) {
      treeStore.moveNode(draggedId, targetFolderId);
    }
  }

  function handleChildDragOver(event: CustomEvent<{ isDragOver: boolean }>) {
    childDragOver = event.detail.isDragOver;
  }

  function handleExpandClick(event: MouseEvent) {
    event.stopPropagation();
    if (node.type === 'folder') {
      treeStore.toggleExpand(node.id);
    }
  }

  onDestroy(() => {
    if (hoverExpandTimer) {
      clearTimeout(hoverExpandTimer);
    }
  });
</script>

<div class="select-none">
  <!-- Folder container with drop target styling -->
  <div class={isDropTarget ? 'bg-blue-500/20 rounded-md' : ''}>
    <div
      class="group flex items-center gap-0.5 px-1 py-1 rounded-md cursor-pointer transition-all duration-150
             hover:bg-gray-700/50
             {isActive ? 'bg-blue-600/30 text-blue-300' : 'text-gray-300'}
             {isDisabled ? 'opacity-50 cursor-not-allowed' : ''}"
      style="padding-left: {depth * 16 + 4}px"
      role="button"
      tabindex="0"
      draggable={!isEditing && !isDisabled}
      on:click={handleClick}
      on:dblclick={handleDoubleClick}
      on:keydown={(e) => e.key === 'Enter' && handleClick()}
      on:dragstart={handleDragStart}
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
      on:drop={handleDrop}
    >
      <!-- Expand/Collapse Arrow (folders only) -->
      <span class="w-4 h-4 flex items-center justify-center flex-shrink-0">
        {#if node.type === 'folder'}
          <button
            class="hover:bg-gray-600 rounded p-0.5 transition-colors"
            on:click={handleExpandClick}
          >
            <svg 
              class="w-3 h-3 text-gray-400 transition-transform duration-150 {node.expanded ? 'rotate-90' : ''}" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"/>
            </svg>
          </button>
        {/if}
      </span>

      <!-- Folder/File Icon -->
      <span class="w-5 h-5 flex items-center justify-center text-sm flex-shrink-0">
        {#if node.type === 'folder'}
          {#if node.expanded}
            <svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
            </svg>
          {:else}
            <svg class="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5l-2-2H4z"/>
            </svg>
          {/if}
        {:else}
          <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
          </svg>
        {/if}
      </span>

      <!-- Name / Edit Input -->
      {#if isEditing}
        <input
          bind:this={inputElement}
          bind:value={editName}
          class="flex-1 bg-gray-800 text-white px-2 py-0.5 rounded border border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 text-sm ml-1"
          on:blur={handleRename}
          on:keydown={handleKeydown}
        />
      {:else}
        <span class="flex-1 truncate text-sm ml-1">{node.name}</span>
      {/if}

      <!-- Three-dot Menu -->
      <div class="relative">
        <button
          class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-600 transition-opacity duration-150
                 {showMenu ? 'opacity-100' : ''}"
          on:click|stopPropagation={() => showMenu = !showMenu}
          disabled={isDisabled}
        >
          <svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
          </svg>
        </button>

        {#if showMenu}
          <div
            class="absolute right-0 mt-1 w-32 bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50"
            on:click|stopPropagation
          >
            <button
              class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 rounded-md transition-colors"
              on:click={handleDelete}
              disabled={isDisabled}
            >
              削除
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Children (recursive) - inside the drop target container -->
    {#if node.type === 'folder' && node.expanded && node.children}
      {#each node.children as child (child.id)}
        <svelte:self 
          node={child} 
          depth={depth + 1} 
          parentDragOver={false}
          on:dragOverParent={handleChildDragOver}
        />
      {/each}
    {/if}
  </div>
</div>
