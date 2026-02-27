import { unified } from 'unified';
import type { Plugin } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { visit, EXIT } from 'unist-util-visit';
import type { Root, Text, Heading } from 'mdast';
import { VFile } from 'vfile';
import type { VFileMessage } from 'vfile-message';
import type { Point, Position } from 'unist';

export interface PedagogicalWarning {
    id: string;
    type: 'syntax_error' | 'improvement' | 'structural';
    message: string;
    suggestion?: string; // Opcional si es solo un consejo general
    line: number;
    column: number;
    offset: number;
    length: number;
    originalText: string;
    replacementConfig?: { startOffset: number, endOffset: number, newText: string };
}

export interface ParseResult {
    ast: Root;
    warnings: PedagogicalWarning[];
    html: string;
}

const ABSOLUTE_CLAIM_WARNING =
    'Sugerencia analítica: Evita las afirmaciones absolutas. Considera matizar el argumento para darle mayor rigor.';
const PERSUASIVE_CLICHE_WARNING =
    'Alerta de retórica: Esta frase suena a cliché publicitario. ¿Puedes fundamentar esta afirmación con evidencia?';
const MAX_CRITICAL_WARNINGS = 80;

interface CriticalPattern {
    regex: RegExp;
    message: string;
    ruleId: string;
}

const CRITICAL_PATTERNS: CriticalPattern[] = [
    {
        regex: /\b(siempre|nunca|todo|todos|toda|todas|nada|absolutamente)\b/giu,
        message: ABSOLUTE_CLAIM_WARNING,
        ruleId: 'absolute-claims',
    },
    {
        regex: /\b(el\s+mejor\s+del\s+mercado|la\s+[uú]nica\s+soluci(?:ó|o)n|como\s+por\s+arte\s+de\s+magia)\b/giu,
        message: PERSUASIVE_CLICHE_WARNING,
        ruleId: 'persuasive-cliches',
    },
];

function pointFromRelativeIndex(node: Text, relativeIndex: number): Point | null {
    const start = node.position?.start;
    if (!start) return null;

    const safeIndex = Math.max(0, Math.min(relativeIndex, node.value.length));
    const before = node.value.slice(0, safeIndex);
    const lineBreaks = before.match(/\n/g)?.length ?? 0;
    const line = start.line + lineBreaks;
    const lastLine = before.split('\n').at(-1) ?? '';
    const column = lineBreaks === 0 ? start.column + lastLine.length : 1 + lastLine.length;
    const offset = (start.offset ?? 0) + safeIndex;

    return { line, column, offset };
}

function matchPosition(node: Text, matchStart: number, matchLength: number): Position | undefined {
    const start = pointFromRelativeIndex(node, matchStart);
    const end = pointFromRelativeIndex(node, matchStart + matchLength);
    if (!start || !end) return undefined;
    return { start, end };
}

const remarkCriticalAnalysis: Plugin<[], Root> = () => {
    return (tree, file) => {
        let emittedWarnings = 0;
        const emittedKeys = new Set<string>();

        visit(tree, 'text', (node: Text) => {
            if (emittedWarnings >= MAX_CRITICAL_WARNINGS) {
                return EXIT;
            }

            for (const pattern of CRITICAL_PATTERNS) {
                const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
                for (const match of node.value.matchAll(regex)) {
                    if (emittedWarnings >= MAX_CRITICAL_WARNINGS) {
                        return EXIT;
                    }

                    const matchText = match[0];
                    const matchIndex = match.index ?? 0;
                    const place = matchPosition(node, matchIndex, matchText.length);
                    const line = place?.start.line ?? 0;
                    const dedupeKey = `${pattern.ruleId}:${line}:${matchText.toLowerCase()}`;
                    if (emittedKeys.has(dedupeKey)) {
                        continue;
                    }

                    const message = file.message(
                        pattern.message,
                        place,
                        `remark-critical-analysis:${pattern.ruleId}`
                    );
                    message.source = 'remarkCriticalAnalysis';
                    emittedKeys.add(dedupeKey);
                    emittedWarnings++;
                }
            }
        });
    };
};

