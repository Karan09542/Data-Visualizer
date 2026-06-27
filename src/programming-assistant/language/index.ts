import { AssistantItem } from "../stores/useAssistantStore";

export const commonSymbols: AssistantItem[] = [
  { id: "sym_tab", label: "Tab", insertText: "\t" },
  { id: "sym_parens", label: "()", insertText: "($0)", isSnippet: true },
  { id: "sym_braces", label: "{}", insertText: "{\n\t$0\n}", isSnippet: true },
  { id: "sym_brackets", label: "[]", insertText: "[$0]", isSnippet: true },
  { id: "sym_single_quote", label: "''", insertText: "'$0'", isSnippet: true },
  { id: "sym_double_quote", label: "\"\"", insertText: "\"$0\"", isSnippet: true },
  { id: "sym_angle", label: "<>", insertText: "<$0>", isSnippet: true },
  { id: "sym_colon", label: ":", insertText: ":" },
  { id: "sym_semi", label: ";", insertText: ";" },
  { id: "sym_comma", label: ",", insertText: "," },
  { id: "sym_dot", label: ".", insertText: "." },
  { id: "sym_eq", label: "=", insertText: " = " },
  { id: "sym_plus", label: "+", insertText: " + " },
  { id: "sym_minus", label: "-", insertText: " - " },
  { id: "sym_mul", label: "*", insertText: " * " },
  { id: "sym_div", label: "/", insertText: " / " },
  { id: "sym_mod", label: "%", insertText: " % " },
  { id: "sym_bang", label: "!", insertText: "!" },
  { id: "sym_question", label: "?", insertText: "?" },
  { id: "sym_amp", label: "&", insertText: "&" },
  { id: "sym_pipe", label: "|", insertText: "|" },
  { id: "sym_caret", label: "^", insertText: "^" },
  { id: "sym_at", label: "@", insertText: "@" },
  { id: "sym_hash", label: "#", insertText: "#" },
  { id: "sym_dollar", label: "$", insertText: "$" },
];

