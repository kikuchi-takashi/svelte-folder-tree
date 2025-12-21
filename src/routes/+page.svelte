<script lang="ts">
  import FolderTree from '$lib/components/FolderTree.svelte';
</script>

<svelte:head>
  <title>フォルダツリー</title>
  <meta name="description" content="SvelteKit folder tree with drag & drop support" />
</svelte:head>

<div class="min-h-screen bg-gray-950 flex">
  <FolderTree />
  
  <!-- Main Content Area -->
  <div class="flex-1 flex items-center justify-center">
    <div class="text-center text-gray-500">
      <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
      </svg>
      <p class="text-lg">ファイルを選択してください</p>
      <p class="text-sm mt-2">
        左のツリーからファイルを選択するか、<br />
        Finderからドラッグ&ドロップで追加できます
      </p>
    </div>
  </div>
</div>
