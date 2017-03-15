/* deploy commander component
 * To use add require('../cmds/deploy.js')(program) to your commander.js based node executable before program.parse
 */
'use strict'
const deployToFirebase = require('../lib/index')

module.exports = function (program) {
  program
    .command('deploy')
    .version('0.0.0')
    .description('Deploy to Firebase only on build branches (master, stage, prod)')
    .option('-o --only <targets>', 'Only deploy to specified, comma-seperated targets (e.g "hosting, storage")', /^(hosting|functions|small)$/i)
    .action((directory, options) => {
      deployToFirebase(program.args[0], () => {
        process.exit(1)
      })
    })
}