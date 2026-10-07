'use strict';

export namespace fenceUtil {
    export interface FencedBlock {
        openLine: number;
        closeLine: number;
    }

    const openingFence = /^\s*(`{3,}|~{3,})(.*)$/;
    const closingFence = /^\s*(`{3,}|~{3,})\s*$/;

    function isOpeningFence(line: string): string | undefined {
        const match = openingFence.exec(line);
        // the info string of a backtick fence can not contain backticks (e.g. ```inline code```)
        if (match && !(match[1][0] === '`' && match[2].indexOf('`') >= 0)) {
            return match[1];
        }
        return undefined;
    }

    function isClosingFence(line: string, fence: string): boolean {
        const match = closingFence.exec(line);
        return match != null && match[1][0] === fence[0] && match[1].length >= fence.length;
    }

    // Find the fenced code block (``` or ~~~) whose content contains all lines from startLine to endLine
    export function findBlock(lines: string[], startLine: number, endLine: number): FencedBlock | undefined {
        let openLine = -1;
        let fence: string | undefined;
        for (let i = 0; i < lines.length; i++) {
            if (fence === undefined) {
                if (i >= startLine) {
                    return undefined;
                }
                fence = isOpeningFence(lines[i]);
                openLine = i;
            } else if (isClosingFence(lines[i], fence)) {
                if (i > endLine) {
                    return { openLine, closeLine: i };
                }
                if (i >= startLine) {
                    return undefined;
                }
                fence = undefined;
            }
        }
        // unclosed block
        return undefined;
    }
}
