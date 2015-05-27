import logUpdate = require('log-update')
import spinner = require('elegant-spinner')
import chalk = require('chalk')
import promiseFinally from 'promise-finally'

export function wrapExecution (promise: Promise<any>) {
  const frame = spinner()

  const interval = setInterval(() => {
    logUpdate(frame())
  }, 50)

  function end () {
    clearInterval(interval)
    logUpdate.clear()
  }

  return promiseFinally(promise, end)
    .catch((err: Error) => console.log(chalk.red(err.message)))
}
