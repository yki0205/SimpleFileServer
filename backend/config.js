// Configuration for the file server
// You can customize the base directory to serve files from
module.exports = {

  port: process.env.PORT || 11073,

  baseDirectory: process.env.BASE_DIRECTORY || 'H:/ACGN',
  // baseDirectory: process.env.BASE_DIRECTORY || 'D:/Program/Code/Computer_Science/Parallel',

  uploadCountLimit: process.env.UPLOAD_COUNT_LIMIT || 10,
  uploadSizeLimit: process.env.UPLOAD_SIZE_LIMIT || 1024 * 1024 * 100, // 100MB

  contentMaxSize: process.env.CONTENT_MAX_SIZE || 5 * 1024 * 1024, // 5MB
}
