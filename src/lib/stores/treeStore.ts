import { derived, get, writable } from 'svelte/store';

export interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  expanded?: boolean;
}

interface TreeState {
  nodes: TreeNode[];
  activeNodeId: string | null;
  isLoading: boolean;
}

const initialNodes: TreeNode[] = [
  {
    id: '1',
    name: 'Documents',
    type: 'folder',
    expanded: true,
    children: [
      { id: '1-1', name: 'report.pdf', type: 'file' },
      { id: '1-2', name: 'notes.txt', type: 'file' },
      {
        id: '1-3',
        name: 'Projects',
        type: 'folder',
        expanded: false,
        children: [
          { id: '1-3-1', name: 'project-a.md', type: 'file' },
          { id: '1-3-2', name: 'project-b.md', type: 'file' }
        ]
      }
    ]
  },
  {
    id: '2',
    name: 'Images',
    type: 'folder',
    expanded: false,
    children: [
      { id: '2-1', name: 'photo.jpg', type: 'file' },
      { id: '2-2', name: 'screenshot.png', type: 'file' }
    ]
  },
  { id: '3', name: 'readme.md', type: 'file' }
];

function createTreeStore() {
  const { subscribe, set, update } = writable<TreeState>({
    nodes: initialNodes,
    activeNodeId: null,
    isLoading: false
  });

  function generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  function findNodeInner(nodes: TreeNode[], id: string): TreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeInner(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  function findParentInner(nodes: TreeNode[], id: string, parent: TreeNode | null = null): TreeNode | null {
    for (const node of nodes) {
      if (node.id === id) return parent;
      if (node.children) {
        const found = findParentInner(node.children, id, node);
        if (found !== undefined && found !== null) return found;
        if (node.children.some(c => c.id === id)) return node;
      }
    }
    return null;
  }

  // Get siblings of a node (other nodes in the same parent)
  function getSiblingsInner(nodes: TreeNode[], id: string): TreeNode[] {
    // Check root level
    const rootNode = nodes.find(n => n.id === id);
    if (rootNode) {
      return nodes.filter(n => n.id !== id);
    }
    
    // Check in children recursively
    for (const node of nodes) {
      if (node.children) {
        const childNode = node.children.find(c => c.id === id);
        if (childNode) {
          return node.children.filter(c => c.id !== id);
        }
        const found = getSiblingsInner(node.children, id);
        if (found.length > 0) {
          return found;
        }
      }
    }
    return [];
  }

  // Find a sibling with a specific name
  function findSiblingByName(nodes: TreeNode[], nodeId: string, name: string): TreeNode | null {
    const siblings = getSiblingsInner(nodes, nodeId);
    return siblings.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
  }

  // Check if name exists among siblings (excluding self)
  function checkDuplicateNameInner(nodes: TreeNode[], nodeId: string, newName: string): boolean {
    const siblings = getSiblingsInner(nodes, nodeId);
    return siblings.some(s => s.name.toLowerCase() === newName.toLowerCase());
  }

  // Get children of a parent (for new items)
  function getChildrenOfParent(nodes: TreeNode[], parentId: string | null): TreeNode[] {
    if (parentId === null) {
      return nodes;
    }
    const parent = findNodeInner(nodes, parentId);
    return parent?.children || [];
  }

  // Check if name exists in a parent's children (for new nodes)
  function checkNameExistsInParent(nodes: TreeNode[], parentId: string | null, name: string): boolean {
    const children = getChildrenOfParent(nodes, parentId);
    return children.some(c => c.name.toLowerCase() === name.toLowerCase());
  }

  // Find item by name in parent
  function findItemByNameInParent(nodes: TreeNode[], parentId: string | null, name: string): TreeNode | null {
    const children = getChildrenOfParent(nodes, parentId);
    return children.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
  }

  // Generate unique name with suffix
  function generateUniqueName(nodes: TreeNode[], parentId: string | null, baseName: string): string {
    const children = getChildrenOfParent(nodes, parentId);
    
    if (!children.some(c => c.name.toLowerCase() === baseName.toLowerCase())) {
      return baseName;
    }
    
    let counter = 1;
    let newName = `${baseName}(${counter})`;
    while (children.some(c => c.name.toLowerCase() === newName.toLowerCase())) {
      counter++;
      newName = `${baseName}(${counter})`;
    }
    return newName;
  }

  function removeNode(nodes: TreeNode[], id: string): TreeNode[] {
    return nodes.filter(node => {
      if (node.id === id) return false;
      if (node.children) {
        node.children = removeNode(node.children, id);
      }
      return true;
    });
  }

  function addNodeToParent(nodes: TreeNode[], parentId: string, newNode: TreeNode): TreeNode[] {
    return nodes.map(node => {
      if (node.id === parentId && node.type === 'folder') {
        return {
          ...node,
          children: [...(node.children || []), newNode],
          expanded: true
        };
      }
      if (node.children) {
        return {
          ...node,
          children: addNodeToParent(node.children, parentId, newNode)
        };
      }
      return node;
    });
  }

  function updateNodeName(nodes: TreeNode[], id: string, newName: string): TreeNode[] {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, name: newName };
      }
      if (node.children) {
        return {
          ...node,
          children: updateNodeName(node.children, id, newName)
        };
      }
      return node;
    });
  }

  function toggleExpandedInner(nodes: TreeNode[], id: string): TreeNode[] {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, expanded: !node.expanded };
      }
      if (node.children) {
        return {
          ...node,
          children: toggleExpandedInner(node.children, id)
        };
      }
      return node;
    });
  }

  function setExpandedInner(nodes: TreeNode[], id: string, expanded: boolean): TreeNode[] {
    return nodes.map(node => {
      if (node.id === id) {
        return { ...node, expanded };
      }
      if (node.children) {
        return {
          ...node,
          children: setExpandedInner(node.children, id, expanded)
        };
      }
      return node;
    });
  }

  return {
    subscribe,

    setActive: (id: string | null) => {
      update(state => ({ ...state, activeNodeId: id }));
    },

    toggleExpand: (id: string) => {
      update(state => ({
        ...state,
        nodes: toggleExpandedInner(state.nodes, id)
      }));
    },

    setExpanded: (id: string, expanded: boolean) => {
      update(state => ({
        ...state,
        nodes: setExpandedInner(state.nodes, id, expanded)
      }));
    },

    // Check for duplicate name before rename
    checkDuplicate: (nodeId: string, newName: string): boolean => {
      const state = get({ subscribe });
      return checkDuplicateNameInner(state.nodes, nodeId, newName);
    },

    // Check if name exists in parent (for new items)
    checkNameExists: (parentId: string | null, name: string): boolean => {
      const state = get({ subscribe });
      return checkNameExistsInParent(state.nodes, parentId, name);
    },

    // Get unique folder name
    getUniqueFolderName: (parentId: string | null, baseName: string = '新規フォルダ'): string => {
      const state = get({ subscribe });
      return generateUniqueName(state.nodes, parentId, baseName);
    },

    // Get unique file name (handles extensions properly)
    getUniqueFileName: (parentId: string | null, fileName: string): string => {
      const state = get({ subscribe });
      const children = getChildrenOfParent(state.nodes, parentId);
      
      if (!children.some(c => c.name.toLowerCase() === fileName.toLowerCase())) {
        return fileName;
      }
      
      // Split name and extension
      const lastDot = fileName.lastIndexOf('.');
      const baseName = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
      const extension = lastDot > 0 ? fileName.substring(lastDot) : '';
      
      let counter = 1;
      let newName = `${baseName}(${counter})${extension}`;
      while (children.some(c => c.name.toLowerCase() === newName.toLowerCase())) {
        counter++;
        newName = `${baseName}(${counter})${extension}`;
      }
      return newName;
    },

    rename: (id: string, newName: string) => {
      update(state => ({
        ...state,
        nodes: updateNodeName(state.nodes, id, newName)
      }));
    },

    // Rename with overwrite - delete existing item with same name first
    renameWithOverwrite: (id: string, newName: string) => {
      update(state => {
        // Find and remove duplicate
        const duplicate = findSiblingByName(state.nodes, id, newName);
        let nodes = state.nodes;
        if (duplicate) {
          nodes = removeNode(nodes, duplicate.id);
        }
        // Rename the node
        nodes = updateNodeName(nodes, id, newName);
        return { ...state, nodes };
      });
    },

    // Delete item by name in parent (for overwrite)
    deleteByNameInParent: async (parentId: string | null, name: string) => {
      const state = get({ subscribe });
      const item = findItemByNameInParent(state.nodes, parentId, name);
      if (item) {
        update(s => ({ ...s, isLoading: true }));
        try {
          await fetch('/api/files', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: item.id })
          });
          update(s => ({
            ...s,
            nodes: removeNode(s.nodes, item.id),
            isLoading: false
          }));
        } catch (error) {
          update(s => ({ ...s, isLoading: false }));
        }
      }
    },

    // Delete with API call
    delete: async (id: string) => {
      update(state => ({ ...state, isLoading: true }));
      
      try {
        await fetch('/api/files', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });

        update(state => ({
          ...state,
          nodes: removeNode(state.nodes, id),
          activeNodeId: state.activeNodeId === id ? null : state.activeNodeId,
          isLoading: false
        }));
      } catch (error) {
        update(state => ({ ...state, isLoading: false }));
        console.error('Failed to delete:', error);
      }
    },

    addFile: async (name: string, parentId?: string) => {
      update(state => ({ ...state, isLoading: true }));
      
      try {
        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type: 'file', parentId })
        });

        const newNode: TreeNode = {
          id: generateId(),
          name,
          type: 'file'
        };

        update(state => {
          let newNodes: TreeNode[];
          if (parentId) {
            newNodes = addNodeToParent(state.nodes, parentId, newNode);
          } else {
            newNodes = [...state.nodes, newNode];
          }
          return {
            ...state,
            nodes: newNodes,
            isLoading: false
          };
        });
      } catch (error) {
        update(state => ({ ...state, isLoading: false }));
        console.error('Failed to add file:', error);
      }
    },

    addFolder: async (name: string, parentId?: string) => {
      update(state => ({ ...state, isLoading: true }));
      
      try {
        await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, type: 'folder', parentId })
        });

        const newNode: TreeNode = {
          id: generateId(),
          name,
          type: 'folder',
          children: [],
          expanded: true
        };

        update(state => {
          let newNodes: TreeNode[];
          if (parentId) {
            newNodes = addNodeToParent(state.nodes, parentId, newNode);
          } else {
            newNodes = [...state.nodes, newNode];
          }
          return {
            ...state,
            nodes: newNodes,
            isLoading: false
          };
        });
      } catch (error) {
        update(state => ({ ...state, isLoading: false }));
        console.error('Failed to add folder:', error);
      }
    },

    moveNode: (nodeId: string, targetParentId: string | null) => {
      update(state => {
        const nodeCopy = findNodeInner(state.nodes, nodeId);
        if (!nodeCopy) return state;

        // Don't allow moving into itself or its descendants
        if (targetParentId) {
          let checkNode: TreeNode | null = findNodeInner(state.nodes, targetParentId);
          while (checkNode) {
            if (checkNode.id === nodeId) return state;
            checkNode = findParentInner(state.nodes, checkNode.id);
          }
        }

        // Get the current parent of the node
        const currentParent = findParentInner(state.nodes, nodeId);
        
        // Don't move if already in the target location
        if ((currentParent?.id || null) === targetParentId) {
          return state;
        }

        let newNodes = removeNode(state.nodes, nodeId);
        
        if (targetParentId) {
          newNodes = addNodeToParent(newNodes, targetParentId, { ...nodeCopy });
        } else {
          newNodes = [...newNodes, { ...nodeCopy }];
        }

        return { ...state, nodes: newNodes };
      });
    },

    getActiveFolder: (state: TreeState): string | null => {
      if (!state.activeNodeId) return null;
      const node = findNodeInner(state.nodes, state.activeNodeId);
      if (!node) return null;
      if (node.type === 'folder') return node.id;
      const parent = findParentInner(state.nodes, state.activeNodeId);
      return parent?.id || null;
    },

    findNode: (id: string): TreeNode | null => {
      const state = get({ subscribe });
      return findNodeInner(state.nodes, id);
    },

    findParent: (id: string): TreeNode | null => {
      const state = get({ subscribe });
      return findParentInner(state.nodes, id);
    },

    // Get the parent folder ID for a node (used for drop on files)
    getParentFolderId: (nodeId: string): string | null => {
      const state = get({ subscribe });
      const node = findNodeInner(state.nodes, nodeId);
      if (!node) return null;
      if (node.type === 'folder') return node.id;
      const parent = findParentInner(state.nodes, nodeId);
      return parent?.id || null;
    }
  };
}

export const treeStore = createTreeStore();

export const isLoading = derived(treeStore, $state => $state.isLoading);
export const activeNodeId = derived(treeStore, $state => $state.activeNodeId);