export const getLanguageSnippets = (language: string): Record<string, AssistantItem[]> => {
  if (language === "python") {
    return {
      "Flow Control": [
        { id: "py_if", label: "if", insertText: "if ${1:condition}:\n\t$0", isSnippet: true },
        { id: "py_elif", label: "elif", insertText: "elif ${1:condition}:\n\t$0", isSnippet: true },
        { id: "py_else", label: "else", insertText: "else:\n\t$0", isSnippet: true },
        { id: "py_for", label: "for", insertText: "for ${1:item} in ${2:iterable}:\n\t$0", isSnippet: true },
        { id: "py_while", label: "while", insertText: "while ${1:condition}:\n\t$0", isSnippet: true },
        { id: "py_break", label: "break", insertText: "break" },
        { id: "py_continue", label: "continue", insertText: "continue" },
        { id: "py_return", label: "return", insertText: "return $0", isSnippet: true },
        { id: "py_yield", label: "yield", insertText: "yield $0", isSnippet: true },
        { id: "py_await", label: "await", insertText: "await " },
        { id: "py_async", label: "async", insertText: "async " },
      ],
      "Functions": [
        { id: "py_def", label: "def", insertText: "def ${1:name}(${2:args}):\n\t$0", isSnippet: true },
        { id: "py_class", label: "class", insertText: "class ${1:Name}:\n\tdef __init__(self):\n\t\t$0", isSnippet: true },
        { id: "py_lambda", label: "lambda", insertText: "lambda ${1:x}: $0", isSnippet: true },
        { id: "py_init", label: "__init__", insertText: "def __init__(self${1:args}):\n\t$0", isSnippet: true },
      ],
      "Imports": [
        { id: "py_import", label: "import", insertText: "import " },
        { id: "py_from", label: "from", insertText: "from ${1:module} import ${2:name}", isSnippet: true },
      ],
      "Collections": [
        { id: "py_list", label: "List", insertText: "List[${1:type}]", isSnippet: true },
        { id: "py_dict", label: "Dict", insertText: "Dict[${1:key}, ${2:value}]", isSnippet: true },
        { id: "py_set", label: "Set", insertText: "Set[${1:type}]", isSnippet: true },
        { id: "py_tuple", label: "Tuple", insertText: "Tuple[${1:type}]", isSnippet: true },
      ],
      "Error Handling": [
        { id: "py_try", label: "try", insertText: "try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t$0", isSnippet: true },
        { id: "py_except", label: "except", insertText: "except ${1:Exception} as ${2:e}:\n\t$0", isSnippet: true },
        { id: "py_finally", label: "finally", insertText: "finally:\n\t$0", isSnippet: true },
        { id: "py_raise", label: "raise", insertText: "raise ${1:Exception}($0)", isSnippet: true },
        { id: "py_assert", label: "assert", insertText: "assert ${1:condition}, \"${2:message}\"", isSnippet: true },
      ],
      "Snippets": [
        { id: "py_main", label: "if __main__", insertText: "if __name__ == \"__main__\":\n\t$0", isSnippet: true },
        { id: "py_dataclass", label: "dataclass", insertText: "@dataclass\nclass ${1:Name}:\n\t$0", isSnippet: true },
        { id: "py_with", label: "with", insertText: "with ${1:open(\"file.txt\")} as ${2:f}:\n\t$0", isSnippet: true },
        { id: "py_listcomp", label: "list comp", insertText: "[${1:x} for ${1:x} in ${2:iterable} if ${3:condition}]", isSnippet: true },
      ]
    };
  }
  
  if (language === "javascript" || language === "typescript") {
    return {
      "Flow Control": [
        { id: "js_if", label: "if", insertText: "if (${1:condition}) {\n\t$0\n}", isSnippet: true },
        { id: "js_else", label: "else", insertText: "else {\n\t$0\n}", isSnippet: true },
        { id: "js_switch", label: "switch", insertText: "switch (${1:key}) {\n\tcase ${2:value}:\n\t\t$0\n\t\tbreak;\n\tdefault:\n\t\tbreak;\n}", isSnippet: true },
        { id: "js_for", label: "for", insertText: "for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t$0\n}", isSnippet: true },
        { id: "js_forof", label: "for...of", insertText: "for (const ${1:item} of ${2:iterable}) {\n\t$0\n}", isSnippet: true },
        { id: "js_while", label: "while", insertText: "while (${1:condition}) {\n\t$0\n}", isSnippet: true },
        { id: "js_break", label: "break", insertText: "break;" },
        { id: "js_continue", label: "continue", insertText: "continue;" },
        { id: "js_return", label: "return", insertText: "return $0;", isSnippet: true },
        { id: "js_await", label: "await", insertText: "await " },
      ],
      "Functions": [
        { id: "js_function", label: "function", insertText: "function ${1:name}(${2:args}) {\n\t$0\n}", isSnippet: true },
        { id: "js_arrow", label: "() =>", insertText: "(${1:args}) => {\n\t$0\n}", isSnippet: true },
        { id: "js_async_arrow", label: "async () =>", insertText: "async (${1:args}) => {\n\t$0\n}", isSnippet: true },
        { id: "js_class", label: "class", insertText: "class ${1:Name} {\n\tconstructor(${2:args}) {\n\t\t$0\n\t}\n}", isSnippet: true },
        ...(language === "typescript" ? [
          { id: "ts_interface", label: "interface", insertText: "interface ${1:Name} {\n\t$0\n}", isSnippet: true },
          { id: "ts_type", label: "type", insertText: "type ${1:Name} = $0;", isSnippet: true },
          { id: "ts_enum", label: "enum", insertText: "enum ${1:Name} {\n\t$0\n}", isSnippet: true },
        ] : []),
      ],
      "Imports": [
        { id: "js_import", label: "import", insertText: "import { ${2:module} } from '${1:package}';", isSnippet: true },
        { id: "js_export", label: "export", insertText: "export " },
        { id: "js_export_default", label: "export default", insertText: "export default " },
        { id: "js_require", label: "require", insertText: "const ${1:module} = require('${2:package}');", isSnippet: true },
      ],
      "Collections": [
        { id: "js_map", label: "Map", insertText: "new Map()", isSnippet: true },
        { id: "js_set", label: "Set", insertText: "new Set()", isSnippet: true },
        { id: "js_array", label: "Array", insertText: "[]" },
        { id: "js_object", label: "Object", insertText: "{}" },
      ],
      "Error Handling": [
        { id: "js_try", label: "try/catch", insertText: "try {\n\t$0\n} catch (err) {\n\tconsole.error(err);\n}", isSnippet: true },
        { id: "js_throw", label: "throw", insertText: "throw new Error('${1:message}');", isSnippet: true },
        { id: "js_finally", label: "finally", insertText: "finally {\n\t$0\n}", isSnippet: true },
      ],
      "Snippets": [
        { id: "js_react_fc", label: "React FC", insertText: "export const ${1:Component} = (${2:props}) => {\n\treturn (\n\t\t<div>\n\t\t\t$0\n\t\t</div>\n\t);\n};", isSnippet: true },
        { id: "js_useeffect", label: "useEffect", insertText: "useEffect(() => {\n\t$0\n}, []);", isSnippet: true },
        { id: "js_usestate", label: "useState", insertText: "const [${1:state}, set${1/(.*)/${1:/capitalize}/}] = useState(${2:initial});", isSnippet: true },
        { id: "js_fetch", label: "fetch", insertText: "const res = await fetch('${1:url}');\nconst data = await res.json();\n$0", isSnippet: true },
        { id: "js_promise", label: "Promise", insertText: "new Promise((resolve, reject) => {\n\t$0\n});", isSnippet: true },
        { id: "js_console", label: "console.log", insertText: "console.log($0);", isSnippet: true },
      ]
    };
  }

  // Fallback / default
  return {
    "Flow Control": [
      { id: "def_if", label: "if", insertText: "if (${1:condition}) {\n\t$0\n}", isSnippet: true },
    ]
  };
};
