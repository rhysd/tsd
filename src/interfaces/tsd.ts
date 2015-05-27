/**
 * A dependency string is a string that maps to a resource. For example,
 * "file:foo/bar" or "npm:typescript".
 */
export type DependencyString = string

/**
 * Override map for file lookups.
 */
export interface Overrides {
  [dependency: string]: string
}

/**
 * Browser field overrides like NPM.
 */
export type Browser = string | Overrides

/**
 * The TSD JSON specification format.
 */
export interface TsdJson {
  name?: string
  main?: string
  browser?: Browser
  ambient?: boolean
  typings?: string
  dependencies?: Dependencies
  devDependencies?: Dependencies
  ambientDependencies?: Dependencies
}

/**
 * The dependencies interface for TSD allows preferencial overrides.
 */
export interface Dependencies {
  [name: string]: DependencyString | DependencyString[]
}

/**
 * The old `tsd.json` specification, pre-1.0.
 */
export interface OldTsdJson {
  version?: string
  repo?: string
  ref?: string
  path?: string
  bundle?: string
  installed?: {
    [path: string]: {
      commit: string
    }
  }
}

/**
 * Parsed dependency specification.
 */
export interface Dependency {
  type: string
  raw: string
  location: string
}

/**
 * Used for generating the structure of a tree.
 */
export interface DependencyTree {
  name?: string
  version?: string
  main?: string
  typings?: string
  browser?: Browser
  parent?: DependencyTree
  type: string
  src: string
  missing: boolean
  ambient: boolean
  dependencies: DependencyBranch
  devDependencies: DependencyBranch
  ambientDependencies: DependencyBranch
}

/**
 * Map of dependency trees.
 */
export interface DependencyBranch {
  [name: string]: DependencyTree
}

/**
 * Export the TSD filename.
 */
export const TSD_FILE = 'tsd.json'
