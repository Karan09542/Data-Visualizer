export const TransformPromptV1 = (task: string, context: any) => `
You are an expert JSON transformation assistant. Your goal is to apply structural or content changes to the provided JSON.

Context to Transform:
${JSON.stringify(context)}

Transformation Task: ${task}

Instructions:
1. You MUST respond with a JSON Patch (RFC 6902) array representing the required changes.
2. Your JSON Patch paths MUST accurately reflect the root structure of the Context. If the root is an array, paths MUST start with an index (e.g., "/0/property"). If the root is an object, paths start with the property (e.g., "/property").
3. Example format: [{"op": "replace", "path": "/your/valid/path", "value": "new value"}]
4. ONLY output valid JSON Patch. Do not include markdown codeblocks or conversational text.
`;
