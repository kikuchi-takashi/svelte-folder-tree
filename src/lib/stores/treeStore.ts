import { derived, get, writable } from 'svelte/store';

export interface FileItem {
  id: string;
  name: string;
  type: 'file';
}

export interface FolderItem {
  id: string;
  name: string;
  type: 'folder';
  children: TreeNode[];
  expanded: boolean;
}

export type TreeNode = FileItem | FolderItem;

// Type guard for FolderItem
export function isFolder(node: TreeNode): node is FolderItem {
  return node.type === 'folder';
}

interface TreeState {
  nodes: TreeNode[];
  activeNodeId: string | null;
  isLoading: boolean;
}

// Helper to get children safely
function getChildren(node: TreeNode): TreeNode[] {
  return isFolder(node) ? node.children : [];
}

// Single store instance with writable state
const { subscribe, update, set } = writable<TreeState>({
  nodes: [],
  activeNodeId: null,
  isLoading: false,
});

const generateId = (): string => Math.random().toString(36).substr(2, 9);

const findNode = (nodes: TreeNode[], id: string): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (isFolder(node)) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const findParent = (
  nodes: TreeNode[],
  id: string,
  parent: TreeNode | null = null
): TreeNode | null => {
  for (const node of nodes) {
    if (node.id === id) return parent;
    if (isFolder(node)) {
      const found = findParent(node.children, id, node);
      if (found) return found;
      if (node.children.some((c) => c.id === id)) return node;
    }
  }
  return null;
};

const getSiblings = (nodes: TreeNode[], id: string): TreeNode[] => {
  const rootNode = nodes.find((n) => n.id === id);
  if (rootNode) return nodes.filter((n) => n.id !== id);

  for (const node of nodes) {
    if (isFolder(node)) {
      if (node.children.find((c) => c.id === id)) {
        return node.children.filter((c) => c.id !== id);
      }
      const found = getSiblings(node.children, id);
      if (found.length > 0) return found;
    }
  }
  return [];
};

const getChildrenOfParent = (
  nodes: TreeNode[],
  parentId: string | null
): TreeNode[] => {
  if (parentId === null) return nodes;
  const parent = findNode(nodes, parentId);
  return parent ? getChildren(parent) : [];
};

const removeNode = (nodes: TreeNode[], id: string): TreeNode[] => {
  return nodes.filter((node) => {
    if (node.id === id) return false;
    if (isFolder(node)) {
      (node as FolderItem).children = removeNode(node.children, id);
    }
    return true;
  });
};

const addNodeToParent = (
  nodes: TreeNode[],
  parentId: string,
  newNode: TreeNode
): TreeNode[] => {
  return nodes.map((node) => {
    if (node.id === parentId && isFolder(node)) {
      return {
        ...node,
        children: [...node.children, newNode],
        expanded: true,
      } as FolderItem;
    }
    if (isFolder(node)) {
      return {
        ...node,
        children: addNodeToParent(node.children, parentId, newNode),
      } as FolderItem;
    }
    return node;
  });
};

const updateNodeName = (
  nodes: TreeNode[],
  id: string,
  newName: string
): TreeNode[] => {
  return nodes.map((node) => {
    if (node.id === id) {
      return { ...node, name: newName };
    }
    if (isFolder(node)) {
      return {
        ...node,
        children: updateNodeName(node.children, id, newName),
      } as FolderItem;
    }
    return node;
  });
};

const setNodeExpanded = (
  nodes: TreeNode[],
  id: string,
  expanded: boolean
): TreeNode[] => {
  return nodes.map((node) => {
    if (node.id === id && isFolder(node)) {
      return { ...node, expanded } as FolderItem;
    }
    if (isFolder(node)) {
      return {
        ...node,
        children: setNodeExpanded(node.children, id, expanded),
      } as FolderItem;
    }
    return node;
  });
};

