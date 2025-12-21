import type { FileItem, FolderItem, TreeNode } from '$lib/stores/treeStore';
import type { PageServerLoad } from './$types';

// Mock API - simulates fetching tree data from server
async function fetchTreeData(): Promise<TreeNode[]> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const nodes: TreeNode[] = [
    {
      id: '1',
      name: 'Documents',
      type: 'folder',
      expanded: true,
      children: [
        { id: '1-1', name: 'report.pdf', type: 'file' } as FileItem,
        { id: '1-2', name: 'notes.txt', type: 'file' } as FileItem,
        {
          id: '1-3',
          name: 'Projects',
          type: 'folder',
          expanded: false,
          children: [
            { id: '1-3-1', name: 'project-a.md', type: 'file' } as FileItem,
            { id: '1-3-2', name: 'project-b.md', type: 'file' } as FileItem
          ]
        } as FolderItem
      ]
    } as FolderItem,
    {
      id: '2',
      name: 'Images',
      type: 'folder',
      expanded: false,
      children: [
        { id: '2-1', name: 'photo.jpg', type: 'file' } as FileItem,
        { id: '2-2', name: 'screenshot.png', type: 'file' } as FileItem
      ]
    } as FolderItem,
    { id: '3', name: 'readme.md', type: 'file' } as FileItem
  ];
  
  return nodes;
}

export const load: PageServerLoad = async () => {
  const treeData = await fetchTreeData();
  
  return {
    treeData
  };
};
