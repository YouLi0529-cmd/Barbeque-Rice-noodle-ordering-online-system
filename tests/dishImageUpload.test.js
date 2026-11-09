const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync(require.resolve('../miniprogram/packages/admin/pages/admin/dish/dish.js'), 'utf8')
const limit = 300 * 1024
function fixture({ sizes = [100000], failUpload, failCanvas = false, missingCanvas = false, failDecode = false } = {}) {
  let page, picker, upload
  const exports = [], dialogs = [], toasts = [], drawings = []
  const canvas = {
    width: 1, height: 1,
    createImage() {
      const image = { width: 4000, height: 3000 }
      Object.defineProperty(image, 'src', { set() { failDecode ? image.onerror() : image.onload() } })
      return image
    },
    getContext() { return { fillStyle: '', fillRect(...args) { drawings.push({ fill: args, color: this.fillStyle }) },
      drawImage(...args) { drawings.push({ draw: args }) } } }
  }
  const wx = {
    chooseMedia: options => { picker = options },
    cropImage: options => options.success({ tempFilePath: options.src }),
    showLoading() {}, hideLoading() {},
    showToast: value => toasts.push(value), showModal: value => dialogs.push(value),
    createSelectorQuery() { return { in() { return this }, select() { return this }, fields() { return this },
      exec(callback) { callback(missingCanvas ? [] : [{ node: canvas }]) } } },
    canvasToTempFilePath(options) {
      exports.push(options)
      if (failCanvas) options.fail({ errMsg: 'canvasToTempFilePath:fail' })
      else options.success({ tempFilePath: `processed-${exports.length}.jpg` })
    },
    getFileInfo: options => options.success({ size: sizes.length > 1 ? sizes.shift() : sizes[0] }),
    uploadFile(options) {
      upload = options
      if (failUpload) options.fail(failUpload)
      else options.success({ statusCode: 200, data: JSON.stringify({ success: true, data: { fileID: 'cloud://image' } }) })
    }
  }
  vm.runInNewContext(source, { wx, console: { error() {} }, Page: value => { page = value },
    require: name => name.endsWith('apiClient') ? {
      getBaseUrl: () => 'https://example.com/tenantApi', TENANT_ID: 'zhangnan', getAdminAuthToken: () => 'admin'
    } : {} })
  page.data = structuredClone(page.data)
  page.data.currentDish = { _id: 'dish', name: '菜品', image: 'cloud://old' }
  page.data.showDishModal = true
  page.setData = update => Object.assign(page.data, update)
  return { page, exports, dialogs, toasts, drawings, canvas, get upload() { return upload },
    async select(path = 'selected.jpg') {
      page.chooseDishImage()
      await picker.success({ tempFiles: [{ tempFilePath: path, size: 3000000 }] })
    } }
}

test('images already below 300 KiB upload directly without re-encoding', async () => {
  const h = fixture()
  await h.select()
  assert.equal(h.exports.length, 0)
  assert.equal(h.upload.filePath, 'selected.jpg')
  assert.equal(h.page.dishImageUploading, false)
})

test('large JPEG, PNG and WebP images are encoded to JPEG until actual bytes meet the target', async () => {
  for (const ext of ['jpg', 'png', 'webp']) {
    const h = fixture({ sizes: [3000000, 600000, 200000, 200000] })
    await h.select(`selected.${ext}`)
    assert.equal(h.exports.length, 2)
    assert.equal(h.exports[0].quality, 0.85)
    assert.equal(h.exports[1].quality, 0.65)
    assert.equal(h.exports[0].fileType, 'jpg')
    assert.equal(h.exports[0].width, 1280)
    assert.equal(h.exports[0].height, 960)
    assert.equal(h.drawings[0].color, '#FFFFFF')
    assert.equal(h.upload.filePath, 'processed-2.jpg')
    assert.equal(h.canvas.width, 1)
    assert.equal(h.canvas.height, 1)
  }
})

test('size reductions preserve proportions when quality alone does not meet the target', async () => {
  const h = fixture({ sizes: [3000000, 800000, 700000, 250000, 250000] })
  await h.select()
  assert.deepEqual(h.exports.map(value => value.width), [1280, 1280, 960])
  assert.equal(h.exports[2].height, 720)
  assert.equal(h.upload.filePath, 'processed-3.jpg')
})

test('files exactly at the limit are processed and a final oversize file never uploads', async () => {
  const h = fixture({ sizes: [limit, limit, limit - 1, limit - 1] })
  await h.select()
  assert.equal(h.exports.length, 2)
  const rejected = fixture({ sizes: [400000] })
  await rejected.select()
  assert.equal(rejected.exports.length, 6)
  assert.equal(rejected.exports.at(-1).width, 320)
  assert.equal(rejected.upload, undefined)
  assert.match(rejected.dialogs[0].content, /300KB/)
  assert.equal(rejected.page.data.currentDish.image, 'cloud://old')
  assert.equal(rejected.page.dishImageUploading, false)
})

test('canvas, decoding and unknown-size failures never fall back to uploading an unchecked original', async () => {
  for (const options of [{ failCanvas: true }, { missingCanvas: true }, { failDecode: true }]) {
    const h = fixture({ sizes: [3000000], ...options })
    await h.select()
    assert.equal(h.upload, undefined)
    assert.equal(h.dialogs.length, 1)
    assert.equal(h.page.dishImageUploading, false)
  }
  const h = fixture({ sizes: [undefined] })
  await h.select()
  assert.equal(h.upload, undefined)
  assert.match(h.dialogs[0].content, /大小/)
})

test('the measured final upload file is checked again even when preparation returned a small original', async () => {
  const h = fixture({ sizes: [100000, 400000] })
  await h.select()
  assert.equal(h.upload, undefined)
  assert.match(h.dialogs[0].content, /300KB/)
})

test('an upload failure shows the native error and releases the busy flag', async () => {
  const message = 'uploadFile:fail url not in domain list'
  const h = fixture({ failUpload: { errMsg: message } })
  await h.select()
  assert.equal(h.dialogs[0].content, message)
  assert.equal(h.dialogs[0].showCancel, false)
  assert.ok(h.dialogs[0].confirmText.length <= 4)
  assert.equal(h.page.dishImageUploading, false)
})

test('a repeated upload cannot share a canvas already processing another image', async () => {
  const h = fixture()
  h.page.dishImageUploading = true
  await h.page.uploadDishImage('selected.jpg')
  assert.equal(h.exports.length, 0)
  assert.equal(h.upload, undefined)
})
