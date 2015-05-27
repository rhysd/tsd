import extend = require('xtend')
import { removeDependency, transformTsd } from './utils/fs'
import { findProject } from './utils/find'

export interface UninstallDependencyOptions {
  save?: boolean
  saveDev?: boolean
  saveAmbient?: boolean
  cwd: string
}

export function uninstallDependency (name: string, options: UninstallDependencyOptions) {
  return findProject(options.cwd)
    .then(
      (cwd) => removeDependency(name, extend(options, { cwd })).then(() => writeToTsd(name, options)),
      () => removeDependency(name, options)
    )
}

function writeToTsd (name: string, options: UninstallDependencyOptions) {
  if (!options.save && !options.saveDev && !options.saveAmbient) {
    return
  }

  return transformTsd(options.cwd, tsd => {
    if (options.save && tsd.dependencies) {
      delete tsd.dependencies[name]
    }

    if (options.saveDev && tsd.devDependencies) {
      delete tsd.devDependencies[name]
    }

    if (options.saveAmbient && tsd.ambientDependencies) {
      delete tsd.ambientDependencies
    }

    return tsd
  })
}
