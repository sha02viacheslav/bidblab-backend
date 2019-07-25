const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const randToken = require('rand-token');
const config = require('./index');

module.exports = (folder, allowedTypes) =>
  multer({
    storage: multer.diskStorage({
      destination(req, file, callback) {
        const dest = path.resolve(`../${config.MEDIA_FOLDER}/${folder}`);
        fs.ensureDirSync(dest);
        callback(null, dest);
      },
      filename(req, file, callback) {
        callback(
          null,
          `${randToken.generate(32)}.${file.mimetype.split('/')[1]}`,
        );
      },
    }),
    fileFilter(req, file, callback) {
      const typeArray = file.mimetype.split('/');
      callback(null, allowedTypes.includes(typeArray[0]));
    },
  });
