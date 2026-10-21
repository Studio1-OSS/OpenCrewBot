import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/lib/shared/openlore-recovery.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { lostOpenLoreSession, readOnlyOpenLoreCall, recoverOpenLoreSession } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const lost = () => new Error('Error POSTing to endpoint: session not found\n');
test('recognizes only the observed missing-session transport rejection', () => {
 assert.equal(lostOpenLoreSession(lost()), true);
 for (const e of [new Error('file not found'),new Error('401 unauthorized'),new Error('command: session not found'),{message:lost().message}]) assert.equal(lostOpenLoreSession(e),false);
});
test('only simple read and metadata calls may be replayed', () => {
 for (const command of ['whoami','lore docsets','cat /shared/atlas-approved.md','grep -ri Atlas /shared']) assert.equal(readOnlyOpenLoreCall('mcp_abc_shell',{command}),true);
 for (const command of ['echo x > /frontend/note.md','rm /frontend/a','find /frontend -delete','history --clear','cat /shared/a | head','cat /shared/a; echo x','cat $(echo /shared/a)']) assert.equal(readOnlyOpenLoreCall('mcp_abc_shell',{command}),false);
 assert.equal(readOnlyOpenLoreCall('mcp_abc_list_commands',{}),true);
});
test('reconnects and retries a read once with original arguments', async () => {
 let calls=0,connections=0;
 const execute=recoverOpenLoreSession(async input=>{calls++;if(calls===1)throw lost();return input.command;},async()=>{connections++;},input=>readOnlyOpenLoreCall('mcp_a_shell',input));
 assert.equal(await execute({command:'whoami'}),'whoami');assert.equal(calls,2);assert.equal(connections,1);
});
test('reconnects a lost write session without replaying the mutation', async () => {
 let calls=0,connections=0;
 const execute=recoverOpenLoreSession(async()=>{calls++;throw lost();},async()=>{connections++;},()=>false);
 await assert.rejects(execute({command:'echo x > /frontend/a'}),/not replayed/);assert.equal(calls,1);assert.equal(connections,1);
});
test('does not retry auth or command errors', async () => {
 let connections=0;
 const execute=recoverOpenLoreSession(async()=>{throw new Error('401 unauthorized');},async()=>{connections++;},()=>true);
 await assert.rejects(execute({}),/401/);assert.equal(connections,0);
});
test('surfaces a second missing-session failure without looping', async () => {
 let calls=0;
 const execute=recoverOpenLoreSession(async()=>{calls++;throw lost();},async()=>{},()=>true);
 await assert.rejects(execute({}),/session not found/);assert.equal(calls,2);
});

test('structured command rejections are returned without reconnecting', async () => {
 let connections=0,calls=0;
 const execute=recoverOpenLoreSession(async()=>{calls++;return {exit_code:1,stderr:'read-only filesystem'};},async()=>{connections++;},()=>true);
 assert.equal((await execute({})).exit_code,1);assert.equal(calls,1);assert.equal(connections,0);
});