function appendCriticalWarnings(
    targetWarnings: PedagogicalWarning[],
    messages: VFileMessage[],
    originalText: string,
    warningCount: number
): number {
    let nextWarningCount = warningCount;
    let appended = 0;

    for (const message of messages) {
        if (appended >= MAX_CRITICAL_WARNINGS) {
            break;
        }

        const start = message.position?.start;
        const end = message.position?.end;
        if (!start || !end) continue;

        const startOffset = start.offset ?? 0;
        const endOffset = end.offset ?? startOffset;
        const normalizedEndOffset = Math.max(endOffset, startOffset + 1);

        targetWarnings.push({
            id: `warn-critical-${nextWarningCount++}`,
            type: 'improvement',
            message: String(message.reason),
            line: start.line,
            column: start.column,
            offset: startOffset,
            length: normalizedEndOffset - startOffset,
            originalText: originalText.slice(startOffset, normalizedEndOffset),
        });
        appended++;
    }

    return nextWarningCount;
}

/**
 * Parsea el texto usando unified y remark,
 * e inspecciona el AST en busca de oportunidades pedagógicas y estructurales.
 */
export async function parseMarkdown(text: string): Promise<ParseResult> {
    const warnings: PedagogicalWarning[] = [];

    // 1. Parseo inicial para obtener el AST
    const analysisProcessor = unified()
        .use(remarkParse)
        .use(remarkCriticalAnalysis);
    const analysisFile = new VFile({ value: text });
    const ast = analysisProcessor.parse(analysisFile) as Root;
    await analysisProcessor.run(ast, analysisFile);

    let warningCount = 0;
    let lastHeaderValue = 0; // Para rastrear la jerarquía (h1 = 1, h2 = 2...)
    let totalWordCount = 0;
    let hasEmphasisNode = false;

    // 2. Traversa del AST (Reglas Estructurales + Sintácticas)
    visit(ast, (node, index, parent) => {

        // --- EVALUACIÓN DE ÉNFASIS (Densidad Visual) ---
        if (node.type === 'strong' || node.type === 'emphasis' || node.type === 'blockquote') {
            hasEmphasisNode = true;
        }

        // --- EVALUACIÓN DE ENCABEZADOS (Jerarquía Rota) ---
        if (node.type === 'heading' && node.position) {
            const headingNode = node as Heading;
            const currentLevel = headingNode.depth;

            if (lastHeaderValue !== 0 && currentLevel > lastHeaderValue + 1) {
                warnings.push({
                    id: `warn-struct-${warningCount++}`,
                    type: 'structural',
                    message: `Has saltado del nivel de título ${lastHeaderValue} al ${currentLevel}. Mantener un orden secuencial (H1 -> H2 -> H3) ayuda a estructurar tus ideas.`,
                    line: node.position.start.line,
                    column: node.position.start.column,
                    offset: node.position.start.offset || 0,
                    length: node.position.end.offset! - node.position.start.offset!,
                    originalText: text.substring(node.position.start.offset || 0, node.position.end.offset || 0),
                });
            }
            lastHeaderValue = currentLevel;
        }

        // --- EVALUACIÓN DE PÁRRAFOS (Muro de texto) ---
        if (node.type === 'paragraph' && node.position) {
            const textContent = text.substring(node.position.start.offset || 0, node.position.end.offset || 0);
            // Estimación muy cruda de palabras usando espacios (suficiente para pedagogía rápida)
            const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;
            totalWordCount += wordCount;

            if (wordCount > 80) {
                warnings.push({
                    id: `warn-struct-${warningCount++}`,
                    type: 'structural',
                    message: `Este párrafo tiene ${wordCount} palabras y parece muy denso ("muro de texto"). Dividir la idea en dos párrafos más cortos facilitará la respiración y comprensión lectora.`,
                    line: node.position.start.line,
                    column: node.position.start.column,
                    offset: node.position.start.offset || 0,
                    length: node.position.end.offset! - node.position.start.offset!,
                    originalText: textContent
                });
            }
        }

        // --- EVALUACIÓN SINTÁCTICA ORIGINIAL ---
        if (node.type === 'text') {
            const textNode = node as Text;
            if (!textNode.position) return;

            const value = textNode.value;
            const startLine = textNode.position.start.line;
            const startOffset = textNode.position.start.offset || 0;

            // Error: Encabezado sin espacio (#Título)
            const headerMatch = value.match(/^(#{1,6})([^\s#].*)/);
            if (parent?.type === 'paragraph' && headerMatch && index === 0) {
                warnings.push({
                    id: `warn-${warningCount++}`,
                    type: 'syntax_error',
                    message: 'Añade un espacio después de los agrupadores de título (#)',
                    suggestion: `${headerMatch[1]} ${headerMatch[2]}`,
                    line: startLine,
                    column: 1,
                    offset: startOffset,
                    length: headerMatch[0].length,
                    originalText: headerMatch[0],
                    replacementConfig: {
                        startOffset: startOffset,
                        endOffset: startOffset + headerMatch[0].length,
                        newText: `${headerMatch[1]} ${headerMatch[2]}`,
                    }
                });
            }

            // Error: Lista sin espacio (-Ítem)
            const listMatch = value.match(/^(-|\*|\+)([\p{L}\p{N}].*)/u);
            if (parent?.type === 'paragraph' && listMatch && index === 0) {
                warnings.push({
                    id: `warn-${warningCount++}`,
                    type: 'syntax_error',
                    message: 'Las listas requieren un espacio después del guion o asterisco.',
                    suggestion: `${listMatch[1]} ${listMatch[2]}`,
                    line: startLine,
                    column: 1,
                    offset: startOffset,
                    length: listMatch[0].length,
                    originalText: listMatch[0],
                    replacementConfig: {
                        startOffset: startOffset,
                        endOffset: startOffset + listMatch[0].length,
                        newText: `${listMatch[1]} ${listMatch[2]}`
                    }
                });
            }
        }
    });

    // --- EVALUACIÓN GLOBAL (Densidad Visual) ---
    if (totalWordCount > 300 && !hasEmphasisNode) {
        // Agregaremos el warning en la primera línea o al inicio.
        // Es una sugerencia macro, no amarrada a un nodo específico.
        warnings.unshift({
            id: `warn-global-${warningCount++}`,
            type: 'improvement',
            message: `Tu texto supera las 300 palabras y no detectamos énfasis visual activo. Intenta utilizar **negritas (**) o *cursivas (*)* para resaltar los conceptos clave y romper la monotonía visual.`,
            line: 1,
            column: 1,
            offset: 0,
            length: Math.min(text.length, 50), // Resalta las primeras palabras
            originalText: text.substring(0, 50)
        });
    }

    // --- ANÁLISIS CRÍTICO (PLUGIN remarkCriticalAnalysis) ---
    warningCount = appendCriticalWarnings(warnings, analysisFile.messages, text, warningCount);

    // --- ONBOARDING PEDAGÓGICO ---
    if (totalWordCount < 5 && text.length > 0 && !text.includes('#') && !text.includes('*') && !text.includes('-')) {
        warnings.push({
            id: `warn-onboarding-${warningCount++}`,
            type: 'improvement',
            message: '¡Bienvenido! Veo que estás empezando. Intenta iniciar tu documento con un Título Principal usando el símbolo de número (#)',
            suggestion: '# ' + text,
            line: 1,
            column: 1,
            offset: 0,
            length: text.length,
            originalText: text,
            replacementConfig: {
                startOffset: 0,
                endOffset: text.length,
                newText: '# ' + text,
            }
        });
    }

    // 3. Generar HTML a la vez para la vista previa en vivo
    const htmlProcessor = unified()
        .use(remarkParse)
        .use(remarkRehype)
        .use(rehypeSanitize, {
            ...defaultSchema,
            protocols: {
                ...defaultSchema.protocols,
                href: ['http', 'https', 'mailto'],
            },
        })
        .use(rehypeStringify);

    const vfile = await htmlProcessor.process(text);
    const html = String(vfile);

    return { ast, warnings, html };
}
