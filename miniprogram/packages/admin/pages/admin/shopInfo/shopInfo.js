const { createCollectionPage } = require('../../../utils/simpleCollectionPage')

Page(createCollectionPage({
  collection: 'shopInfo',
  title: '\u5e97\u94fa\u8bbe\u7f6e',
  titleKey: 'name',
  subtitleKey: 'description',
  orderBy: 'createTime',
  order: 'desc',
  canDelete: false,
  allowSearch: false,
  fields: [
    { key: 'name', label: '\u540d\u79f0', type: 'text', required: true },
    { key: 'description', label: '\u63cf\u8ff0', type: 'textarea' }
  ],
  listFields: ['description', 'createTime']
}))