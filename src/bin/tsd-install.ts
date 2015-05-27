#!/usr/bin/env node

import program = require('commander')
import { install, installDependency } from '../tsd'
import { wrapExecution } from './utils/cli'
import extend = require('xtend')

program
  .option('-S, --save', 'save as a dependency')
  .option('-A, --save-ambient', 'save as an ambient dependency')
  .option('-D, --save-dev', 'save as a development dependency')
  .option('-a, --as [name]', 'save the dependency with a name')
  .parse(process.argv)

interface ArgvOptions {
  save?: boolean
  saveDev?: boolean
  saveAmbient?: boolean
  as: string
}

const opts = extend(<ArgvOptions> program.opts(), { cwd: process.cwd() })

if (!program.args.length) {
  wrapExecution(install(opts))
} else {
  wrapExecution(installDependency(program.args[0], opts))
}
