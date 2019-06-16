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
    squareApplicationId: 'sandbox-sq0idp-pgtYItOt5ukOhAf3XVPULw',
    squareAccessToken: 'EAAAEJe7x4H5Ln7aOHjRdyVK8kE4eLiniqcKGiHy7aoNmPDJlqR2g3zFxQhK-vZC',
    squareLocationId: 'CBASEGeplV7kldOKRjfU1u8mZ5sgAQ'
  },
  MEDIA_FOLDER: 'uploads',
};
