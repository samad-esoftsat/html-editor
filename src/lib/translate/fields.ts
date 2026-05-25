import type { SerializedNodes } from '@/lib/editor/craftSchema';
import type { ProjectData } from '@/lib/editor/types';

type StringMap = Record<string, string>;

const TRANSLATABLE: Record<string, string[]> = {
  Button: ['label'],
  Heading: ['text'],
  Image: ['alt'],
  List: ['items[]'],
  Text: ['text', 'labelPrefix'],
};

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function extractFromTree(tree: SerializedNodes): StringMap {
  const out: StringMap = {};
  for (const [id, node] of Object.entries(tree)) {
    const nodeType = typeof node.type === 'string' ? node.type : node.type?.resolvedName;
    const fields = TRANSLATABLE[nodeType ?? ''] ?? [];
    for (const field of fields) {
      if (field.endsWith('[]')) {
        const key = field.slice(0, -2);
        const value = node.props[key];
        if (Array.isArray(value)) {
          value.forEach((item: unknown, index: number) => {
            if (typeof item === 'string' && item.length > 0) {
              out[`${id}.${key}[${index}]`] = item;
            }
          });
        }
        continue;
      }

      const value = node.props[field];
      if (typeof value === 'string' && value.length > 0) {
        out[`${id}.${field}`] = value;
      }
    }
  }
  return out;
}

function applyToTree(tree: SerializedNodes, translations: StringMap): SerializedNodes {
  const next = deepClone(tree);
  for (const [key, value] of Object.entries(translations)) {
    const arrayMatch = key.match(/^(.+)\.(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, id, prop, indexRaw] = arrayMatch;
      const node = next[id];
      if (!node) {
        continue;
      }
      const index = Number(indexRaw);
      const current = Array.isArray(node.props[prop]) ? [...(node.props[prop] as unknown[])] : [];
      current[index] = value;
      node.props[prop] = current;
      continue;
    }

    const match = key.match(/^(.+)\.(\w+)$/);
    if (!match) {
      continue;
    }
    const [, id, prop] = match;
    const node = next[id];
    if (!node) {
      continue;
    }
    node.props[prop] = value;
  }
  return next;
}

export function extractTranslatable(data: ProjectData): StringMap {
  return extractFromTree(data.tree);
}

export function applyTranslations(data: ProjectData, translations: StringMap): ProjectData {
  return {
    ...data,
    tree: applyToTree(data.tree, translations),
  };
}
