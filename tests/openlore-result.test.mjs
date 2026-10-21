import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/lib/shared/openlore-result.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { openLoreResult } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
test('transport success preserves a rejected command exit code', () => {
  assert.deepEqual(openLoreResult({ structuredContent: { exit_code: 1, stdout: '', stderr: 'read-only filesystem' } }), { exit_code: 1, stdout: '', stderr: 'read-only filesystem' });
});
test('Mastra wrapped result remains interpretable', () => {
  assert.equal(openLoreResult({ result: { structuredContent: { exit_code: 127, stderr: 'command not found' } } }).exit_code, 127);
});
test('JSON text MCP result retains command failure', () => {
  assert.equal(openLoreResult({ content: [{ type: 'text', text: JSON.stringify({ exit_code: 1, stderr: 'file changed concurrently' }) }] }).exit_code, 1);
});
test('successful read keeps its content', () => {
  assert.deepEqual(openLoreResult({ exit_code: 0, stdout: '# Contract\n', stderr: '' }), { exit_code: 0, stdout: '# Contract\n', stderr: '' });
});
test('arbitrary text is not mistaken for a successful command', () => {
  for (const value of [null, 'done', { content: [{ text: 'done' }] }, { error: 'auth failed' }]) assert.equal(openLoreResult(value), null);
});
