const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'order',
  title: '\u8ba2\u5355\u7ba1\u7406',
  titleKey: 'orderNo',
  subtitleKey: 'tableNumber',
  statusKey: 'status',
  orderBy: 'createTime',
  order: 'desc',
  canAdd: false,
  canDelete: false,
  fields: [
    { key: 'orderNo', label: '\u8ba2\u5355\u53f7', type: 'text' },
    { key: 'tableNumber', label: '\u684c\u53f7', type: 'text' },
    { key: 'orderType', label: '\u7c7b\u578b', type: 'text' },
    { key: 'status', label: '\u72b6\u6001', type: 'text' },
    { key: 'finalPrice', label: '\u91d1\u989d', type: 'number' },
    { key: 'frontDeskRemark', label: '\u5907\u6ce8', type: 'textarea' }
  ],
  listFields: ['tableNumber', 'orderType', 'finalPrice', 'createTime'],
  actions: [
    { label: '\u5df2\u4ed8\u6b3e', field: 'payStatus', value: true },
    { label: '\u53d1\u53a8\u623f', field: 'status', value: 'pending_prepare' },
    { label: '\u5df2\u5b8c\u6210', field: 'status', value: 'completed' },
    { label: '\u53d6\u6d88\u8ba2\u5355', field: 'status', value: 'cancelled' }
  ]
}))