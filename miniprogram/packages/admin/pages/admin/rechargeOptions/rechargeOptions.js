const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'rechargeOptions',
  title: '\u5145\u503c\u9009\u9879',
  titleKey: 'amount',
  subtitleKey: 'description',
  statusKey: 'status',
  orderBy: 'amount',
  order: 'asc',
  fields: [
    { key: 'amount', label: '\u91d1\u989d', type: 'number', required: true },
    { key: 'giveAmount', label: '\u8d60\u9001', type: 'number', defaultValue: 0 },
    { key: 'description', label: '\u63cf\u8ff0', type: 'textarea' },
    { key: 'isRecommend', label: '\u63a8\u8350', type: 'switch', defaultValue: false },
    { key: 'status', label: '\u72b6\u6001', type: 'number', defaultValue: 1 }
  ],
  listFields: ['giveAmount', 'description', 'isRecommend', 'status'],
  actions: [
    { label: '\u542f\u7528', field: 'status', value: 1 },
    { label: '\u7981\u7528', field: 'status', value: 0 }
  ]
}))
