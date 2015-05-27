#!/usr/bin/env node

import program = require('commander')
import extend = require('xtend')
import { uninstallDependency } from '../tsd'
import { wrapExecution } from './utils/cli'

program
  .option('-S, --save', 'save as a dependency')
  .option('-A, --save-ambient', 'save as an ambient dependency')
  .option('-D, --save-dev', 'save as a development dependency')
  .parse(process.argv)

interface ArgvOptions {
  save: boolean
  saveDev: boolean
  saveAmbient: boolean
}

const opts = extend(<ArgvOptions> program.opts(), { cwd: process.cwd() })

if (program.args.length) {
  wrapExecution(uninstallDependency(program.args[0], opts))
}
