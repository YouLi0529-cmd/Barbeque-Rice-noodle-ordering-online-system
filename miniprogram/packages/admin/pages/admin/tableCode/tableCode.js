const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'tableCode',
  title: '\u684c\u7801\u7ba1\u7406',
  titleKey: 'tableNumber',
  subtitleKey: 'scene',
  statusKey: 'status',
  orderBy: 'sort',
  order: 'asc',
  fields: [
    { key: 'tableNumber', label: '\u684c\u53f7', type: 'text', required: true },
    { key: 'scene', label: '\u573a\u666f', type: 'text' },
    { key: 'qrCodeUrl', label: '\u4e8c\u7ef4\u7801', type: 'text' },
    { key: 'status', label: '\u542f\u7528', type: 'switch', defaultValue: true },
    { key: 'sort', label: '\u6392\u5e8f', type: 'number', defaultValue: 0 }
  ],
  listFields: ['scene', 'qrCodeUrl', 'status', 'sort'],
  actions: [
    { label: '\u542f\u7528', field: 'status', value: true },
    { label: '\u7981\u7528', field: 'status', value: false }
  ]
}))