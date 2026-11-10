export interface KeyNode {
    kind: 'key';
    name: string;
    key: string;
}
export interface FolderNode {
    kind: 'folder';
    name: string;
    /** Prefix without trailing ":"; the expand/collapse id. */
    path: string;
    /** Keys loaded under this folder (not the keyspace total). */
    count: number;
    children: TreeNode[];
}
export type TreeNode = KeyNode | FolderNode;
export type TreeRow = (KeyNode | Omit<FolderNode, 'children'>) & {
    depth: number;
    expanded?: boolean;
};

/** Build a ":"-delimited tree from the keys loaded so far. */
export function buildKeyTree(keys: string[], sep = ':'): TreeNode[] {
    const root: FolderNode = {
        kind: 'folder',
        name: '',
        path: '',
        count: 0,
        children: []
    };
    const folders = new Map<string, FolderNode>([['', root]]);
    for (const key of keys) {
        const parts = key.split(sep);
        let parent = root;
        for (let i = 0; i < parts.length - 1; i++) {
            const path = parts.slice(0, i + 1).join(sep);
            let folder = folders.get(path);
            if (!folder) {
                folder = {
                    kind: 'folder',
                    name: parts[i] ?? '',
                    path,
                    count: 0,
                    children: []
                };
                folders.set(path, folder);
                parent.children.push(folder);
            }
            folder.count++;
            parent = folder;
        }
        parent.children.push({
            kind: 'key',
            name: parts.at(-1) ?? '',
            key
        });
    }
    const sort = (nodes: TreeNode[]) => {
        nodes.sort(
            (a, b) =>
                (a.kind === b.kind ? 0 : a.kind === 'folder' ? -1 : 1) ||
                a.name.localeCompare(b.name)
        );
        nodes.forEach((n) => n.kind === 'folder' && sort(n.children));
    };
    sort(root.children);
    return root.children;
}

/** Visible rows for a virtualized list: folders open only when in `expanded`. */
export function flattenTree(
    nodes: TreeNode[],
    expanded: ReadonlySet<string>,
    depth = 0,
    out: TreeRow[] = []
): TreeRow[] {
    for (const node of nodes) {
        if (node.kind === 'key') {
            out.push({ ...node, depth });
            continue;
        }
        const { children, ...folder } = node;
        const open = expanded.has(node.path);
        out.push({ ...folder, depth, expanded: open });
        if (open) flattenTree(children, expanded, depth + 1, out);
    }
    return out;
}
