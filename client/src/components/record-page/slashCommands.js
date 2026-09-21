import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';

const SlashCommandPluginKey = new PluginKey('slashCommand');

/** Per-editor image upload trigger (supports multiple editors on one page). */
const imageUploadTriggers = new WeakMap();

export function registerDescriptionImageUploadTrigger(editor, trigger) {
  if (editor && typeof trigger === 'function') {
    imageUploadTriggers.set(editor, trigger);
  }
}

export function unregisterDescriptionImageUploadTrigger(editor) {
  if (editor) imageUploadTriggers.delete(editor);
}

function matchesSlashQuery(cmd, query) {
  const q = query.toLowerCase();
  if (!q) return true;
  if (cmd.title.toLowerCase().includes(q)) return true;
  return (cmd.keywords || []).some((keyword) => keyword.includes(q) || q.includes(keyword));
}

export const DESCRIPTION_SLASH_COMMANDS = [
  { title: 'Heading 1', command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
  { title: 'Heading 2', command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
  { title: 'Heading 3', command: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
  { title: 'Paragraph', command: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run() },
  {
    title: 'Image',
    keywords: ['img', 'photo', 'picture', 'upload'],
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).run();
      window.setTimeout(() => {
        imageUploadTriggers.get(editor)?.();
      }, 0);
    }
  },
  { title: 'Bullet list', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { title: 'Numbered list', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { title: 'Blockquote', command: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
];

/** Chat composer: same blocks as description, no inline image (attachments cover media). */
export const INTERNAL_CHAT_SLASH_COMMANDS = DESCRIPTION_SLASH_COMMANDS.filter(
  (cmd) => cmd.title !== 'Image'
);

function createSlashCommandList() {
  const list = document.createElement('div');
  list.className = 'slash-command-list w-max min-w-[10rem] max-w-[12rem] rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg py-1 overflow-hidden max-h-[280px] overflow-y-auto';
  return list;
}

/**
 * @param {typeof DESCRIPTION_SLASH_COMMANDS} commands
 * @param {{ name?: string, pluginKey?: import('@tiptap/pm/state').PluginKey, preferAbove?: boolean }} [options]
 */
export function createSlashCommands(commands = DESCRIPTION_SLASH_COMMANDS, options = {}) {
  const pluginKey = options.pluginKey || SlashCommandPluginKey;
  const name = options.name || 'slashCommands';
  const preferAbove = options.preferAbove === true;

  return Extension.create({
    name,

    addProseMirrorPlugins() {
      return [
        Suggestion({
          editor: this.editor,
          pluginKey,
          char: '/',
          startOfLine: false,
          // Default [' '] — null matched `/` inside URLs (https://…) and ate Enter.
          // Still not enough alone: TipTap only inspects the current text node, so a
          // mid-word `/` at a node boundary (marks) was treated as a valid trigger.
          allowedPrefixes: [' '],
          allow: ({ state, range }) => {
            if (range.from <= 0) return true;
            const $from = state.doc.resolve(range.from);
            if ($from.parentOffset === 0) return true;
            const charBefore = state.doc.textBetween(range.from - 1, range.from);
            return /\s/.test(charBefore);
          },
          items: ({ query }) => commands.filter((cmd) => matchesSlashQuery(cmd, query)),
          command: ({ editor, range, props }) => {
            props.command(editor, range);
          },
          render: () => {
            let list = null;
            let selectedIndex = 0;
            let currentProps = null;
            let viewportListenerBound = false;
            let outsidePointerListenerBound = false;

            function destroyList() {
              unbindGlobalListeners();
              list?.remove();
              list = null;
              currentProps = null;
            }

            function ensureList() {
              if (list) return;
              list = createSlashCommandList();
              document.body.appendChild(list);
              bindGlobalListeners();
            }

            return {
              onStart: (props) => {
                currentProps = props;
                if (!props.items?.length) {
                  destroyList();
                  return;
                }
                ensureList();
                selectedIndex = 0;
                updateList(props);
                positionList(props);
                requestAnimationFrame(() => positionList(props));
              },
              onUpdate: (props) => {
                currentProps = props;
                if (!props.items?.length) {
                  destroyList();
                  return;
                }
                ensureList();
                selectedIndex = 0;
                updateList(props);
                positionList(props);
                requestAnimationFrame(() => positionList(props));
              },
              onKeyDown: ({ event }) => {
                if (!currentProps || !list || !currentProps.items?.length) return false;
                if (event.key === 'ArrowUp') {
                  selectedIndex = (selectedIndex - 1 + list.children.length) % Math.max(1, list.children.length);
                  updateSelection();
                  return true;
                }
                if (event.key === 'ArrowDown') {
                  selectedIndex = (selectedIndex + 1) % Math.max(1, list.children.length);
                  updateSelection();
                  return true;
                }
                if (event.key === 'Enter') {
                  const item = list.children[selectedIndex];
                  if (item?.dataset?.index !== undefined) {
                    const idx = parseInt(item.dataset.index, 10);
                    const cmd = currentProps.items[idx];
                    if (cmd) {
                      currentProps.command(cmd);
                      return true;
                    }
                  }
                  // Empty / no match — let Enter insert a newline (or send in chat)
                  return false;
                }
                if (event.key === 'Escape') {
                  destroyList();
                  return true;
                }
                return false;
              },
              onExit: () => {
                destroyList();
              },
            };

            function updateList(props) {
              if (!list) return;
              list.innerHTML = '';
              props.items.forEach((item, idx) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `slash-command-item w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 ${idx === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''}`;
                btn.dataset.index = String(idx);
                btn.textContent = item.title;
                btn.addEventListener('click', () => props.command(item));
                list.appendChild(btn);
              });
            }

            function updateSelection() {
              if (!list) return;
              const items = list.querySelectorAll('.slash-command-item');
              items.forEach((el, i) => {
                el.classList.toggle('bg-gray-100', i === selectedIndex);
                el.classList.toggle('dark:bg-gray-700', i === selectedIndex);
              });
            }

            function positionList(props) {
              if (!list || !props.clientRect) return;
              const rect = props.clientRect();
              if (!rect) return;
              list.style.position = 'fixed';
              list.style.zIndex = '12000';
              list.style.maxHeight = '280px';
              list.style.overflowY = 'auto';

              const gap = 4;
              const menuHeight = list.offsetHeight || 280;
              const menuWidth = list.offsetWidth || 192;
              const spaceBelow = window.innerHeight - rect.bottom - gap;
              const spaceAbove = rect.top - gap;
              const placeAbove = preferAbove
                || spaceBelow < Math.min(menuHeight, 160)
                || spaceAbove > spaceBelow;

              let top = placeAbove
                ? rect.top - menuHeight - gap
                : rect.bottom + gap;
              // Keep fully in viewport
              top = Math.max(8, Math.min(top, window.innerHeight - menuHeight - 8));

              let left = rect.left;
              left = Math.max(8, Math.min(left, window.innerWidth - menuWidth - 8));

              list.style.left = `${left}px`;
              list.style.top = `${top}px`;
            }

            function handleViewportChange() {
              if (!currentProps) return;
              positionList(currentProps);
            }

            function handleOutsidePointerDown(event) {
              if (!list || !currentProps?.editor?.view?.dom) return;
              const target = event.target;
              if (!(target instanceof Element)) return;
              const clickedInsideMenu = list.contains(target);
              const clickedInsideEditor = currentProps.editor.view.dom.contains(target);
              if (!clickedInsideMenu && !clickedInsideEditor) {
                currentProps.editor.commands.blur();
              }
            }

            function bindGlobalListeners() {
              if (!viewportListenerBound) {
                window.addEventListener('scroll', handleViewportChange, true);
                window.addEventListener('resize', handleViewportChange);
                viewportListenerBound = true;
              }
              if (!outsidePointerListenerBound) {
                document.addEventListener('pointerdown', handleOutsidePointerDown, true);
                outsidePointerListenerBound = true;
              }
            }

            function unbindGlobalListeners() {
              if (viewportListenerBound) {
                window.removeEventListener('scroll', handleViewportChange, true);
                window.removeEventListener('resize', handleViewportChange);
                viewportListenerBound = false;
              }
              if (outsidePointerListenerBound) {
                document.removeEventListener('pointerdown', handleOutsidePointerDown, true);
                outsidePointerListenerBound = false;
              }
            }
          },
        }),
      ];
    },
  });
}

export const SlashCommands = createSlashCommands(DESCRIPTION_SLASH_COMMANDS);

export const InternalChatSlashCommands = createSlashCommands(INTERNAL_CHAT_SLASH_COMMANDS, {
  name: 'internalChatSlashCommands',
  pluginKey: new PluginKey('internalChatSlashCommand'),
  preferAbove: true,
});
