import fs from 'fs'
import { reduce, template, mapValues, get, isString } from 'lodash'
import { getFile } from '../utils/files'
import { error, info, warn } from '../utils/logger'

const { TRAVIS_BRANCH } = process.env

const tryTemplating = (str, name) => {
  try {
    return template(str)(process.env)
  } catch (err) {
    warn('Issue while creating config:', err.message)
    warn(`Setting "${name}" to an empty string`)
    return ''
  }
}

/**
 * Create config file based on CI environment variables
 * @param {Object} settings - Settings for how environment variables should
 * be copied from Travis-CI to Firebase Functions Config
 * @param {String} settings.path - Path where config file should be written
 * @return {Promise} Resolves with undefined (result of functions config set)
 * @example
 * "ci": {
 *   "createConfig": {
 *     "prod": {
 *        "firebase": {
 *          "apiKey": "${PROD_FIREBASE_API_KEY}"
 *        }
 *     }
 *   }
 * }
 * @private
 */
export default (config) => {
  const settings = getFile('.firebaserc')

  if (!TRAVIS_BRANCH) {
    warn('Not in CI Environment. Defaulting to settings for master branch...')
  }

  if (!settings) {
    error('.firebaserc file is required')
    throw new Error('.firebaserc file is required')
  }

  if (!settings.ci || !settings.ci.createConfig) {
    warn('Create config settings needed in .firebaserc!')
    return
  }

  const opts = {
    path: get(config, 'path', './src/config.js'),
    branch: get(config, 'branch', TRAVIS_BRANCH || 'master')
  }

  info(`Attempting to load config for ${opts.branch}`)
  const { ci: { createConfig } } = settings
  const envConfig = createConfig[opts.branch] || createConfig.default || createConfig.master

  if (!createConfig[opts.branch]) {
    const fallBackConfigName = createConfig.default ? 'default' : 'master'
    info(`${opts.branch} branch does not exist in create config settings, falling back to ${fallBackConfigName}`)
  }

  if (!envConfig) {
    const msg = 'Valid create config settings could not be loaded'
    error(msg)
    throw new Error(msg)
  }

  info(`Creating config file at path: ${opts.path}`)

  // template data based on environment variables
  const templatedData = mapValues(envConfig, (parent, parentName) =>
    isString(parent)
      ? tryTemplating(parent, parentName)
      : mapValues(parent, (data, childKey) => tryTemplating(data, `${parentName}.${childKey}`))
  )
  // convert object into formatted object string
  const parentAsString = (parent) => reduce(parent, (acc, child, childKey) =>
    acc.concat(`  ${childKey}: ${JSON.stringify(child, null, 2)},\n`)
  , '')

  // combine all stringified vars and attach default export
  const exportString = reduce(templatedData, (acc, parent, parentName) =>
    acc.concat(`export const ${parentName} = `)
      .concat(isString(parent) ? `"${parent}";\n\n` : `{\n${parentAsString(parent)}};\n\n`)
  , '').concat(`export default { ${Object.keys(templatedData).join(', ')} }`)

  try {
    fs.writeFileSync(opts.path, exportString, 'utf8')
  } catch (err) {
    error('Error creating config file: ', err)
  }
}
