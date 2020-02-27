'use strict';
const common = require('../common');
const assert = require('assert');
const child_process = require('child_process');

// Test that workers fail with meaningful error message
// when their initialization fails.

if (common.isWindows) {
  common.skip('ulimit does not work on Windows.');
}

// A reasonably low fd count. An empty node process
// creates around 30 fds for its internal purposes,
// so making it too low will crash the process early,
// making it too high will cause too much resource use.
const OPENFILES = 128;

// Double the open files - so that some workers fail for sure.
const WORKERCOUNT = 256;

if (process.argv[2] === 'child') {
  const { Worker } = require('worker_threads');
  for (let i = 0; i < WORKERCOUNT; ++i) {
    const worker = new Worker(
      'require(\'worker_threads\').parentPort.postMessage(2 + 2)',
      { eval: true });
    worker.on('message', (result) => {
      assert.strictEqual(result, 4);
    });

    // We want to test that if there is an error in a constrained running
    // environment, it will be one of `EMFILE` or `ERR_WORKER_INIT_FAILED`.
    // `common.mustCall*` cannot be used here as in some environments
    // (i.e. single cpu) `ulimit` may not lead to such an error.

    worker.on('error', (e) => {
      assert.match(e.message, /EMFILE/);
      assert.ok(e.code === 'ERR_WORKER_INIT_FAILED' || e.code === 'EMFILE');
    });
  }

} else {
  // Limit the number of open files, to force workers to fail.
  let testCmd = `ulimit -n ${OPENFILES} && `;

  testCmd += `${process.execPath} ${__filename} child`;
  const cp = child_process.exec(testCmd);

  // Turn on the child streams for debugging purposes.
  let stdout = '';
  cp.stdout.on('data', (chunk) => {
    stdout += chunk;
  });
  let stderr = '';
  cp.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  cp.on('exit', common.mustCall((code, signal) => {
    console.log(`child stdout: ${stdout}\n`);
    console.log(`child stderr: ${stderr}\n`);
    assert.strictEqual(code, 0);
    assert.strictEqual(signal, null);
  }));
}
