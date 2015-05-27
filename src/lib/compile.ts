import * as ts from 'typescript'
import Promise = require('native-or-bluebird')
import extend = require('xtend')
import zipObject = require('zip-object')
import partial = require('util-partial')
import { EOL } from 'os'
import { extname, dirname, join, basename, isAbsolute, relative } from 'path'
import { DependencyTree, DependencyBranch, Browser, Overrides } from '../interfaces/tsd'
import { readFile } from '../utils/fs'
import { isDefinition, resolveFrom } from '../utils/path'

/**
 * Maintain a map of resolved files to avoid duplicates in declaration output.
 */
interface ResolvedFilesMap {
  [filename: string]: boolean
}

/**
 * Compile a dependency tree with a root name.
 */
export default function compile (tree: DependencyTree, name: string) {
  return Promise.all([
    compileDependency(tree, name, false),
    compileDependency(tree, name, true)
  ])
    .then(([main, browser]) => ({ main, browser }))
}

/**
 * Compile a dependency using recursion.
 */
function compileDependency (tree: DependencyTree, name: string, isBrowser: boolean): Promise<string> {
  if (!tree) {
    return Promise.reject(new TypeError(`Dependency tree missing for ${name}`))
  }

  let main = typeof tree.typings === 'string' ? tree.typings : tree.main
  let overrides: Overrides = {}

  if (isBrowser && tree.browser) {
    if (typeof tree.browser === 'string') {
      main = <string> tree.browser
    } else {
      overrides = <Overrides> tree.browser
    }
  }

  const dependencies = extend(tree.devDependencies, tree.dependencies)

  // TODO: Support a `tsd` field with "config", "browser" and "main" overrides.

  if (!main) {
    return Promise.resolve(undefined)
  }

  return compileDependencyDeclaration(
    tree,
    name,
    resolveFrom(tree.src, normalizePath(main)),
    overrides,
    dependencies,
    isBrowser
  )
}

/**
 * Compile a single declaration file for a dependency.
 */
function compileDependencyDeclaration (
  tree: DependencyTree,
  name: string,
  path: string,
  overrides: Overrides,
  dependencies: DependencyBranch,
  isBrowser: boolean
): Promise<string> {
  // Skip modules that are unknown.
  if (path == null) {
    return Promise.resolve(undefined)
  }

  const files: ResolvedFilesMap = {}

  return compileDeclaration(tree, name, path, files, overrides, dependencies, isBrowser, true)
}

/**
 * Compile a declaration file from a path.
 */
function compileDeclaration (
  tree: DependencyTree,
  name: string,
  path: string,
  files: ResolvedFilesMap,
  overrides: Overrides,
  dependencies: DependencyBranch,
  isBrowser: boolean,
  isRoot = false
): Promise<string> {
  return readFile(path, 'utf8')
    .then(function (contents) {
      const info = ts.preProcessFile(contents)

      // Resolve references and imports, then load all files that haven't been
      // imported previously to avoid duplicate declarations.
      const resolveImports = info.referencedFiles
        .map(reference => resolveFrom(path, reference.fileName))
        .concat(
          info.importedFiles.map((reference) => {
            if (isModuleName(reference.fileName)) {
              return reference.fileName
            }

            return resolveFrom(path, toDts(reference.fileName))
          })
        )
        .filter(x => !files[x])
        .map(function (path) {
          files[path] = true

          if (isModuleName(path)) {
            const dependency = dependencies[path]

            return compileDependency(dependency, path, isBrowser)
              .then(contents => generateDeclaration(name, path, contents, false))
          }

          return compileDeclaration(tree, name, path, files, overrides, dependencies, isBrowser)
        })

      return Promise.all(resolveImports)
        .then(function (imports) {
          const moduleName = normalizeSlashes(fromDts(relative(dirname(tree.src), path)))
          const declaration = generateDeclaration(name, moduleName, contents, true, isRoot)
          const importedDeclarations = imports.join(EOL)

          if (importedDeclarations) {
            return importedDeclarations + EOL + declaration
          }

          return declaration
        })
    })
}

/**
 * Make sure a file is `*.d.ts`.
 */
function toDts (path: string) {
  return /(?:\.d)?\.ts$/.test(path) ? path : path + '.d.ts'
}

