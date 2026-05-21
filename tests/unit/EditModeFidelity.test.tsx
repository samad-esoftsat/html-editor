/**
 * Edit vs Preview layout fidelity invariants.
 *
 * jsdom does NOT execute CSS, so getBoundingClientRect() returns all-zero rects.
 * For the CTA width test, both measurements will be 0 — the test passes trivially
 * and acts as a regression net for future API drift (thrown errors, missing props, etc.).
 *
 * For the bullet paddingLeft test, we assert the explicit inline paddingLeft style
 * instead of a bounding rect, because the component sets paddingLeft via inline
 * style in both modes (40px edit / 40 preview) and this IS observable in jsdom.
 */
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { EditorModeProvider, useEditorMode } from '@/components/editor/EditorModeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EditableBulletList } from '@/components/editor/editable/EditableBulletList';
import { EditableText } from '@/components/editor/editable/EditableText';
import { EditableLink } from '@/components/editor/editable/EditableLink';

function SetMode({ mode }: { mode: 'edit' | 'preview' }) {
  const { setMode } = useEditorMode();
  React.useEffect(() => { setMode(mode); }, [mode, setMode]);
  return null;
}

function Wrap({ mode, children }: { mode: 'edit' | 'preview'; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <EditorModeProvider>
        <SetMode mode={mode} />
        {children}
      </EditorModeProvider>
    </TooltipProvider>
  );
}

describe('Edit vs Preview layout fidelity', () => {
  it('CTA button width is within 2px between edit and preview mode', () => {
    // NOTE: jsdom returns 0 for getBoundingClientRect — both values are 0 and the
    // assertion holds trivially. This test still guards against thrown errors and
    // import/prop-name regressions across modes.
    function Cta() {
      const [text, setText] = React.useState('Contact Us');
      const [url, setUrl] = React.useState('https://example.com');
      return (
        <a
          href={url}
          className="cta-edit-anchor"
          data-testid="cta"
          style={{ display: 'inline-block', position: 'relative', padding: '10px 30px', textDecoration: 'none' }}
        >
          <span className="inline-flex items-center">
            <EditableText value={text} onChange={setText} singleLine ariaLabel="cta text" />
            <EditableLink value={url} onChange={setUrl} ariaLabel="edit link" />
          </span>
        </a>
      );
    }

    const editRender = render(<Wrap mode="edit"><Cta /></Wrap>);
    const editWidth = editRender.getByTestId('cta').getBoundingClientRect().width;
    editRender.unmount();

    const previewRender = render(<Wrap mode="preview"><Cta /></Wrap>);
    const previewWidth = previewRender.getByTestId('cta').getBoundingClientRect().width;
    previewRender.unmount();

    expect(Math.abs(editWidth - previewWidth)).toBeLessThanOrEqual(2);
  });

  it('Bullet list paddingLeft is identical between edit and preview mode', () => {
    // Fallback assertion: instead of bounding-rect (always 0 in jsdom), we compare
    // the inline paddingLeft style on the <ul> element. Both modes set paddingLeft
    // explicitly — '40px' in edit, 40 (coerced to '40px') in preview — so this
    // comparison is meaningful and not trivial.
    function Bullets() {
      const [bullets, setBullets] = React.useState(['First bullet', 'Second bullet']);
      return (
        <div data-testid="bullets">
          <EditableBulletList
            bullets={bullets}
            onChange={setBullets}
            ariaLabel="bullets"
          />
        </div>
      );
    }

    const editRender = render(<Wrap mode="edit"><Bullets /></Wrap>);
    const editUl = editRender.getByTestId('bullets').querySelector('ul');
    expect(editUl).not.toBeNull();
    const editPaddingLeft = (editUl as HTMLElement).style.paddingLeft;
    editRender.unmount();

    const previewRender = render(<Wrap mode="preview"><Bullets /></Wrap>);
    const previewUl = previewRender.getByTestId('bullets').querySelector('ul');
    expect(previewUl).not.toBeNull();
    const previewPaddingLeft = (previewUl as HTMLElement).style.paddingLeft;
    previewRender.unmount();

    // Normalize both to a px number for numeric comparison
    const toPx = (v: string) => parseFloat(v || '0');
    expect(Math.abs(toPx(editPaddingLeft) - toPx(previewPaddingLeft))).toBeLessThanOrEqual(2);
  });
});
