import * as fs from 'graceful-fs'
import thenify = require('thenify')
import stripBom = require('strip-bom')
import parseJson = require('parse-json')
import popsicle = require('popsicle')
import popsicleCache = require('popsicle-cache')
import popsicleStatus = require('popsicle-status')
import detectIndent = require('detect-indent')
import sortKeys = require('sort-keys')
import mdp = require('mkdirp')
import uniq = require('array-uniq')
import rmrf = require('rimraf')
import { join, dirname } from 'path'
import { TSD_FILE, TSD_TYPINGS_DIR } from './config'
import { isHttp } from './path'
import { parseReferences, stringifyReferences } from './references'
import { TsdJson } from '../interfaces/tsd'

// Create a file cache for popsicle.
const FILE_CACHE = popsicleCache()

export let Stats: fs.Stats

export const stat = thenify(fs.stat)
export const readFile = thenify<string, string, string>(fs.readFile)
export const writeFile = thenify<string, string | Buffer, void>(fs.writeFile)
export const mkdirp = thenify<string, void>(mdp)
export const rimraf = thenify<string, void>(rmrf)

export function isFile (path: string): Promise<boolean> {
  return stat(path).then(stat => stat.isFile(), () => false)
}

export function readJson (path: string): Promise<any> {
  return readFile(path, 'utf8')
    .then(stripBom)
    .then(contents => parseJson(contents, null, path))
}

export function writeJson (path: string, json: any, indent: string | number = 2) {
  return writeFile(path, JSON.stringify(json, null, indent))
}

export function readTsd (path: string): Promise<TsdJson> {
  return readJson(path)
}

export function readTsdFrom (path: string): Promise<TsdJson> {
  return readJsonFrom(path) // TODO: Provide more insightful issues with TSD file reading.
}

export function writeTsd (path: string, tsd: TsdJson, indent: string | number = 2) {
  return writeJson(path, tsd, indent) // TODO: Make modifications to standardise JSON (sort dependencies, etc.)
}

export function readHttp (url: string): Promise<string> {
  return popsicle(url)
    .then(FILE_CACHE)
    .then(popsicleStatus())
    .then(x => x.body)
}

export function readFileFrom (from: string): Promise<string> {
  return isHttp(from) ? readHttp(from) : readFile(from, 'utf8')
}

export function readJsonFrom (from: string): Promise<any> {
  return readFileFrom(from)
    .then(stripBom)
    .then(contents => parseJson(contents, null, from))
}

export function parseTsd (contents: string, src: string) {
  return parseJson(contents, null, src)
}

export function transformTsd (cwd: string, transform: (tsdJson: TsdJson) => TsdJson) {
  const src = join(cwd, TSD_FILE)

  function handle (tsd: TsdJson, indent?: number | string) {
    return Promise.resolve(transform(tsd))
      .then(tsd => {
        if (tsd.dependencies) {
          tsd.dependencies = sortKeys(tsd.dependencies)
        }

        if (tsd.devDependencies) {
          tsd.devDependencies = sortKeys(tsd.devDependencies)
        }

        if (tsd.ambientDependencies) {
          tsd.ambientDependencies = sortKeys(tsd.ambientDependencies)
        }

        return tsd
      })
      .then(json => writeJson(src, json, indent || 2))
  }

  return readFile(src, 'utf8')
    .then(
      contents => {
        const tsd: TsdJson = parseTsd(contents, src)
        const indent = detectIndent(contents).indent

        return handle(tsd, indent)
      },
      () => handle({})
    )
}

export function transformTsdDts (path: string, transform: (typings: string[]) => string[]) {
  const cwd = dirname(path)

  function handle (typings: string[]) {
    return Promise.resolve(transform(typings))
      .then(typings => stringifyReferences(uniq(typings).sort(), cwd))
      .then(contents => writeFile(path, contents))
  }

  return readFile(path, 'utf8')
    .then(
      (contents) => handle(parseReferences(contents, cwd)),
      () => handle([])
    )
}

export interface DefinitionOptions {
  cwd: string
}

export function writeDependency (name: string, contents: { main: string; browser: string }, options: DefinitionOptions): Promise<boolean> {
  const typingsDir = join(options.cwd, TSD_TYPINGS_DIR)
  const path = join(typingsDir, name)

  const mainFile = join(path, name + '.d.ts')
  const browserFile = join(path, name + '.browser.d.ts')

  return mkdirp(path)
    .then(() => {
      return Promise.all([
        writeFile(mainFile, contents.main),
        writeFile(browserFile, contents.browser)
      ])
    })
    .then(() => {
      return Promise.all([
        transformTsdDts(join(typingsDir, 'tsd.d.ts'), typings => typings.concat([mainFile])),
        transformTsdDts(join(typingsDir, 'tsd.browser.d.ts'), typings => typings.concat([browserFile]))
      ])
    })
    .then(() => undefined)
}

export function removeDependency (name: string, options: DefinitionOptions) {
  const typingsDir = join(options.cwd, TSD_TYPINGS_DIR)
  const path = join(typingsDir, name)

  const mainFile = join(path, name + '.d.ts')
  const browserFile = join(path, name + '.browser.d.ts')

  return rimraf(path)
    .then(() => {
      return Promise.all([
        transformTsdDts(join(typingsDir, 'tsd.d.ts'), typings => typings.filter(x => x !== mainFile)),
        transformTsdDts(join(typingsDir, 'tsd.browser.d.ts'), typings => typings.filter(x => x !== browserFile))
      ])
    })
    .then(() => undefined)
}