/**
 * Transform a `.d.ts` file into a proper declaration file.
 */
function generateDeclaration (
  name: string,
  moduleName: string,
  contents: string,
  declareModule: boolean,
  isRoot = false
): string {
  // TODO: Look at adding configurable target.
  const sourceFile = ts.createSourceFile(moduleName, contents, ts.ScriptTarget.Latest)
  const isDeclared = !(<any> sourceFile).externalModuleIndicator
  const output = writeDeclaration(name, moduleName, sourceFile, declareModule, isDeclared)

  if (isRoot && !isDeclared) {
    const mainPath = `${name}/${moduleName}`
    const declaration = `declare module '${name}' {${EOL}export * from '${mainPath}';${EOL}}`

    return output ? `${output}${EOL}${declaration}` : declaration
  }

  return output
}

/**
 * Process a source file tree.
 *
 * Source: https://github.com/SitePen/dts-generator/blob/master/index.ts
 */
function processTree (sourceFile: ts.SourceFile, replacer: (node: ts.Node, parent?: ts.Node) => string): string {
  let code = ''
  var cursorPosition = 0

  function skip (node: ts.Node) {
    cursorPosition = node.end
  }

  function readThrough (node: ts.Node) {
    code += sourceFile.text.slice(cursorPosition, node.pos)
    cursorPosition = node.pos
  }

  function visit(node: ts.Node, parent?: ts.Node) {
    readThrough(node)

    var replacement = replacer(node, parent)

    if (replacement != null) {
      code += replacement
      skip(node)
    } else {
      ts.forEachChild(node, x => visit(x, node))
    }
  }

  visit(sourceFile)

  code += sourceFile.text.slice(cursorPosition)

  return code
}

/**
 * Write a declaration string.
 */
function writeDeclaration (
  name: string,
  moduleName: string,
  sourceFile: ts.SourceFile,
  declareModule: boolean,
  isDeclared: boolean
) {
  if (!isDeclared) {
    return [
      `declare module '${name}/${moduleName}' {`,
      processTree(sourceFile, function (node, parent) {
        // Namespace imports using `!` against the current name.
        if (
          node.kind === ts.SyntaxKind.StringLiteral &&
          (
            parent.kind === ts.SyntaxKind.ExportDeclaration ||
            parent.kind === ts.SyntaxKind.ImportDeclaration
          )
        ) {
          const text = (<any> node).text

          if (isModuleName(text)) {
            return ` '${name}!${text}'`
          }

          return ` '${name}/${join(dirname(moduleName), text)}'`
        }

        // Remove all `declare` keywords from definition.
        if (node.kind === ts.SyntaxKind.DeclareKeyword) {
          return ''
        }
      }).trim(),
      '}'
    ].join(EOL)
  }

  return processTree(sourceFile, function (node, parent) {
    // Namespace module declarations using `!` against the current name.
    if (
      node.kind === ts.SyntaxKind.StringLiteral &&
      (
        parent.kind === ts.SyntaxKind.ModuleDeclaration ||
        parent.kind === ts.SyntaxKind.ExportDeclaration
      )
    ) {
      const text = (<any> node).text

      if (declareModule) {
        return ` '${text.replace(/^[^\/\\!]+/, name)}'`
      }

      return ` '${name}!${text}'`
    }
  }).trim()
}

/**
 * Check if an import is from a module.
 */
function isModuleName (fileName: string) {
  return fileName.charAt(0) !== '.' && !isAbsolute(fileName)
}

/**
 * Normalize potential `.js` paths to `.d.ts`.
 */
function normalizePath (fileName: string) {
  return fileName.replace(/\.js$|\.d\.ts$/, '') + '.d.ts'
}

/**
 * Denormalize `.d.ts` files to `.js`.
 */
function denormalizePath (fileName: string) {
  return fileName.replace(/\.d\.ts$|\.js$/, '') + '.js'
}

/**
 * Remove the `.d.ts` extension from the filename.
 */
function fromDts (fileName: string) {
  return fileName.replace(/\.d\.ts$/, '')
}

/**
 * Normalize Windows paths to Unix paths.
 */
function normalizeSlashes (path: string) {
  return path.replace(/\\/g, '/')
}
