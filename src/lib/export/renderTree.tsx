import type { ReactNode } from 'react';
import type {
  ButtonProps,
  ColumnProps,
  DividerProps,
  GlobalStyles,
  HeadingProps,
  ImageProps,
  ListProps,
  PageProps,
  ProjectData,
  RowProps,
  SectionProps,
  SpacerProps,
  TextProps,
} from '@/lib/editor/types';
import { resolveColorToken } from '@/components/editor/craft/brandTokens';
import { ROOT_NODE, type NodeId } from '@/lib/editor/craftSchema';
import { getNode, getNodeTypeName } from '@/lib/editor/tree';

export type RenderTarget = 'email' | 'print';

function marginForAlign(align: 'left' | 'center' | 'right' = 'left'): string {
  if (align === 'center') {
    return '0 auto';
  }
  if (align === 'right') {
    return '0 0 0 auto';
  }
  return '0';
}

function textAlignFor(align: 'left' | 'center' | 'right' = 'left'): 'left' | 'center' | 'right' {
  return align;
}

function wrapWithLink(linkHref: string | undefined, child: ReactNode): ReactNode {
  if (!linkHref) {
    return child;
  }
  return (
    <a href={linkHref} target="_blank" rel="noreferrer">
      {child}
    </a>
  );
}

interface RenderState {
  global: GlobalStyles;
  target: RenderTarget;
  tree: ProjectData['tree'];
  excludeIds?: Set<NodeId>;
}

function renderChildren(state: RenderState, nodeId: NodeId): ReactNode[] {
  const node = getNode(state.tree, nodeId);
  return node.nodes
    .filter((childId) => !state.excludeIds?.has(childId))
    .map((childId) => (
      <RenderNode key={childId} nodeId={childId} state={state} />
    ));
}

function renderPage(state: RenderState, props: PageProps, children: ReactNode[]) {
  if (state.target === 'email') {
    return <>{children}</>;
  }

  return (
    <div
      data-craft-page
      style={{
        background: state.global.backgroundColor,
        color: state.global.textColor,
        fontFamily: state.global.fontFamily,
        minHeight: '100%',
      }}
    >
      {children}
    </div>
  );
}

