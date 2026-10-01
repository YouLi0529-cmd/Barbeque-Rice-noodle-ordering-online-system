const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const source = fs.readFileSync(path.join(__dirname, '../miniprogram/packages/admin/pages/admin/printer/printer.js'), 'utf8')
const messages = []
let pageDefinition
let storedTemplate
let legacyBackend = false
let staleRead = false

const copy = value => JSON.parse(JSON.stringify(value))
const apiClient = {
  async call(action, payload = {}) {
    if (action === 'admin.print.templates.save') {
      storedTemplate = copy(payload.template)
      if (legacyBackend) storedTemplate.fields.forEach(field => { delete field.content })
      return { success: true, data: copy(storedTemplate) }
    }
    if (action === 'admin.print.templates.list') {
      const result = copy(storedTemplate)
      if (staleRead) result.fields.forEach(field => { delete field.content })
      return { success: true, data: [result] }
    }
    throw new Error(`unexpected action: ${action}`)
  }
}

vm.runInNewContext(source, {
  require: name => name.includes('apiClient') ? apiClient : { playClick() {} },
  Page: definition => { pageDefinition = definition },
  wx: {
    showToast: options => messages.push(options.title),
    showModal: options => messages.push(`${options.title}：${options.content}`)
  },
  console
}, { filename: 'printer.js' })

function makePage(template) {
  const page = { ...pageDefinition, data: copy(pageDefinition.data) }
  page.data.printers = []
  page.setData = updates => Object.entries(updates).forEach(([path, value]) => {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.')
    let target = page.data
    parts.slice(0, -1).forEach(part => { target = target[part] })
    target[parts[parts.length - 1]] = value
  })
  page.selectTemplate(template._id, [template])
  return page
}

async function run() {
  const template = {
    _id: 'template-1', ticketType: 'customer_order', name: '客单', paperWidth: 58,
    bindScope: 'global', stationId: '', printerId: '',
    fields: [
      { id: 'title', key: 'title', label: '票据名称', size: 'normal', align: 'left', color: 'black' },
      { id: 'shop', key: 'shopName', label: '店铺名称', size: 'normal', align: 'left', color: 'black' },
      { id: 'dishes', key: 'dishes', label: '菜品明细', size: 'normal', align: 'left', color: 'black' }
    ]
  }
  storedTemplate = copy(template)
  const page = makePage(template)
  assert.strictEqual(page.data.previewFields[1].isPlaceholder, true)
  assert.ok(page.data.fieldLibrary.some(field => field.key === 'totalPrice'))

  page.onTemplateFieldContentInput({ currentTarget: { dataset: { index: 1 } }, detail: { value: '张南烤肉' } })
  await page.saveTemplate()
  assert.strictEqual(storedTemplate.fields[1].content, '张南烤肉')
  assert.strictEqual(page.data.editTemplate.fields[1].content, '张南烤肉')
  assert.strictEqual(page.data.previewFields[1].text, '张南烤肉')
  assert.strictEqual(messages.pop(), '票据模板已保存')

  legacyBackend = true
  page.onTemplateFieldContentInput({ currentTarget: { dataset: { index: 1 } }, detail: { value: '新的店名' } })
  await page.saveTemplate()
  assert.strictEqual(page.data.editTemplate.fields[1].content, '新的店名')
  const legacyWarning = messages.pop()
  assert.ok(legacyWarning.includes('票据样式未完整保存'))
  assert.ok(legacyWarning.includes('店铺名称」的打印文字未保存'))

  legacyBackend = false
  staleRead = true
  page.onTemplateFieldContentInput({ currentTarget: { dataset: { index: 1 } }, detail: { value: '再次修改店名' } })
  await page.saveTemplate()
  assert.strictEqual(page.data.editTemplate.fields[1].content, '再次修改店名')
  assert.ok(messages.pop().includes('重新读取云端'))

  const kitchen = { ...copy(template), _id: 'kitchen-1', ticketType: 'kitchen_order' }
  page.selectTemplate(kitchen._id, [kitchen])
  assert.ok(!page.data.fieldLibrary.some(field => field.key === 'totalPrice'))
  assert.ok(!page.data.fieldLibrary.some(field => field.key === 'orderAmount'))
  const dishesIndex = page.data.editTemplate.fields.findIndex(field => field.key === 'dishes')
  page.data.selectedTemplateFieldIndex = dishesIndex
  assert.strictEqual(page.data.previewFields[dishesIndex].isKitchenDishTable, true)
  assert.strictEqual(page.data.previewFields[dishesIndex].kitchenPreviewRows[1].count, '1\u4efd')
  assert.strictEqual(page.data.previewFields[dishesIndex].kitchenPreviewSubs.length, 2)
  assert.strictEqual(page.data.previewFields[dishesIndex].dishPreviewRows[1].size, 'normal')
  page.onTemplateFieldPicker({ currentTarget: { dataset: { key: 'specificationSize', options: 'sizeOptions' } }, detail: { value: 0 } })
  page.onTemplateFieldPicker({ currentTarget: { dataset: { key: 'remarkSize', options: 'sizeOptions' } }, detail: { value: 3 } })
  assert.strictEqual(page.data.editTemplate.fields[dishesIndex].specificationSize, 'xxxlarge')
  assert.strictEqual(page.data.editTemplate.fields[dishesIndex].remarkSize, 'large')
  assert.strictEqual(page.data.previewFields[dishesIndex].dishPreviewRows[1].size, 'xxxlarge')
  assert.strictEqual(page.data.previewFields[dishesIndex].dishPreviewRows[2].size, 'large')
  console.log('printer template editor tests passed')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
