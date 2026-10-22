const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const targets = [
  {
    name: 'table board',
    file: 'miniprogram/packages/admin/pages/admin/table/table.js',
    start: 'startTableBoardSignalWatch', stop: 'stopTableBoardSignalWatch',
    poll: 'startTableBoardPolling', ready: 'tableBoardSignalReady', watcher: 'tableBoardSignalWatcher'
  },
  {
    name: 'admin info',
    file: 'miniprogram/packages/admin/components/adminInfoCenter/adminInfoCenter.js',
    start: 'startSignalWatch', stop: 'stopSignalWatch',
    poll: 'startPolling', ready: 'signalWatchReady', watcher: 'signalWatcher'
  }
]

function harness(target, options = {}) {
  let definition
  let timerId = 0
  let closes = 0
  let updates = 0
  const timers = new Map()
  const watches = []
  const realtime = {
    getDatabase: () => ({
      collection: () => ({ doc: () => ({ watch(callbacks) {
        const watch = { callbacks, failed: false }
        watches.push(watch)
        if (options.syncFailure) {
          watch.failed = true
          callbacks.onError(new Error('listener init failed'))
        }
        return { close() {
          closes += 1
          // Model the SDK's initWatchFail transition after onError returns.
          if (watch.failed) throw new Error('current state (CLOSED) does not accept initWatchFail')
          if (options.closeFailure) throw new Error('close failed')
          if (options.asyncCloseFailure) return Promise.reject(new Error('async close failed'))
          return Promise.resolve()
        } }
      } }) })
    })
  }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', target.file), 'utf8'), {
    require: name => name.includes('cloudRealtime') ? realtime : {},
    Page: value => { definition = value },
    Component: value => { definition = value.methods },
    console: { warn() {}, error() {}, log() {} },
    wx: {},
    setInterval: callback => { timers.set(++timerId, callback); return timerId },
    clearInterval: id => timers.delete(id)
  }, { filename: target.file })
  const instance = {
    ...definition, data: { enabled: true },
    refreshTableBoard: () => { updates += 1 },
    activate: () => { updates += 1 }
  }
  return {
    instance, timers, watches,
    get closes() { return closes }, get updates() { return updates },
    fail(watch) { watch.failed = true; watch.callbacks.onError(new Error('listener init failed')) }
  }
}

for (const target of targets) {
  test(`${target.name}: failed initialization falls back without closing the failing SDK handle`, () => {
    const h = harness(target)
    h.instance[target.start]()
    h.fail(h.watches[0])
    assert.equal(h.closes, 0)
    assert.equal(h.instance[target.watcher], null)
    assert.equal(h.timers.size, 1)
    h.watches[0].callbacks.onChange()
    assert.equal(h.timers.size, 1)
    assert.equal(h.updates, 0)
    for (const callback of h.timers.values()) callback()
    assert.equal(h.updates, 1)
  })

  test(`${target.name}: successful realtime updates stop fallback polling`, () => {
    const h = harness(target)
    h.instance[target.poll](10000)
    h.instance[target.start]()
    h.watches[0].callbacks.onChange()
    assert.equal(h.instance[target.ready], true)
    assert.equal(h.timers.size, 0)
    assert.equal(h.updates, 1)
  })

  test(`${target.name}: late callbacks after leaving do not restart polling or update UI`, () => {
    const h = harness(target)
    h.instance[target.start]()
    h.instance[target.stop]()
    h.instance[target.stop]()
    assert.equal(h.closes, 1)
    h.fail(h.watches[0])
    h.watches[0].callbacks.onChange()
    assert.equal(h.timers.size, 0)
    assert.equal(h.updates, 0)
  })

  test(`${target.name}: an old listener cannot stop its replacement`, () => {
    const h = harness(target)
    h.instance[target.start]()
    h.instance[target.stop]()
    h.instance[target.start]()
    const replacement = h.instance[target.watcher]
    h.fail(h.watches[0])
    assert.equal(h.instance[target.watcher], replacement)
    h.watches[1].callbacks.onChange()
    assert.equal(h.updates, 1)
    assert.equal(h.timers.size, 0)
  })

  test(`${target.name}: synchronous init failure does not retain a dead watcher`, () => {
    const h = harness(target, { syncFailure: true })
    h.instance[target.start]()
    assert.equal(h.instance[target.watcher], null)
    assert.equal(h.closes, 0)
    assert.equal(h.timers.size, 1)
  })

  test(`${target.name}: synchronous and asynchronous close errors are contained`, async () => {
    for (const options of [{ closeFailure: true }, { asyncCloseFailure: true }]) {
      const h = harness(target, options)
      h.instance[target.start]()
      assert.doesNotThrow(() => h.instance[target.stop]())
      assert.equal(h.instance[target.watcher], null)
      await new Promise(resolve => setImmediate(resolve))
    }
  })
}
