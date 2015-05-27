#!/usr/bin/env node

import program = require('commander')
// import { init } from '../tsd'

program
  .option('-u, --upgrade', 'upgrade from an older tsd version')
  .parse(process.argv)

interface ArgvOptions {
  upgrade: boolean
}

const opts: ArgvOptions = program.opts()

// init(process.cwd(), opts)
