import test = require('blue-tape')
import { join } from 'path'
import compile from './compile'
import { DependencyTree } from '../interfaces/tsd'

const COMPILE_FIXTURE_DIR = join(__dirname, '__test__/fixtures/compile')

test('compile', t => {
  t.test('compile fixture', t => {
    t.test('compile a definition', t => {
      const root: DependencyTree = {
        type: 'tsd',
        src: __filename,
        missing: false,
        ambient: false,
        typings: '__test__/fixtures/compile/root.d.ts',
        dependencies: {},
        devDependencies: {},
        ambientDependencies: {}
      }

      const a: DependencyTree = {
        type: 'tsd',
        src: __filename,
        missing: false,
        ambient: false,
        main: join(COMPILE_FIXTURE_DIR, 'a'),
        typings: undefined,
        dependencies: {},
        devDependencies: {},
        ambientDependencies: {}
      }

      const renamed: DependencyTree = {
        type: 'tsd',
        src: __filename,
        missing: false,
        ambient: false,
        main: join(COMPILE_FIXTURE_DIR, 'declared'),
        typings: undefined,
        dependencies: {},
        devDependencies: {},
        ambientDependencies: {}
      }

      ;(<any> root).dependencies.a = a
      ;(<any> root).dependencies.renamed = renamed

      return compile(root, 'root')
        .then((result) => {
          t.equal(result.main, [
            'declare module \'root!a/__test__/fixtures/compile/a\' {',
            'export interface ITest {',
            '  foo: string',
            '  bar: boolean',
            '}',
            'export default function (): ITest',
            '}',
            'declare module \'root!a\' {',
            'export * from \'root!a/__test__/fixtures/compile/a\';',
            '}',
            'declare module \'root!renamed\' {',
            '  type x = string;',
            '  export = x;',
            '}',
            'declare module \'root/__test__/fixtures/compile/root-import\' {',
            'export const test: string',
            '}',
            'declare module \'root/__test__/fixtures/compile/root\' {',
            'import a from \'root!a\'',
            'import x from \'root!renamed\'',
            'export * from \'root/__test__/fixtures/compile/root-import\'',
            '}',
            'declare module \'root\' {',
            'export * from \'root/__test__/fixtures/compile/root\';',
            '}'
          ].join('\n'))
        })
    })
  })
})
