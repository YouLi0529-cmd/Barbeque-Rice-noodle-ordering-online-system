const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'queue',
  title: '\u6392\u961f\u7ba1\u7406',
  titleKey: 'queueNo',
  subtitleKey: 'name',
  statusKey: 'status',
  orderBy: 'createTime',
  order: 'desc',
  fields: [
    { key: 'queueNo', label: '\u7f16\u53f7', type: 'text' },
    { key: 'name', label: '\u59d3\u540d', type: 'text' },
    { key: 'phone', label: '\u624b\u673a\u53f7', type: 'text' },
    { key: 'peopleCount', label: '\u4eba\u6570', type: 'number' },
    { key: 'status', label: '\u72b6\u6001', type: 'text', defaultValue: 'waiting' }
  ],
  listFields: ['name', 'phone', 'peopleCount', 'createTime'],
  actions: [
    { label: '\u5df2\u53eb\u53f7', field: 'status', value: 'called' },
    { label: '\u5df2\u5165\u5ea7', field: 'status', value: 'seated' },
    { label: '\u8fc7\u53f7', field: 'status', value: 'skipped' },
    { label: '\u53d6\u6d88', field: 'status', value: 'cancelled' }
  ]
}))