function renderSection(state: RenderState, props: SectionProps, children: ReactNode[]) {
  const paddingX = props.paddingX ?? 16;
  const paddingY = props.paddingY ?? 16;
  const resolvedBackground = resolveColorToken(props.brandToken, state.global) ?? props.backgroundColor;

  if (state.target === 'email') {
    return (
      <table
        role="presentation"
        width="100%"
        border={0}
        cellPadding={0}
        cellSpacing={0}
        style={resolvedBackground ? { backgroundColor: resolvedBackground } : undefined}
      >
        <tbody>
          <tr>
            <td>
              <table
                role="presentation"
                width="100%"
                border={0}
                cellPadding={0}
                cellSpacing={0}
                style={{ margin: '0 auto', maxWidth: 710, width: '100%' }}
              >
                <tbody>
                  <tr>
                    <td style={{ padding: `${paddingY}px ${paddingX}px` }}>{children}</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <section
      data-craft-section
      style={{ backgroundColor: resolvedBackground, padding: `${paddingY}px ${paddingX}px` }}
    >
      <div style={{ margin: '0 auto', maxWidth: 710 }}>{children}</div>
    </section>
  );
}

function renderRow(state: RenderState, props: RowProps, children: ReactNode[]) {
  if (state.target === 'email') {
    return (
      <table role="presentation" width="100%" border={0} cellPadding={0} cellSpacing={0}>
        <tbody>
          <tr style={props.reverse ? { direction: 'rtl' } : undefined}>{children}</tr>
        </tbody>
      </table>
    );
  }

  return (
    <div
      data-craft-row
      style={{
        display: 'flex',
        flexDirection: props.reverse ? 'row-reverse' : 'row',
        gap: props.gap ?? 16,
        width: '100%',
      }}
    >
      {children}
    </div>
  );
}

function renderColumn(state: RenderState, props: ColumnProps, children: ReactNode[]) {
  if (state.target === 'email') {
    return (
      <td
        width={props.widthPercent ? `${props.widthPercent}%` : undefined}
        valign={props.verticalAlign ?? 'top'}
        style={{ padding: 0, width: props.widthPercent ? `${props.widthPercent}%` : undefined }}
      >
        {children}
      </td>
    );
  }

  return (
    <div
      data-craft-column
      style={{
        display: 'flex',
        flex: props.widthPercent ? `0 0 ${props.widthPercent}%` : '1 1 0',
        flexDirection: 'column',
        gap: props.gap ?? 12,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function renderHeading(state: RenderState, props: HeadingProps) {
  const Tag = `h${props.level ?? 2}` as const;
  const resolvedColor = resolveColorToken(props.brandToken, state.global) ?? props.color ?? state.global.textColor;

  return (
    <Tag
      style={{
        color: resolvedColor,
        fontSize: props.fontSize,
        margin: '0 0 8px',
        textAlign: textAlignFor(props.align ?? 'left'),
      }}
    >
      {props.text}
    </Tag>
  );
}

function renderText(state: RenderState, props: TextProps) {
  const resolvedColor = resolveColorToken(props.brandToken, state.global) ?? props.color ?? state.global.textColor;
  const margin = `0 0 ${props.marginBottom ?? 8}px`;

  // Inline label + link (e.g., "Tel: 555-1234"): single <p>, label in text
  // color, link in linkBrandToken color.
  if (props.labelPrefix && props.linkHref) {
    const resolvedLinkColor =
      resolveColorToken(props.linkBrandToken, state.global) ?? resolvedColor;
    return (
      <p
        style={{
          color: resolvedColor,
          fontSize: props.fontSize,
          fontWeight: props.bold ? 700 : undefined,
          margin,
          textAlign: textAlignFor(props.align ?? 'left'),
          whiteSpace: 'pre-wrap',
        }}
      >
        {props.labelPrefix}
        <a
          href={props.linkHref}
          style={{ color: resolvedLinkColor, textDecoration: 'none' }}
          target="_blank"
          rel="noreferrer"
        >
          {props.text}
        </a>
      </p>
    );
  }

  const node = (
    <p
      style={{
        color: resolvedColor,
        fontSize: props.fontSize,
        fontWeight: props.bold ? 700 : undefined,
        margin,
        textAlign: textAlignFor(props.align ?? 'left'),
        whiteSpace: 'pre-wrap',
      }}
    >
      {props.text}
    </p>
  );
  return <>{wrapWithLink(props.linkHref, node)}</>;
}

function renderImage(state: RenderState, props: ImageProps) {
  if (!props.src) {
    return null;
  }

  const image = (
    <img
      src={props.src}
      alt={props.alt}
      width={state.target === 'email' && props.width ? props.width : undefined}
      height={state.target === 'email' && props.height ? props.height : undefined}
      style={{
        border: 0,
        display: 'block',
        height: props.height ?? 'auto',
        margin: marginForAlign(props.align ?? 'center'),
        maxWidth: '100%',
        width: props.width,
      }}
    />
  );

  return <>{wrapWithLink(props.linkHref, image)}</>;
}

function renderButton(state: RenderState, props: ButtonProps) {
  const resolvedBackground = resolveColorToken(props.brandToken, state.global) ?? props.backgroundColor ?? state.global.buttonColor;
  const resolvedText = props.color ?? state.global.buttonTextColor;

  if (state.target === 'email') {
    return (
      <table role="presentation" border={0} cellPadding={0} cellSpacing={0} style={{ margin: marginForAlign(props.align ?? 'left') }}>
        <tbody>
          <tr>
            <td
              style={{
                backgroundColor: resolvedBackground,
                borderRadius: 4,
                padding: '10px 18px',
                textAlign: textAlignFor(props.align ?? 'left'),
              }}
            >
              <a
                href={props.href}
                style={{
                  color: resolvedText,
                  display: 'inline-block',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
                target="_blank"
                rel="noreferrer"
              >
                {props.label}
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  // Print path: same wrapper-div trick as the canvas Button so the <a> stays
  // inline-block and is aligned by its parent's text-align rather than
  // stretching to the column width.
  return (
    <div style={{ width: '100%', textAlign: textAlignFor(props.align ?? 'left') }}>
      <a
        href={props.href}
        rel="noreferrer"
        style={{
          backgroundColor: resolvedBackground,
          borderRadius: 4,
          color: resolvedText,
          display: 'inline-block',
          padding: '10px 18px',
          textDecoration: 'none',
        }}
        target="_blank"
      >
        {props.label}
      </a>
    </div>
  );
}

function renderDivider(props: DividerProps) {
  return <hr style={{ border: 0, borderTop: `${props.thickness ?? 1}px solid ${props.color ?? '#d8d8d8'}`, margin: '12px 0' }} />;
}

function renderSpacer(props: SpacerProps) {
  return <div style={{ height: props.height }} />;
}

function renderList(state: RenderState, props: ListProps) {
  const Tag = props.ordered ? 'ol' : 'ul';
  const resolvedColor = resolveColorToken(props.brandToken, state.global) ?? props.color ?? state.global.textColor;

  return (
    <Tag style={{ color: resolvedColor, fontSize: props.fontSize, margin: '0 0 12px', paddingLeft: 20, textAlign: textAlignFor(props.align ?? 'left') }}>
      {(props.items ?? []).map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
    </Tag>
  );
}

function RenderNode({ nodeId, state }: { nodeId: NodeId; state: RenderState }) {
  const node = getNode(state.tree, nodeId);
  const type = getNodeTypeName(node);
  const children = renderChildren(state, nodeId);

  switch (type) {
    case 'Page':
      return renderPage(state, node.props as unknown as PageProps, children);
    case 'Section':
      return renderSection(state, node.props as unknown as SectionProps, children);
    case 'Row':
      return renderRow(state, node.props as unknown as RowProps, children);
    case 'Column':
      return renderColumn(state, node.props as unknown as ColumnProps, children);
    case 'Heading':
      return renderHeading(state, node.props as unknown as HeadingProps);
    case 'Text':
      return renderText(state, node.props as unknown as TextProps);
    case 'Image':
      return renderImage(state, node.props as unknown as ImageProps);
    case 'Button':
      return renderButton(state, node.props as unknown as ButtonProps);
    case 'Divider':
      return renderDivider(node.props as unknown as DividerProps);
    case 'Spacer':
      return renderSpacer(node.props as unknown as SpacerProps);
    case 'List':
      return renderList(state, node.props as unknown as ListProps);
    default:
      return null;
  }
}

export async function renderTreeMarkup(
  tree: ProjectData['tree'],
  global: GlobalStyles,
  target: RenderTarget,
  options: { excludeIds?: Set<NodeId> } = {},
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');

  return renderToStaticMarkup(
    <RenderNode
      nodeId={ROOT_NODE}
      state={{ global, target, tree, excludeIds: options.excludeIds }}
    />,
  );
}

// Render a single subtree (used for PagedJS running header/footer regions
// where the header and footer must render to their own HTML strings rather
// than as part of the main body flow).
export async function renderSubtreeMarkup(
  tree: ProjectData['tree'],
  rootId: NodeId,
  global: GlobalStyles,
  target: RenderTarget,
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');

  return renderToStaticMarkup(
    <RenderNode
      nodeId={rootId}
      state={{ global, target, tree }}
    />,
  );
}

// Find the node id of the Section with the given role (header | footer).
export function findRoleSectionId(tree: ProjectData['tree'], role: 'header' | 'footer'): NodeId | null {
  for (const [id, node] of Object.entries(tree)) {
    if (!node) continue;
    if (typeof node.custom?.role === 'string' && node.custom.role === role) {
      return id;
    }
  }
  return null;
}
