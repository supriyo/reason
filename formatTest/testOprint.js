/* Copyright (c) 2015-present, Facebook, Inc. All rights reserved. */

/**
 * Test our outcome printer!
 *
 * For information on what that is, check out the comment at the top of `reason_oprint.ml`.
 *
 * What we're doing here is:
 * -> run `testOprint` on a test file, which then prints out the signature of that file using our outcome printer
 * -> try to parse what we printed with normal refmt.
 *
 * If our outcome printer prints something that's no longer valid syntax, we error!
 */

const {exec, spawn} = require('child_process')
const {promisify} = require('util')
const execPromise = promisify(exec)

const fs = require('fs')
const path = require('path')
const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)

const binary = path.join(__dirname, '..', '_build', 'install', 'default', 'bin', 'testOprint');
const refmt = path.join(__dirname, '..', '_build', 'install', 'default', 'bin', 'refmt');

const outcomePrint = async (sourceFile) => {
  let result
  let error
  const {stdout, stderr} = await execPromise(`cat ${sourceFile} | ${binary}`)
  if (stderr) {
    error = `UNEXPECTED STDERR:\n\n${stderr}\n\nSTDOUT:\n\n${stdout}`
  } else {
    result = stdout
  }
  return {result, error}
}

const refmtInterface = (sourceFile) => {
  const cmd = `ocamlc -pp '${refmt} --print binary' -i -impl ${sourceFile} | ${refmt} --parse ml -i true --print re`
  return execPromise(cmd)
}

const checkResult = (text) => new Promise((res, rej) => {
  const proc = spawn(refmt, ['--parse', 're', '-i', 'true', '--print', 're'])

  let stdout = ''
  let stderr = ''

  proc.on('close', code => {
    res({stdout, stderr, code})
  })

  proc.stdout.on('data', data => stdout += data.toString('utf8'))
  proc.stderr.on('data', data => stderr += data.toString('utf8'))

  proc.stdin.write(text)
  proc.stdin.end()
})

const prom = fn => new Promise((res, rej) => fn((err, val) => err ? rej(err) : res(val)))
const base = path.join(__dirname, 'oprintTests')
const files = fs.readdirSync(base)

const main = async () => {
  const inputFiles = files.filter(name => name.endsWith('.re'))
  const results = await Promise.all(inputFiles.map(async name => {
    const fullPath = path.join(base, name)

    const {result, error} = await outcomePrint(fullPath)

    if (error) {
      return `Printing failure ${name}:\n\n${error}`
    }

    // return `Result: ${result}`;
    
    const {stdout, stderr, code} = await checkResult(result)

    if (code !== 0) {
      let {stdout: refmtOut, stderr: refmtErr} = await refmtInterface(fullPath)
      return `Output printed for the signature of "${name}" not parseable:

## Refmt's error:

${stderr.trim()}

## Outcome printed:

${result}

## Refmt's interface printed:

${refmtOut.trim()}
${refmtErr.trim()}`
    }
  }))
  const total = results.reduce((total, error) => {
    if (error) console.log(error)
    return error ? total + 1 : total
  }, 0)
  console.log(`Done! ${total} failures`)
  return total
}

main().catch(err => {
  console.error('Test script failed!')
  console.error(err)
  try {
    fs.unlinkSync('./TestTest.cmi')
  } catch (_) {}
  finally {
    process.exit(1)
  }
}).then(failures => {
  // generated by ocamlc
  fs.unlinkSync('./TestTest.cmi')
  process.exit(failures ? 1 : 0)
})
