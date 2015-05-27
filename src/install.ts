import extend = require('xtend')
import { dirname } from 'path'
import { resolveDependencyString, resolveTsdDependencies } from './lib/dependencies'
import compile from './lib/compile'
import { findProject } from './utils/find'
import { writeDependency, transformTsd } from './utils/fs'
import { DependencyTree } from './interfaces/tsd'

export interface InstallDependencyOptions {
  save?: boolean
  saveDev?: boolean
  saveAmbient?: boolean
  as: string
  cwd: string
}

export interface InstallOptions {
  cwd: string
}

export function install (options: InstallOptions) {
  return resolveTsdDependencies(options)
    .then(tree => {
      const cwd = dirname(tree.src)
      const queue: [string, DependencyTree][] = []

      function addToQueue (deps: { [key: string]: DependencyTree }) {
        for (const key of Object.keys(deps)) {
          queue.push([key, deps[key]])
        }
      }

      addToQueue(tree.dependencies)
      addToQueue(tree.devDependencies)
      addToQueue(tree.ambientDependencies)

      return queue.reduce((p, [name, tree]) => {
        return p.then(() => installDependencyTree(name, tree, { cwd }))
      }, Promise.resolve())
    })
}

export function installDependency (dependency: string, options: InstallDependencyOptions) {
  return findProject(options.cwd)
    .then(
      (cwd) => installTo(dependency, extend(options, { cwd })),
      () => installTo(dependency, options)
    )
}

function installTo (dependency: string, options: InstallDependencyOptions) {
  const name = options.as

  return resolveDependencyString(dependency, options)
    .then(tree => installDependencyTree(name, tree, options))
    .then(() => writeToTsd(dependency, options))
}

function installDependencyTree (name: string, tree: DependencyTree, options: { cwd: string }) {
  return compile(tree, name)
    .then(definition => writeDependency(name, definition, options))
}

function writeToTsd (dependency: string, options: InstallDependencyOptions) {
  if (!options.save && !options.saveDev && !options.saveAmbient) {
    return
  }

  return transformTsd(options.cwd, (tsd) => {
    // Extend different fields depending on the option passed in.
    if (options.save) {
      tsd.dependencies = extend(tsd.dependencies, { [options.as]: dependency })
    } else if (options.saveDev) {
      tsd.dependencies = extend(tsd.devDependencies, { [options.as]: dependency })
    } else if (options.saveAmbient) {
      tsd.dependencies = extend(tsd.ambientDependencies, { [options.as]: dependency })
    }

    return tsd
  })
}
