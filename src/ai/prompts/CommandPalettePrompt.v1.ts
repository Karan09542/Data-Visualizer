export const CommandPalettePromptV1 = (contextData: any, promptToUse: string) => `
Context Document:
${JSON.stringify(contextData, null, 2)}

User Request: ${promptToUse}

IMPORTANT:
If modifying the document, respond with a valid RFC 6902 JSON Patch array enclosed in a \`\`\`json code block. 
Your JSON Patch paths MUST accurately reflect the root structure of the Context Document. 
- If the root is an array, paths MUST start with an index (e.g., "/0/property"). 
- If the root is an object, paths start with the property (e.g., "/property"). 

Example format:
[
  {
    "op": "replace", 
    "path": "/your/valid/path", 
    "value": "new value"
  }
]
`;
