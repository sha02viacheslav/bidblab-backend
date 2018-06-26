module.exports = {
  FRONTEND_URI:
    process.env.FRONTEND_URI ||
    (process.env.NODE_ENV === 'production'
      ? 'http://159.203.178.177'
      : 'http://localhost:4200'),
  SECRET:
    process.env.SECRET ||
    '(@#*&YBE JWKDHGFW^&Q#Y@^#%^@YBhasgdctw673629qwiedhsb`yT^@&*((*#&*^TRDTFYEGHJKLw;cu63e2',
  MONGO_URI:
    process.env.MONGO_URI ||
    (process.env.NODE_ENV === 'production'
      ? 'mongodb://mongo:27017/bidblab'
      : 'mongodb://localhost:27017/bidblab'),
  MAILER: {
    from: 'Bidblab <support@bidblab.com>',
    auth: {
      api_key: '1c483f030a25d74004bd2083d3f42585-b892f62e-b1b60d12',
      domain: 'sandbox172690e9cd1e44c385681721a74d37fa.mailgun.org',
    },
  },
  MEDIA_FOLDER: 'uploads',
};
