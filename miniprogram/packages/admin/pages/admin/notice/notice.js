const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'notice',
  title: '\u516c\u544a\u7ba1\u7406',
  titleKey: 'content',
  statusKey: 'status',
  orderBy: 'sort',
  order: 'asc',
  fields: [
    { key: 'content', label: '\u5185\u5bb9', type: 'textarea', required: true, placeholder: '\u8bf7\u8f93\u5165\u516c\u544a\u5185\u5bb9' },
    { key: 'sort', label: '\u6392\u5e8f', type: 'number', defaultValue: 0 },
    { key: 'status', label: '\u72b6\u6001', type: 'number', defaultValue: 1 }
  ],
  listFields: ['content', 'sort', 'status'],
  actions: [
    { label: '\u542f\u7528', field: 'status', value: 1 },
    { label: '\u7981\u7528', field: 'status', value: 0 }
  ]
}))
