module.exports = {
  FRONTEND_URI:
    process.env.FRONTEND_URI ||
    (process.env.NODE_ENV === 'production'
      ? 'https://bidblab.com'
      : 'http://localhost:4200'),
  ADMINEND_URI:
    process.env.ADMINEND_URI ||
    (process.env.NODE_ENV === 'production'
      ? 'https://bidblab.com'
      : 'http://localhost:4300'),
  SECRET:
    process.env.SECRET ||
    '(@#*&YBE JWKDHGFW^&Q#Y@^#%^@YBhasgdctw673629qwiedhsb`yT^@&*((*#&*^TRDTFYEGHJKLw;cu63e2',
  MONGO_URI:
    process.env.MONGO_URI ||
    (process.env.NODE_ENV === 'production'
      ? 'mongodb://localhost:27017/bidblab'
      : 'mongodb://localhost:27017/bidblab'),
  MAILER: {
    from: 'Bidblab <support@bidblab.com>',
    auth: {
      api_key: '1c483f030a25d74004bd2083d3f42585-b892f62e-b1b60d12',
      domain:
        process.env.NODE_ENV === 'production'
          ? 'verify.bidblab.com'
          : 'sandbox172690e9cd1e44c385681721a74d37fa.mailgun.org',
    },
  },
  SQUARE: {
    squareAccessToken: 'EAAAEMBoOzDuLADLNKBVOqBBsgc6sCRY8Pp60XQRkMxYcC2Sdn-UtDWvZpZT3ZHO',
    squareLocationId: '5SAF2VX4HZP44'
  },
  MEDIA_FOLDER: 'uploads',
};
