import { writeFileSync, mkdirSync } from 'node:fs';
import { renderEmail } from '../src/lib/export/renderEmail';
import { createDefaultProject } from '../src/lib/editor/defaultProject';
import { createBlankProject } from '../src/lib/editor/templates';

mkdirSync('src/lib/export/__fixtures__', { recursive: true });
writeFileSync('src/lib/export/__fixtures__/baseline-globaltt.html', renderEmail(createDefaultProject()));
writeFileSync('src/lib/export/__fixtures__/baseline-blank.html', renderEmail(createBlankProject()));
console.log('Wrote baselines');
