import { expect, it } from "vite-plus/test";
import { resolve } from "node:path";
import ts from "typescript";

it("exposes scoped lint options through the built package export", () => {
  const file = resolve(import.meta.dirname, "lint-consumer.mts");
  const source = `import { check, collectFiles, type CheckOptions, type RuleException } from '@uinaf/design/lint';
const exception: RuleException = { path: 'export-', rules: ['type-scale-only'] };
const options: CheckOptions = { paths: ['src'], except: [exception], relativeTo: process.cwd() };
check(options);
check({ except: [exception] });
check({ relativeTo: process.cwd() });
const files: string[] = collectFiles(['src'], [], process.cwd());
`;
  const options: ts.CompilerOptions = {
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    types: ["node"],
  };
  const host = ts.createCompilerHost(options);
  const readFile = host.readFile.bind(host);
  const fileExists = host.fileExists.bind(host);
  host.readFile = (path) => (path === file ? source : readFile(path));
  host.fileExists = (path) => path === file || fileExists(path);
  const program = ts.createProgram([file], options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => ({
    code: diagnostic.code,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
  }));
  expect(diagnostics).toEqual([]);
});
