'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { bracketUtil } from './bracketUtil';
import { fenceUtil } from './fenceUtil';

class SearchResult {
    bracket: string;
    offset: number;

    constructor(bracket: string, offset: number) {
        this.bracket = bracket;
        this.offset = offset;
    }
}

function findBackward(text: string, index: number): SearchResult {
    const bracketStack: string[] = [];
    for (let i = index; i >= 0; i--) {
        let char = text.charAt(i);
        // if it's a quote, we can not infer it is a open or close one
        //so just return, this is for the case current selection is inside a string;
        if (bracketUtil.isQuoteBracket(char) && bracketStack.length == 0) {
            return new SearchResult(char, i);
        }
        if (bracketUtil.isOpenBracket(char)) {
            if (bracketStack.length == 0) {
                return new SearchResult(char, i);
            } else {
                let top = bracketStack.pop();
                if (!bracketUtil.isMatch(char, top)) {
                    throw 'Unmatched bracket pair';
                }
            }
        } else if (bracketUtil.isCloseBracket(char)) {
            bracketStack.push(char);
        }
    }
    //we are geting to the edge
    return null;
}

function findForward(text: string, index: number): SearchResult {
    const bracketStack: string[] = [];
    for (let i = index; i < text.length; i++) {
        let char = text.charAt(i);
        if (bracketUtil.isQuoteBracket(char) && bracketStack.length == 0) {
            return new SearchResult(char, i);
        }
        if (bracketUtil.isCloseBracket(char)) {
            if (bracketStack.length == 0) {
                return new SearchResult(char, i);
            } else {
                let top = bracketStack.pop();
                if (!bracketUtil.isMatch(top, char)) {
                    throw 'Unmatched bracket pair'
                }
            }
        } else if (bracketUtil.isOpenBracket(char)) {
            bracketStack.push(char);
        }
    }
    return null;
}

function showInfo(msg: string): void {
    vscode.window.showInformationMessage(msg);
}

function getSearchContext(selection: vscode.Selection) {
    const editor = vscode.window.activeTextEditor;
    let selectionStart = editor.document.offsetAt(selection.start);
    let selectionEnd = editor.document.offsetAt(selection.end);
    return {
        backwardStarter: selectionStart - 1, //coverage vscode selection index to text index
        forwardStarter: selectionEnd,
        text: editor.document.getText()
    }
}

function toVscodeSelection({ start, end }: { start: number, end: number }): vscode.Selection {
    const editor = vscode.window.activeTextEditor;
    return new vscode.Selection(
        editor.document.positionAt(start + 1), //convert text index to vs selection index
        editor.document.positionAt(end)
    );
}

function isMatch(r1: SearchResult, r2: SearchResult) {
    return r1 != null && r2 != null && bracketUtil.isMatch(r1.bracket, r2.bracket);
}

function expandSelection(includeBrack: boolean) {
    const editor = vscode.window.activeTextEditor;

    editor.selections = editor.selections.map((originSelection) => {
        const newSelect = selectText(includeBrack, originSelection)
        return newSelect ? toVscodeSelection(newSelect) : originSelection
    })
}

function selectText(includeBrack: boolean, selection: vscode.Selection): { start: number, end: number } | void {
    const fenced = selectInFencedBlock(includeBrack, selection);
    if (fenced) {
        return fenced;
    }

    const { text, backwardStarter, forwardStarter } = getSearchContext(selection);
    if (backwardStarter < 0 || forwardStarter >= text.length) {
        return;
    }
    const pair = findBracketPair(includeBrack, text, backwardStarter, forwardStarter);
    if (!pair) {
        showInfo('No matched bracket pairs found')
    }
    return pair;
}

// If the selection is inside a fenced code block (``` or ~~~), search for brackets only within
// its content and fall back to selecting the content. If the content is already selected, select
// the whole block including the fences.
function selectInFencedBlock(includeBrack: boolean, selection: vscode.Selection): { start: number, end: number } | undefined {
    const document = vscode.window.activeTextEditor.document;
    const lines = document.getText().split(/\r?\n/);
    let endLine = selection.end.line;
    if (selection.end.character == 0 && endLine > selection.start.line) {
        endLine--; // whole lines are selected
    }
    const block = fenceUtil.findBlock(lines, selection.start.line, endLine);
    if (!block) {
        return;
    }

    const content = new vscode.Range(block.openLine + 1, 0, block.closeLine - 1, lines[block.closeLine - 1].length);
    const whole = new vscode.Range(block.openLine, 0, block.closeLine, lines[block.closeLine].length);
    if (!selection.contains(content)) {
        const contentStart = document.offsetAt(content.start);
        try {
            const pair = findBracketPair(includeBrack, document.getText(content),
                document.offsetAt(selection.start) - contentStart - 1,
                document.offsetAt(selection.end) - contentStart);
            if (pair) {
                return { start: pair.start + contentStart, end: pair.end + contentStart };
            }
        } catch (e) {
            // unmatched brackets inside the block, select the block instead
        }
    }
    const range = includeBrack || selection.contains(content) ? whole : content;
    return {
        start: document.offsetAt(range.start) - 1, //convert to text index like the bracket search does
        end: document.offsetAt(range.end),
    };
}

function findBracketPair(includeBrack: boolean, text: string, backwardStarter: number, forwardStarter: number): { start: number, end: number } | undefined {
    if (backwardStarter < 0 || forwardStarter >= text.length) {
        return;
    }

    let selectionStart: number, selectionEnd: number;
    var backwardResult = findBackward(text, backwardStarter);
    var forwardResult = findForward(text, forwardStarter);

    while (forwardResult != null
        && !isMatch(backwardResult, forwardResult)
        && bracketUtil.isQuoteBracket(forwardResult.bracket)) {
        forwardResult = findForward(text, forwardResult.offset + 1);
    }
    while (backwardResult != null
        && !isMatch(backwardResult, forwardResult)
        && bracketUtil.isQuoteBracket(backwardResult.bracket)) {
        backwardResult = findBackward(text, backwardResult.offset - 1);
    }

    if (!isMatch(backwardResult, forwardResult)) {
        return;
    }
    // we are next to a bracket
    // this is the case for doule press select
    if (backwardStarter == backwardResult.offset && forwardResult.offset == forwardStarter) {
        selectionStart = backwardStarter - 1;
        selectionEnd = forwardStarter + 1;
    } else {
        if (includeBrack) {
            selectionStart = backwardResult.offset - 1;
            selectionEnd = forwardResult.offset + 1;
        } else {
            selectionStart = backwardResult.offset;
            selectionEnd = forwardResult.offset;
        }
    }
    return {
        start: selectionStart,
        end: selectionEnd,
    }
}

//Main extension point
export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('bracket-select.select', function () {
            expandSelection(false);
        }),
        vscode.commands.registerCommand('bracket-select.select-include', function () {
            expandSelection(true);
        })
    );
}

// this method is called when your extension is deactivated
export function deactivate() {
}
