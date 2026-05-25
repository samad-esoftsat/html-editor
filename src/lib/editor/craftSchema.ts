export const ROOT_NODE = 'ROOT';

export type NodeId = string;

export interface SerializedNodeDataType {
  resolvedName?: string;
}

export interface SerializedNode {
  type: string | SerializedNodeDataType;
  displayName?: string;
  isCanvas?: boolean;
  parent: NodeId | null;
  props: Record<string, unknown>;
  custom?: Record<string, unknown>;
  hidden?: boolean;
  nodes: NodeId[];
  linkedNodes: Record<string, NodeId>;
}

export type SerializedNodes = Record<NodeId, SerializedNode>;
