import { beforeEach,afterEach,it,expect } from 'vitest';
import { mkdtemp,mkdir,writeFile,readFile,rm,symlink,unlink } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { cleanBuildOutputs } from '../scripts/lib/build-cleanup.mjs';
let base:string;let root:string;
beforeEach(async()=>{base=await mkdtemp(resolve('.cache/cleanup-'));root=join(base,'workspace');await mkdir(root);});
afterEach(async()=>{if(!resolve(base).startsWith(resolve('.cache/cleanup-')))throw Error('Unsafe cleanup');await rm(base,{recursive:true,force:true});});
it('清除真实内容缓存和旧产物，但保留源码与图片缓存',async()=>{
  for(const dir of ['dist','.astro','node_modules/.astro/assets','src'])await mkdir(join(root,dir),{recursive:true});
  await writeFile(join(root,'node_modules/.astro/data-store.json'),'stale');
  await writeFile(join(root,'node_modules/.astro/assets/keep'),'cached image');await writeFile(join(root,'src/keep'),'source');
  await cleanBuildOutputs(root);
  await expect(readFile(join(root,'node_modules/.astro/data-store.json'))).rejects.toMatchObject({code:'ENOENT'});
  expect(await readFile(join(root,'src/keep'),'utf8')).toBe('source');expect(await readFile(join(root,'node_modules/.astro/assets/keep'),'utf8')).toBe('cached image');
  await cleanBuildOutputs(root);
});
it('拒绝删除通过父目录 junction 指向工作区外的内容',async()=>{
  const external=join(base,'external');await mkdir(join(external,'pagefind'),{recursive:true});await writeFile(join(external,'pagefind/keep'),'sentinel');
  await symlink(external,join(root,'public'),'junction');
  try{await expect(cleanBuildOutputs(root)).rejects.toThrow(/outside|symlink/);expect(await readFile(join(external,'pagefind/keep'),'utf8')).toBe('sentinel');}finally{await unlink(join(root,'public'));}
});
it('拒绝符号链接产物及被替换成目录的缓存文件',async()=>{
  const external=join(base,'external');await mkdir(external);await symlink(external,join(root,'dist'),'junction');
  try{await expect(cleanBuildOutputs(root)).rejects.toThrow(/symlink/);}finally{await unlink(join(root,'dist'));}
  await mkdir(join(root,'node_modules/.astro/data-store.json'),{recursive:true});
  await expect(cleanBuildOutputs(root)).rejects.toThrow(/file/);
});
