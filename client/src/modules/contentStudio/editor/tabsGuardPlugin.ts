import { Plugin } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { CONTENT_STUDIO_ADD_TAB_META } from './blockCommands';

function collectTabsBlocks(doc: { descendants: (f: (node: ProseMirrorNode) => void) => void }) {
  const blocks: ProseMirrorNode[] = [];
  doc.descendants((node) => {
    if (node.type.name === 'tabs') blocks.push(node);
  });
  return blocks;
}

export function createTabsAccidentalInsertGuardPlugin() {
  return new Plugin({
    appendTransaction(transactions, oldState, newState) {
      if (transactions.some((transaction) => transaction.getMeta(CONTENT_STUDIO_ADD_TAB_META))) {
        return null;
      }
      if (!transactions.some((transaction) => transaction.docChanged)) {
        return null;
      }

      const oldBlocks = collectTabsBlocks(oldState.doc);
      const tr = newState.tr;
      let changed = false;
      let tabsIndex = 0;
      const deletions: Array<{ from: number; to: number }> = [];

      newState.doc.descendants((node, pos) => {
        if (node.type.name !== 'tabs') return;
        const oldTabs = oldBlocks[tabsIndex];
        tabsIndex += 1;
        if (!oldTabs || node.childCount <= oldTabs.childCount) return;

        const lastChild = node.lastChild;
        if (!lastChild || lastChild.type.name !== 'tabItem') return;
        if (lastChild.textContent.trim().length > 0) return;
        if (String(lastChild.attrs.label || 'Tab') !== 'Tab') return;

        const lastPos = pos + node.nodeSize - lastChild.nodeSize - 1;
        const { from, to } = newState.selection;
        if (from >= lastPos && to <= lastPos + lastChild.nodeSize) return;

        deletions.push({ from: lastPos, to: lastPos + lastChild.nodeSize });
      });

      deletions
        .sort((a, b) => b.from - a.from)
        .forEach(({ from, to }) => {
          tr.delete(from, to);
          changed = true;
        });

      return changed ? tr : null;
    },
  });
}
