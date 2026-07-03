const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'printer',
  title: '\u6253\u5370\u673a\u7ba1\u7406',
  titleKey: 'name',
  subtitleKey: 'sn',
  statusKey: 'status',
  orderBy: 'createTime',
  order: 'desc',
  fields: [
    { key: 'name', label: '\u540d\u79f0', type: 'text', required: true },
    { key: 'sn', label: '\u7f16\u53f7', type: 'text' },
    { key: 'key', label: '\u5bc6\u94a5', type: 'text' },
    { key: 'status', label: '\u542f\u7528', type: 'switch', defaultValue: true }
  ],
  listFields: ['sn', 'status', 'createTime'],
  actions: [
    { label: '\u542f\u7528', field: 'status', value: true },
    { label: '\u7981\u7528', field: 'status', value: false }
  ]
}))