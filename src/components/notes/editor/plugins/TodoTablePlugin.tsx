import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ListItemNode, $isListItemNode, ListNode, $isListNode, $createListNode, $createListItemNode } from '@lexical/list';
import { $isTableCellNode, TableCellNode, $isTableRowNode } from '@lexical/table';
import { $isParagraphNode, $createParagraphNode } from 'lexical';

export default function TodoTablePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    // Register a node transform on ListItemNode
    return editor.registerNodeTransform(ListItemNode, (node: ListItemNode) => {
      const checked = node.getChecked();
      if (checked === undefined) return; // Not a checklist item

      const listNode = node.getParent();
      if (!$isListNode(listNode)) return;

      const cellNode = listNode.getParent();
      if (!$isTableCellNode(cellNode)) return;

      const rowNode = cellNode.getParent();
      if (!$isTableRowNode(rowNode)) return;

      const tableNode = rowNode.getParent();
      if (!tableNode) return;

      // Verify this is a Todo Table (2 columns, headers "To Do" and "Done")
      const firstRow = tableNode.getFirstChild();
      if (!$isTableRowNode(firstRow)) return;
      
      const headerCells = firstRow.getChildren();
      if (headerCells.length !== 2) return;
      
      const header1Text = headerCells[0].getTextContent().trim();
      const header2Text = headerCells[1].getTextContent().trim();
      
      if (header1Text !== 'To Do' || header2Text !== 'Done') return;

      // Check which column the item is currently in
      const cells = rowNode.getChildren();
      const colIndex = cells.indexOf(cellNode);

      if (checked && colIndex === 0) {
        // Item was checked in "To Do", move to "Done"
        const targetCell = cells[1];
        if ($isTableCellNode(targetCell)) {
          moveItemToCell(node, targetCell, listNode);
        }
      } else if (!checked && colIndex === 1) {
        // Item was unchecked in "Done", move back to "To Do"
        const targetCell = cells[0];
        if ($isTableCellNode(targetCell)) {
          moveItemToCell(node, targetCell, listNode);
        }
      }
    });
  }, [editor]);

  return null;
}

function moveItemToCell(itemNode: ListItemNode, targetCell: TableCellNode, originalList: ListNode) {
  // Try to find an existing checklist in the target cell
  let targetList = null;
  const children = targetCell.getChildren();
  for (const child of children) {
    if ($isListNode(child) && child.getListType() === 'check') {
      targetList = child;
      break;
    }
  }

  // If no checklist exists, create one
  if (!targetList) {
    targetList = $createListNode('check');
    targetCell.append(targetList);
    
    // Clean up empty paragraph if it was the only child
    if (children.length === 1 && $isParagraphNode(children[0]) && children[0].getTextContent() === '') {
      children[0].remove();
    }
  }

  // Detach from current list and attach to target list
  itemNode.remove();
  targetList.append(itemNode);

  // If the original list is now empty, remove it to keep the DOM clean
  if (originalList.getChildrenSize() === 0) {
    const parentCell = originalList.getParent();
    if (parentCell && $isTableCellNode(parentCell)) {
      originalList.remove();
      // Ensure the cell isn't completely empty so it remains clickable
      if (parentCell.getChildrenSize() === 0) {
        // If it's the "To Do" column, let's keep an empty checklist ready for them
        const cells = parentCell.getParent()?.getChildren() || [];
        if (cells.indexOf(parentCell) === 0) {
          const newList = $createListNode('check');
          newList.append($createListItemNode());
          parentCell.append(newList);
        } else {
          parentCell.append($createParagraphNode());
        }
      }
    }
  }
}
