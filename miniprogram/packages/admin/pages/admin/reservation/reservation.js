const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'reservation',
  title: '\u9884\u7ea6\u7ba1\u7406',
  titleKey: 'name',
  subtitleKey: 'phone',
  statusKey: 'status',
  orderBy: 'createTime',
  order: 'desc',
  fields: [
    { key: 'name', label: '\u59d3\u540d', type: 'text', required: true },
    { key: 'phone', label: '\u624b\u673a\u53f7', type: 'text' },
    { key: 'peopleCount', label: '\u4eba\u6570', type: 'number' },
    { key: 'reserveTime', label: '\u9884\u7ea6\u65f6\u95f4', type: 'text' },
    { key: 'status', label: '\u72b6\u6001', type: 'text', defaultValue: 'pending' }
  ],
  listFields: ['phone', 'peopleCount', 'reserveTime', 'createTime'],
  actions: [
    { label: '\u786e\u8ba4', field: 'status', value: 'confirmed' },
    { label: '\u5230\u5e97', field: 'status', value: 'arrived' },
    { label: '\u53d6\u6d88', field: 'status', value: 'cancelled' }
  ]
}))