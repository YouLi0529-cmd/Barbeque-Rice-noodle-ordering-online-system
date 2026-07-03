const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'user',
  title: '\u4f1a\u5458\u7ba1\u7406',
  titleKey: 'userCode',
  subtitleKey: 'nickName',
  statusKey: 'phone',
  orderBy: 'createTime',
  order: 'desc',
  canAdd: false,
  canDelete: false,
  fields: [
    { key: 'userCode', label: '\u4f1a\u5458\u53f7', type: 'text' },
    { key: 'nickName', label: '\u6635\u79f0', type: 'text' },
    { key: 'phone', label: '\u624b\u673a\u53f7', type: 'text' },
    { key: 'orderCount', label: '\u70b9\u5355\u6b21\u6570', type: 'number' },
    { key: 'status', label: '\u542f\u7528', type: 'switch', defaultValue: true }
  ],
  listFields: ['nickName', 'phone', 'orderCount', 'createTime']
}))