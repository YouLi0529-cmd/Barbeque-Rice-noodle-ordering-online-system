const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'outdoorGrill',
  title: '\u70e4\u67b6\u7ba1\u7406',
  titleKey: 'name',
  statusKey: 'status',
  orderBy: 'sort',
  order: 'asc',
  fields: [
    { key: 'name', label: '\u540d\u79f0', type: 'text', required: true },
    { key: 'status', label: '\u72b6\u6001', type: 'text', defaultValue: 'available' },
    { key: 'outdoorPointId', label: '\u573a\u5730', type: 'text', defaultValue: 'main' },
    { key: 'sort', label: '\u6392\u5e8f', type: 'number', defaultValue: 0 }
  ],
  listFields: ['status', 'outdoorPointId', 'sort'],
  actions: [
    { label: '\u53ef\u7528', field: 'status', value: 'available' },
    { label: '\u505c\u7528', field: 'status', value: 'disabled' }
  ]
}))