import { readSiteContent } from '../src/lib/content-files.ts';
const content = await readSiteContent();
process.stdout.write('Content validated: ' + content.posts.length + ' posts, ' + content.projects.length + ' projects, ' + content.assets.length + ' local assets.\n');
