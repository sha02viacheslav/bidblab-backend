const path = require('path');
const fs = require('fs-extra');
const config = require('../config');

module.exports.getFile = async (req, res) => {
  const foldersPath = `${req.params.parentFolder}/${req.params.subFolder}`;
  const filePath = path.resolve(
    `./${config.MEDIA_FOLDER}/${foldersPath}/${req.params.fileName}`,
  );
  if (await fs.exists(filePath)) {
    return res.sendFile(filePath);
  }
  res.status(404).json({
    error: null,
    msg: 'File not found.',
    data: null,
  });
};
