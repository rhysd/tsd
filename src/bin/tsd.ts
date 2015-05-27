#!/usr/bin/env node

import program = require('commander')

const VERSION = '0.6.0-beta.4'

const ALIASES: { [name: string]: string } = {
  i: 'install',
  in: 'install',
  r: 'uninstall',
  rm: 'uninstall',
  remove: 'uninstall',
  s: 'search',
  p: 'prune',
  pr: 'prune',
  v: 'validate'
}

// HACK: This allows sub-commands to be rewritten with aliases.
program
  .on('*', function () {
    var cmd = program.args[0]
    var index = 0

    if (cmd === 'help') {
      cmd = program.args[1]
      index = 1
    }

    if (ALIASES[cmd]) {
      cmd = program.args[index] = ALIASES[cmd]
    }

    // Output the help text if the command does not exist.
    if (index === 0 && !(<any> program)._execs[cmd]) {
      program.outputHelp()
    }
  })

program
  .version(VERSION)
  .command('install [src]', 'install definitions')
  .command('uninstall [name]', 'remove definitions')
  .command('init', 'initialize a new tsd configuration')
  .command('search [query]', 'search definitely typed for a definition')
  .command('prune', 'remove unused dependencies')
  .command('validate', 'verify the project can be consumed without additional configuration')
  .parse(process.argv)
