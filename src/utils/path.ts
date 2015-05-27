import { resolve as resolveUrl } from 'url'
import { resolve, dirname } from 'path'

export function isHttp (url: string) {
  return /^https?\:/i.test(url)
}

export function isDefinition (filename: string): boolean {
  return /\.d\.ts$/.test(filename)
}

export function resolveFrom (from: string, to: string) {
  if (isHttp(to)) {
    return to
  }

  return isHttp(from) ? resolveUrl(from, to) : resolve(dirname(from), to)
}
