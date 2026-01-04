<script lang="ts">
  import { renameSchema } from '$lib/schemas/rename';
  import type { TreeNode } from '$lib/stores/treeStore';
  import { activeNodeId, isFolder, isLoading, treeStore } from '$lib/stores/treeStore';
  import { createEventDispatcher, onDestroy } from 'svelte';
  import * as v from 'valibot';
  import Icon from './Icon.svelte';

  export let node: TreeNode;
  export let depth = 0;

  const dispatch = createEventDispatcher<{ dragOverParent: { isDragOver: boolean } }>();
  const HOVER_EXPAND_DELAY = 800;

  let isEditing = false;
  let showMenu = false;
  let inputElement: HTMLInputElement;
  let isDragOver = false;
  let childDragOver = false;
  let hoverExpandTimer: ReturnType<typeof setTimeout> | null = null;
  let editName = '';
  let errorMessage = '';

  $: isActive = $activeNodeId === node.id;
  $: isDisabled = $isLoading;
  $: isDropTarget = isFolder(node) && (isDragOver || childDragOver);
  $: nodeIsFolder = isFolder(node);
  $: nodeExpanded = nodeIsFolder ? node.expanded : false;
  $: nodeChildren = nodeIsFolder ? node.children : [];

  function handleClick() {
    if (isDisabled) {
      return;
    }
    treeStore.setActive(node.id);
    if (nodeIsFolder) {
      treeStore.toggleExpand(node.id);
    }
  }

  function handleDoubleClick() {
    if (isDisabled) {
      return;
    }
    isEditing = true;
    editName = node.name;
    errorMessage = '';
    setTimeout(() => inputElement?.focus(), 0);
  }

  function handleRename() {
    // Prevent double execution
    if (!isEditing) {
      return;
    }

    const trimmedName = editName.trim();
    
    // Check empty
    if (!trimmedName) {
      errorMessage = 'ファイル名を入力してください';
      setTimeout(() => inputElement?.focus(), 0);
      return;
    }

    // Validate with Valibot
    const result = v.safeParse(renameSchema, { name: trimmedName });
    if (!result.success) {
      errorMessage = result.issues[0]?.message || 'バリデーションエラー';
      setTimeout(() => inputElement?.focus(), 0);
      return;
    }
    
    // No change
    if (trimmedName === node.name) {
      isEditing = false;
      editName = node.name;
      errorMessage = '';
      return;
    }
    
    // Check duplicate
    if (treeStore.checkDuplicate(node.id, trimmedName)) {
      const itemType = nodeIsFolder ? 'フォルダ' : 'ファイル';
      errorMessage = `「${trimmedName}」という名前の${itemType}は既に存在します`;
      setTimeout(() => inputElement?.focus(), 0);
      return;
    }
    
    treeStore.rename(node.id, trimmedName);
    isEditing = false;
    showMenu = false;
    errorMessage = '';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { 
      e.preventDefault(); 
      handleRename(); 
    } else if (e.key === 'Escape') { 
      isEditing = false; 
      editName = node.name;
      errorMessage = '';
    }
  }

  function handleInput() {
    if (errorMessage) {
      errorMessage = '';
    }
  }

  function handleBlur() {
    // Small delay to allow button clicks to register before blur
    setTimeout(() => {
      if (isEditing) handleRename();
    }, 100);
  }

  function handleDragStart(e: DragEvent) {
    if (isDisabled) {
      return;
    }
    e.dataTransfer?.setData('text/plain', node.id);
    e.dataTransfer!.effectAllowed = 'move';
    // Track dragging state globally for descendant check during dragover
    treeStore.setDragging(node.id);
  }

  function handleDragEnd() {
    treeStore.clearDragging();
  }

  function handleDragOver(e: DragEvent) {
    if (isDisabled) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    // Get dragged item ID from store (getData doesn't work during dragover)
    const draggedId = treeStore.getDraggingId();
    
    if (draggedId) {
      // Don't show drop target visual if:
      // 1. Dragging over self
      // 2. This node is a descendant of the dragged item
      // 3. This is the same parent folder (no-op move)
      // 4. Dragging a file over a sibling file (target would be same parent)
      if (draggedId === node.id || treeStore.isDescendantOf(node.id, draggedId)) {
        e.dataTransfer!.dropEffect = 'none';
        return;
      }

      // Get where the item would be dropped
      const targetFolderId = nodeIsFolder ? node.id : treeStore.getParentFolderId(node.id);
      const draggedParentId = treeStore.getContainingFolderId(draggedId);
      
      // If dropping into the same folder, it's a no-op - don't highlight
      if (targetFolderId === draggedParentId) {
        e.dataTransfer!.dropEffect = 'none';
        return;
      }
    }
    
    if (!isDragOver) {
      isDragOver = true;
      if (!nodeIsFolder) dispatch('dragOverParent', { isDragOver: true });
      if (nodeIsFolder && !nodeExpanded && !hoverExpandTimer) {
        hoverExpandTimer = setTimeout(() => {
          treeStore.setExpanded(node.id, true);
          hoverExpandTimer = null;
        }, HOVER_EXPAND_DELAY);
      }
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.stopPropagation();
    isDragOver = false;
    if (!nodeIsFolder) {
      dispatch('dragOverParent', { isDragOver: false });
    }
    if (hoverExpandTimer) {
      clearTimeout(hoverExpandTimer);
      hoverExpandTimer = null;
    }
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;
    childDragOver = false;
    if (!nodeIsFolder) {
      dispatch('dragOverParent', { isDragOver: false });
    }
    if (hoverExpandTimer) {
      clearTimeout(hoverExpandTimer);
      hoverExpandTimer = null;
    }
    if (isDisabled) {
      return;
    }

    // Check if this is an external file drop (from Finder)
    const hasExternalFiles = e.dataTransfer?.types.includes('Files');
    const draggedId = e.dataTransfer?.getData('text/plain');
    
    // If it's an external file drop (no internal draggedId but has Files)
    if (hasExternalFiles && !draggedId) {
      // Process external files directly into this folder (or parent folder for files)
      const targetFolderId = nodeIsFolder ? node.id : treeStore.getContainingFolderId(node.id);
      const items = e.dataTransfer?.items;
      const files = e.dataTransfer?.files;
      
      // Expand folder when dropping into it
      if (nodeIsFolder && !nodeExpanded) {
        treeStore.setExpanded(node.id, true);
      }
      
      // Try webkitGetAsEntry first (supports folders from Finder)
      let processedCount = 0;
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (typeof item.webkitGetAsEntry === 'function') {
            const entry = item.webkitGetAsEntry();
            if (entry) {
              await processExternalEntry(entry, targetFolderId);
              processedCount++;
            }
          }
        }
      }
      
      // Fallback to files if webkitGetAsEntry didn't work
      if (processedCount === 0 && files && files.length > 0) {
        for (const file of Array.from(files)) {
          const uniqueName = treeStore.getUniqueFileName(targetFolderId, file.name);
          await treeStore.addFile(uniqueName, targetFolderId || undefined);
        }
      }
      return;
    }

    // Internal drag and drop
    if (!draggedId || draggedId === node.id) {
      return;
    }

    const targetFolderId = treeStore.getParentFolderId(node.id);
    
    // Check for name conflict before moving
    const conflictName = treeStore.checkMoveConflict(draggedId, targetFolderId);
    if (conflictName) {
      alert(`移動先に同じ名前のファイルまたはフォルダ「${conflictName}」が既に存在します。`);
      return;
    }
    
    if (draggedId !== targetFolderId) {
      treeStore.moveNode(draggedId, targetFolderId);
    }
  }
  
  async function processExternalEntry(entry: FileSystemEntry, parentId: string | null): Promise<void> {
    try {
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
        
        // Find the newly created folder
        const newFolder = treeStore.findNodeByNameInParent(parentId, folderName);
        const newFolderId = newFolder?.id || null;

        const reader = dirEntry.createReader();
        const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
          reader.readEntries(resolve, reject);
        });

        for (const childEntry of entries) {
          await processExternalEntry(childEntry, newFolderId);
        }
      }
    } catch (error) {
      console.error('Failed to process entry:', error);
    }
  }

  function handleChildDragOver(e: CustomEvent<{ isDragOver: boolean }>) {
    childDragOver = e.detail.isDragOver;
  }

  function handleExpandClick(e: MouseEvent) {
    e.stopPropagation();
    if (nodeIsFolder) {
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
      on:keydown={e => e.key === 'Enter' && handleClick()}
      on:dragstart={handleDragStart}
      on:dragend={handleDragEnd}
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
      on:drop={handleDrop}
    >
      <!-- Expand Arrow -->
      <span class="w-4 h-4 flex items-center justify-center flex-shrink-0">
        {#if nodeIsFolder}
          <button class="hover:bg-gray-600 rounded p-0.5" on:click={handleExpandClick}>
            <Icon name="chevron" className="w-3 h-3 text-gray-400 transition-transform duration-150 {nodeExpanded ? 'rotate-90' : ''}" />
          </button>
        {/if}
      </span>

      <!-- Icon -->
      <span class="w-5 h-5 flex items-center justify-center flex-shrink-0">
        {#if nodeIsFolder}
          <Icon name={nodeExpanded ? 'folder-open' : 'folder'} className="w-4 h-4 {nodeExpanded ? 'text-yellow-400' : 'text-yellow-500'}" />
        {:else}
          <Icon name="file" className="w-4 h-4 text-gray-400" />
        {/if}
      </span>

      <!-- Name -->
      {#if isEditing}
        <div class="flex-1 ml-1">
          <input
            bind:this={inputElement}
            bind:value={editName}
            class="w-full bg-gray-800 text-white px-2 py-0.5 rounded border text-sm
                   {errorMessage ? 'border-red-500' : 'border-blue-500'} 
                   focus:outline-none focus:ring-1 {errorMessage ? 'focus:ring-red-400' : 'focus:ring-blue-400'}"
            on:blur={handleBlur}
            on:keydown={handleKeydown}
            on:input={handleInput}
          />
          {#if errorMessage}
            <p class="text-red-400 text-xs mt-0.5">{errorMessage}</p>
          {/if}
        </div>
      {:else}
        <span class="flex-1 truncate text-sm ml-1">{node.name}</span>
      {/if}

      <!-- Menu -->
      <div class="relative">
        <button
          class="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-600 transition-opacity {showMenu ? 'opacity-100' : ''}"
          on:click|stopPropagation={() => showMenu = !showMenu}
          disabled={isDisabled}
        >
          <Icon name="dots" className="w-4 h-4 text-gray-400" />
        </button>
        {#if showMenu}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <div 
            class="absolute right-0 mt-1 w-32 bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50" 
            role="menu"
            tabindex="-1"
            on:click|stopPropagation
          >
            <button 
              class="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 rounded-md" 
              role="menuitem"
              on:click={() => { showMenu = false; treeStore.delete(node.id); }} 
              disabled={isDisabled}
            >
              削除
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- Children -->
    {#if nodeIsFolder && nodeExpanded && nodeChildren.length > 0}
      {#each nodeChildren as child (child.id)}
        <svelte:self node={child} depth={depth + 1} on:dragOverParent={handleChildDragOver} />
      {/each}
    {/if}
  </div>
</div>
