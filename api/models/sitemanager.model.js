const mongoose = require('mongoose');

const sitemanagerSchema = mongoose.Schema({
  pageType: {
    type: String,
    required: true,
  },
  quillContent: {
      type: String,
      default: '',
      required: true,
  },
});
  
mongoose.model('Sitemanager', sitemanagerSchema);