const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'order',
  title: '\u6237\u5916\u8ba2\u5355',
  titleKey: 'orderNo',
  subtitleKey: 'grillName',
  statusKey: 'status',
  orderBy: 'createTime',
  order: 'desc',
  canAdd: false,
  canDelete: false,
  filters: { orderType: 'camping' },
  fields: [
    { key: 'orderNo', label: '\u8ba2\u5355\u53f7', type: 'text' },
    { key: 'grillName', label: '\u70e4\u67b6', type: 'text' },
    { key: 'status', label: '\u72b6\u6001', type: 'text' },
    { key: 'finalPrice', label: '\u91d1\u989d', type: 'number' }
  ],
  listFields: ['grillName', 'finalPrice', 'status', 'createTime'],
  actions: [
    { label: '\u5df2\u4ed8\u6b3e', field: 'payStatus', value: true },
    { label: '\u914d\u83dc\u4e2d', field: 'status', value: 'preparing' },
    { label: '\u5f85\u81ea\u53d6', field: 'status', value: 'ready_pickup' },
    { label: '\u5df2\u5b8c\u6210', field: 'status', value: 'completed' }
  ]
}))