export const treeStore = {
  subscribe,

  // Initialize with data from server
  initialize: (nodes: TreeNode[]) => {
    set({ nodes, activeNodeId: null, isLoading: false });
  },

  setActive: (id: string | null) =>
    update((state) => ({ ...state, activeNodeId: id })),

  toggleExpand: (id: string) => {
    update((state) => {
      const node = findNode(state.nodes, id);
      if (!node || !isFolder(node)) return state;
      return {
        ...state,
        nodes: setNodeExpanded(state.nodes, id, !node.expanded),
      };
    });
  },

  setExpanded: (id: string, expanded: boolean) => {
    update((state) => ({
      ...state,
      nodes: setNodeExpanded(state.nodes, id, expanded),
    }));
  },

  checkDuplicate: (nodeId: string, newName: string): boolean => {
    const state = get({ subscribe });
    return getSiblings(state.nodes, nodeId).some(
      (s) => s.name.toLowerCase() === newName.toLowerCase()
    );
  },

  getUniqueFolderName: (
    parentId: string | null,
    baseName = '新規フォルダ'
  ): string => {
    const state = get({ subscribe });
    const children = getChildrenOfParent(state.nodes, parentId);

    if (!children.some((c) => c.name.toLowerCase() === baseName.toLowerCase()))
      return baseName;

    let counter = 1;
    let newName = `${baseName}(${counter})`;
    while (
      children.some((c) => c.name.toLowerCase() === newName.toLowerCase())
    ) {
      counter++;
      newName = `${baseName}(${counter})`;
    }
    return newName;
  },

  getUniqueFileName: (parentId: string | null, fileName: string): string => {
    const state = get({ subscribe });
    const children = getChildrenOfParent(state.nodes, parentId);

    if (!children.some((c) => c.name.toLowerCase() === fileName.toLowerCase()))
      return fileName;

    const lastDot = fileName.lastIndexOf('.');
    const baseName = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    const extension = lastDot > 0 ? fileName.substring(lastDot) : '';

    let counter = 1;
    let newName = `${baseName}(${counter})${extension}`;
    while (
      children.some((c) => c.name.toLowerCase() === newName.toLowerCase())
    ) {
      counter++;
      newName = `${baseName}(${counter})${extension}`;
    }
    return newName;
  },

  rename: (id: string, newName: string) => {
    update((state) => ({
      ...state,
      nodes: updateNodeName(state.nodes, id, newName),
    }));
  },

  delete: async (id: string) => {
    update((state) => ({ ...state, isLoading: true }));
    try {
      await fetch('/api/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      update((state) => ({
        ...state,
        nodes: removeNode(state.nodes, id),
        activeNodeId: state.activeNodeId === id ? null : state.activeNodeId,
        isLoading: false,
      }));
    } catch (error) {
      update((state) => ({ ...state, isLoading: false }));
      console.error('Failed to delete:', error);
    }
  },

  addFile: async (name: string, parentId?: string) => {
    update((state) => ({ ...state, isLoading: true }));
    try {
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: 'file', parentId }),
      });
      const newNode: FileItem = { id: generateId(), name, type: 'file' };
      update((state) => ({
        ...state,
        nodes: parentId
          ? addNodeToParent(state.nodes, parentId, newNode)
          : [...state.nodes, newNode],
        isLoading: false,
      }));
    } catch (error) {
      update((state) => ({ ...state, isLoading: false }));
      console.error('Failed to add file:', error);
    }
  },

  addFolder: async (name: string, parentId?: string) => {
    update((state) => ({ ...state, isLoading: true }));
    try {
      await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: 'folder', parentId }),
      });
      const newNode: FolderItem = {
        id: generateId(),
        name,
        type: 'folder',
        children: [],
        expanded: true,
      };
      update((state) => ({
        ...state,
        nodes: parentId
          ? addNodeToParent(state.nodes, parentId, newNode)
          : [...state.nodes, newNode],
        isLoading: false,
      }));
    } catch (error) {
      update((state) => ({ ...state, isLoading: false }));
      console.error('Failed to add folder:', error);
    }
  },

  moveNode: (nodeId: string, targetParentId: string | null) => {
    update((state) => {
      const nodeCopy = findNode(state.nodes, nodeId);
      if (!nodeCopy) return state;

      // Prevent moving into itself or descendants
      if (targetParentId) {
        let checkNode: TreeNode | null = findNode(state.nodes, targetParentId);
        while (checkNode) {
          if (checkNode.id === nodeId) return state;
          checkNode = findParent(state.nodes, checkNode.id);
        }
      }

      const currentParent = findParent(state.nodes, nodeId);
      if ((currentParent?.id || null) === targetParentId) return state;

      let newNodes = removeNode(state.nodes, nodeId);
      newNodes = targetParentId
        ? addNodeToParent(newNodes, targetParentId, { ...nodeCopy })
        : [...newNodes, { ...nodeCopy }];

      return { ...state, nodes: newNodes };
    });
  },

  getActiveFolder: (state: TreeState): string | null => {
    if (!state.activeNodeId) return null;
    const node = findNode(state.nodes, state.activeNodeId);
    if (!node) return null;
    if (isFolder(node)) return node.id;
    const parent = findParent(state.nodes, state.activeNodeId);
    return parent?.id || null;
  },

  getParentFolderId: (nodeId: string): string | null => {
    const state = get({ subscribe });
    const node = findNode(state.nodes, nodeId);
    if (!node) return null;
    if (isFolder(node)) return node.id;
    const parent = findParent(state.nodes, nodeId);
    return parent?.id || null;
  },
};

export const isLoading = derived(treeStore, ($state) => $state.isLoading);
export const activeNodeId = derived(treeStore, ($state) => $state.activeNodeId);
