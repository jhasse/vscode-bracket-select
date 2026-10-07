import * as assert from 'assert';
import * as vscode from 'vscode';

// Opens `content` in an editor with the cursor at '|', runs `command` repeatedly and returns the
// selected text after each run.
async function select(content: string, command: string, times = 1): Promise<string[]> {
    const offset = content.indexOf('|');
    const document = await vscode.workspace.openTextDocument({
        language: 'markdown',
        content: content.replace('|', ''),
    });
    const editor = await vscode.window.showTextDocument(document);
    const cursor = document.positionAt(offset);
    editor.selection = new vscode.Selection(cursor, cursor);

    const selected: string[] = [];
    for (let i = 0; i < times; i++) {
        await vscode.commands.executeCommand(command);
        selected.push(document.getText(editor.selection));
    }
    return selected;
}

const SELECT = 'bracket-select.select';
const SELECT_INCLUDE = 'bracket-select.select-include';

suite('Bracket Select', () => {
    teardown(() => vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor'));

    test('selects between brackets and expands', async () => {
        assert.deepStrictEqual(await select('f(a, [b, |c])', SELECT, 3), ['b, c', '[b, c]', 'a, [b, c]']);
    });

    test('selects including brackets', async () => {
        assert.deepStrictEqual(await select('f(a, |b)', SELECT_INCLUDE), ['(a, b)']);
    });

    test('selects between quotes', async () => {
        assert.deepStrictEqual(await select('f("a |b")', SELECT), ['a b']);
    });
});

suite('Fenced code blocks', () => {
    teardown(() => vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor'));

    const markdown = '# Title\n\ntext\n```js\nfoo("bar", b|az);\ndon\'t\n```\nafter\n';
    const content = 'foo("bar", baz);\ndon\'t';
    const block = '```js\n' + content + '\n```';

    test('expands from brackets to the content and then the whole block', async () => {
        assert.deepStrictEqual(await select(markdown, SELECT, 4), ['"bar", baz', '("bar", baz)', content, block]);
    });

    test('selects the content when not inside brackets', async () => {
        // the apostrophe must not be treated as a quote pair with something outside the block
        assert.deepStrictEqual(await select(markdown.replace('b|az', 'baz').replace('don', 'd|on'), SELECT), [content]);
    });

    test('selects the whole block when including brackets', async () => {
        assert.deepStrictEqual(await select(markdown.replace('b|az', 'baz').replace('don', 'd|on'), SELECT_INCLUDE), [block]);
    });

    test('supports tilde fences and ignores unmatched brackets', async () => {
        assert.deepStrictEqual(await select('~~~\nfoo(|\n~~~\n', SELECT), ['foo(']);
    });

    test('ignores triple backticks that are not a fence', async () => {
        assert.deepStrictEqual(await select('```a|b```\n', SELECT), ['ab']);
    });
});
