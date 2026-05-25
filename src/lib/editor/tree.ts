import { v4 as uuid } from 'uuid';
import { ROOT_NODE, type NodeId, type SerializedNode, type SerializedNodes } from './craftSchema';
import type {
  ButtonProps,
  ColumnProps,
  DividerProps,
  HeadingProps,
  ImageProps,
  ListProps,
  PageProps,
  RowProps,
  SectionProps,
  SpacerProps,
  TextProps,
} from './types';

export type ResolvedNodeName =
  | 'Page'
  | 'Section'
  | 'Row'
  | 'Column'
  | 'Heading'
  | 'Text'
  | 'Image'
  | 'Button'
  | 'Divider'
  | 'Spacer'
  | 'List';

type PropsByName = {
  Page: PageProps;
  Section: SectionProps;
  Row: RowProps;
  Column: ColumnProps;
  Heading: HeadingProps;
  Text: TextProps;
  Image: ImageProps;
  Button: ButtonProps;
  Divider: DividerProps;
  Spacer: SpacerProps;
  List: ListProps;
};

interface NewNodeOptions<T extends ResolvedNodeName> {
  custom?: Record<string, unknown>;
  id?: NodeId;
  isCanvas?: boolean;
  parent: NodeId | null;
  props?: Partial<PropsByName[T]>;
  type: T;
}

function makeNode<T extends ResolvedNodeName>({
  custom = {},
  id = uuid(),
  isCanvas = false,
  parent,
  props,
  type,
}: NewNodeOptions<T>): [NodeId, SerializedNode] {
  return [
    id,
    {
      type: { resolvedName: type },
      displayName: type,
      isCanvas,
      parent,
      props: { ...(props ?? {}) },
      custom,
      hidden: false,
      nodes: [],
      linkedNodes: {},
    },
  ];
}

export class SerializedTreeBuilder {
  readonly nodes: SerializedNodes;

  constructor(pageProps: Partial<PageProps> = {}) {
    const [rootId, rootNode] = makeNode({
      id: ROOT_NODE,
      isCanvas: true,
      parent: null,
      props: pageProps,
      type: 'Page',
    });
    this.nodes = { [rootId]: rootNode };
  }

  addSection(
    props: Partial<SectionProps> = {},
    custom: Record<string, unknown> = {},
  ): NodeId {
    return this.append(ROOT_NODE, 'Section', props, true, custom);
  }

  addRow(parentId: NodeId, props: Partial<RowProps> = {}): NodeId {
    return this.append(parentId, 'Row', props, true);
  }

  addColumn(parentId: NodeId, props: Partial<ColumnProps> = {}): NodeId {
    return this.append(parentId, 'Column', props, true);
  }

  addHeading(parentId: NodeId, props: HeadingProps, custom?: Record<string, unknown>): NodeId {
    return this.append(parentId, 'Heading', props, false, custom);
  }

  addText(parentId: NodeId, props: TextProps, custom?: Record<string, unknown>): NodeId {
    return this.append(parentId, 'Text', props, false, custom);
  }

  addImage(parentId: NodeId, props: ImageProps, custom?: Record<string, unknown>): NodeId {
    return this.append(parentId, 'Image', props, false, custom);
  }

  addButton(parentId: NodeId, props: ButtonProps, custom?: Record<string, unknown>): NodeId {
    return this.append(parentId, 'Button', props, false, custom);
  }

  addDivider(parentId: NodeId, props: Partial<DividerProps> = {}, custom?: Record<string, unknown>): NodeId {
    return this.append(parentId, 'Divider', props, false, custom);
  }

  addSpacer(parentId: NodeId, props: SpacerProps, custom?: Record<string, unknown>): NodeId {
    return this.append(parentId, 'Spacer', props, false, custom);
  }

  addList(parentId: NodeId, props: ListProps, custom?: Record<string, unknown>): NodeId {
    return this.append(parentId, 'List', props, false, custom);
  }

  private append<T extends ResolvedNodeName>(
    parentId: NodeId,
    type: T,
    props: Partial<PropsByName[T]>,
    isCanvas: boolean,
    custom?: Record<string, unknown>,
  ): NodeId {
    const [id, node] = makeNode({ custom, isCanvas, parent: parentId, props, type });
    this.nodes[id] = node;
    this.nodes[parentId].nodes.push(id);
    return id;
  }
}

export function cloneTree(tree: SerializedNodes): SerializedNodes {
  return structuredClone(tree);
}

export function getNode(tree: SerializedNodes, id: NodeId): SerializedNode {
  const node = tree[id];
  if (!node) {
    throw new Error(`Missing node ${id}`);
  }
  return node;
}

export function getNodeTypeName(node: SerializedNode): string | undefined {
  if (typeof node.type === 'string') {
    return node.type;
  }
  return node.type?.resolvedName;
}

export function getPageChildIds(tree: SerializedNodes): NodeId[] {
  return getNode(tree, ROOT_NODE).nodes;
}

export function getSectionRole(tree: SerializedNodes, id: NodeId): string | undefined {
  const node = getNode(tree, id);
  return typeof node.custom?.role === 'string' ? node.custom.role : undefined;
}

export function getHeaderSectionId(tree: SerializedNodes): NodeId | undefined {
  return getPageChildIds(tree).find((id) => getSectionRole(tree, id) === 'header');
}

export function getFooterSectionId(tree: SerializedNodes): NodeId | undefined {
  return getPageChildIds(tree).find((id) => getSectionRole(tree, id) === 'footer');
}

export function getUserSectionIds(tree: SerializedNodes): NodeId[] {
  return getPageChildIds(tree).filter((id) => {
    const role = getSectionRole(tree, id);
    return role !== 'header' && role !== 'footer';
  });
}

export function findNodeBySlot(tree: SerializedNodes, slot: string): NodeId | undefined {
  return Object.entries(tree).find(([, node]) => node.custom?.slot === slot)?.[0];
}

export function setNodeProps(
  tree: SerializedNodes,
  id: NodeId,
  updater: (props: Record<string, unknown>) => Record<string, unknown>,
): SerializedNodes {
  const next = cloneTree(tree);
  const node = getNode(next, id);
  node.props = updater({ ...node.props });
  return next;
}

export function visitTree(tree: SerializedNodes, visit: (id: NodeId, node: SerializedNode) => void): void {
  Object.entries(tree).forEach(([id, node]) => {
    visit(id, node);
  });
}
