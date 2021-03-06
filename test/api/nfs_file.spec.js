import should from 'should';
import nfsUtils from '../utils/nfs_utils';
import authUtils from '../utils/auth_utils';
import { MESSAGES, CONSTANTS } from '../constants';

describe('NFS file', () => {
  let authToken = null;
  const dirPath = 'test_app';
  const rootPath = 'app';
  const fileName = 'test_file.txt';
  const filePath = `${dirPath}/${fileName}`;
  const fileContent = 'This is test file';

  before(() => (
    authUtils.registerAndAuthorise()
    .then(token => (authToken = token))
    .then(() => nfsUtils.createDir(authToken, rootPath, dirPath))
  ));

  after(() => (
    nfsUtils.deleteDir(authToken, rootPath, dirPath)
      .then(() => authUtils.revokeApp(authToken))
  ));

  describe('Create file', () => {
    after(() => nfsUtils.deleteFile(authToken, rootPath, filePath));

    it('Should return 401 if authorisation token is not valid', () => (
      nfsUtils.createFile()
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(401);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description).be.equal(MESSAGES.UNAUTHORISED);
        })
    ));

    it('Should return 400 if rootPath is not found', () => (
      nfsUtils.createFile(authToken)
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description.indexOf('rootPath')).be.not.equal(-1);
        })
    ));

    // it('Should return 400 if metadata is not string', () => (
    //   nfsUtils.createFile(authToken, rootPath, filePath, 'some text',
    //      { headers: { metadata: { test: true } } })
    //     .should.be.rejectedWith(Error)
    //     .then(err => {
    //       should(err.response.status).be.equal(400);
    //       should(err.response.data.errorCode).be.equal(400);
    //       should(err.response.data.description).be.equal(MESSAGES.REQUIRED_PARAMS_MISSING);
    //     })
    // ));

    it('Should be able to create file', () => (
      nfsUtils.createFile(authToken, rootPath, filePath, 'some text',
        { headers: { 'content-type': 'text/plain' } })
          .should.be.fulfilled()
          .then(res => {
            should(res.status).be.equal(200);
          })
    ));

    it('Should return 400 if file already exits', () => (
      nfsUtils.createFile(authToken, rootPath, filePath, 'some text',
        { headers: { 'content-type': 'text/plain' } })
          .should.be.rejectedWith(Error)
          .then(err => {
            should(err.response.status).be.equal(400);
            should(err.response.data.errorCode).be.equal(-505);
            should(err.response.data.description).be
              .equal('NfsError::FileAlreadyExistsWithSameName');
          })
    ));
    it('Should be able to create file in SAFE DRIVE and retrieve it', () => {
      const safeDriveRootPath = 'drive';
      let safeDriveToken = null;

      return authUtils.registerAndAuthorise(CONSTANTS.AUTH_PAYLOAD_SAFE_DRIVE)
        .then(token => (safeDriveToken = token))
        .then(() => nfsUtils.createDir(safeDriveToken, safeDriveRootPath, dirPath))
        .should.be.fulfilled()
        .then(() => nfsUtils.getDir(safeDriveToken, safeDriveRootPath, dirPath))
        .should.be.fulfilled()
        .then(res => {
          should(res.status).be.equal(200);
          should(res.data.info.name).be.equal(dirPath);
        })
        .then(() => nfsUtils.createFile(safeDriveToken, safeDriveRootPath, filePath, fileContent,
          { headers: { 'content-type': 'text/plain' } }))
        .should.be.fulfilled()
        .then(() => nfsUtils.getFile(safeDriveToken, safeDriveRootPath, filePath))
        .should.be.fulfilled()
        .then(res => should(res.data).be.equal(fileContent))
        .then(() => nfsUtils.deleteDir(safeDriveToken, safeDriveRootPath, dirPath))
        .should.be.fulfilled()
        .then(() => authUtils.revokeApp(safeDriveToken));
    });
  });

  describe('Get file', () => {
    before(() => nfsUtils.createFile(authToken, rootPath, filePath, fileContent,
      { headers: { 'content-type': 'text/plain' } }));
    after(() => nfsUtils.deleteFile(authToken, rootPath, filePath));

    it('Should return 401 if authorisation token is not valid', () => (
      nfsUtils.getFile()
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(401);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description).be.equal(MESSAGES.UNAUTHORISED);
        })
    ));

    it('Should return 400 if rootPath is not found', () => (
      nfsUtils.getFile(authToken)
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description.indexOf('rootPath')).be.not.equal(-1);
        })
    ));

    it('Should return 400 if range is not in bytes', () => (
      nfsUtils.getFile(authToken, rootPath, filePath, { headers: { range: 'data=' } })
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description.indexOf('range')).be.not.equal(-1);
        })
    ));

    it('Should return 404 if file not found', () => (
      nfsUtils.getFile(authToken, rootPath, 'test.html')
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(404);
        })
    ));

    it('Should be able to get file', () => (
      nfsUtils.getFile(authToken, rootPath, filePath)
        .should.be.fulfilled()
        .then(res => {
          should(res.status).be.equal(200);
          should(res.data).be.equal(fileContent);
          should(res.headers).have.keys(
            'content-range',
            'accept-ranges',
            'created-on',
            'last-modified',
            'metadata',
            'content-type',
            'content-length'
          );
          should(res.headers['content-range']).match(/^bytes\s\d+-\d+\/\d+/);
          should(res.headers['accept-ranges']).be.equal('bytes');
          should(new Date(res.headers['created-on'])).be.ok();
          should(new Date(res.headers['last-modified'])).be.ok();
          should(res.headers['content-type']).be.String();
          should(res.headers['content-type'].length).not.be.equal(0);
          should(isNaN(res.headers['content-length'])).not.be.ok();
        })
    ));
    it('Should be able to get file if range end is greater than file size', () => (
      nfsUtils.getFile(authToken, rootPath, filePath,
        { headers: { range: `bytes=0-${fileContent.length + 10}` } })
        .should.be.fulfilled()
        .then(res => {
          should(res.status).be.equal(206);
          should(res.data).be.equal(fileContent);
        })
    ));
  });

  describe('Get file meta', () => {
    before(() => nfsUtils.createFile(authToken, rootPath, filePath, fileContent,
      { headers: { 'content-type': 'text/plain' } }));
    after(() => nfsUtils.deleteFile(authToken, rootPath, filePath));

    it('Should return 401 if authorisation token is not valid', () => (
      nfsUtils.getFileMeta()
        .should.be.rejectedWith(Error)
        .then(err => should(err.response.status).be.equal(401))
    ));

    it('Should return 400 if rootPath is not found', () => (
      nfsUtils.getFileMeta(authToken)
        .should.be.rejectedWith(Error)
        .then(err => should(err.response.status).be.equal(400))
    ));

    it('Should return 404 if file not found', () => (
      nfsUtils.getFileMeta(authToken, rootPath, 'test.html')
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(404);
        })
    ));

    it('Should be able to get file meta data', () => (
      nfsUtils.getFileMeta(authToken, rootPath, filePath)
        .should.be.fulfilled()
        .then(res => {
          should(res.status).be.equal(200);
          should(res.headers).have.keys(
            'accept-ranges',
            'created-on',
            'last-modified',
            'metadata',
            'content-type',
            'content-length'
          );
          should(res.headers['accept-ranges']).be.equal('bytes');
          should(new Date(res.headers['created-on'])).be.ok();
          should(new Date(res.headers['last-modified'])).be.ok();
          should(res.headers['content-type']).be.String();
          should(res.headers['content-type'].length).not.be.equal(0);
          should(isNaN(res.headers['content-length'])).not.be.ok();
        })
    ));
  });

  describe('Delete file', () => {
    before(() => nfsUtils.createFile(authToken, rootPath, filePath, fileContent,
      { headers: { 'content-type': 'text/plain' } }));
    after(() => nfsUtils.deleteFile(authToken, rootPath, filePath));

    it('Should return 401 if authorisation token is not valid', () => (
      nfsUtils.deleteFile()
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(401);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description).be.equal(MESSAGES.UNAUTHORISED);
        })
    ));

    it('Should return 400 if rootPath is not found', () => (
      nfsUtils.deleteFile(authToken)
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description.indexOf('rootPath')).be.not.equal(-1);
        })
    ));

    it('Should return 404 if file not found', () => (
      nfsUtils.deleteFile(authToken, rootPath, 'test.html')
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(404);
        })
    ));

    it('Should be able to delete file', () => (
      nfsUtils.deleteFile(authToken, rootPath, filePath)
        .should.be.fulfilled()
        .then(res => {
          should(res.status).be.equal(200);
        })
        .then(() => nfsUtils.createFile(authToken, rootPath, filePath, fileContent,
          { headers: { 'content-type': 'text/plain' } }))
    ));
  });

  describe('Modify file metadata', () => {
    const newFileName = 'new_test_file.txt';
    const newFilePath = `${dirPath}/${newFileName}`;

    before(() => nfsUtils.createFile(authToken, rootPath, filePath, fileContent,
      { headers: { 'content-type': 'text/plain' } }));
    after(() => nfsUtils.deleteFile(authToken, rootPath, filePath));

    it('Should return 401 if authorisation token is not valid', () => (
      nfsUtils.modifyFileMeta()
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(401);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description).be.equal(MESSAGES.UNAUTHORISED);
        })
    ));

    it('Should return 400 if rootPath is not found', () => (
      nfsUtils.modifyFileMeta(authToken)
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description.indexOf('rootPath')).be.not.equal(-1);
        })
    ));

    it('Should return 400 if metadata on body is not a string', () => (
      nfsUtils.modifyFileMeta(authToken, rootPath, filePath, { metadata: true })
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description.indexOf('metadata')).be.not.equal(-1);
        })
    ));

    it('Should return 400 if name on body is not a string', () => (
      nfsUtils.modifyFileMeta(authToken, rootPath, filePath, { name: true })
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description.indexOf('name')).be.not.equal(-1);
        })
    ));

    it('Should return 404 if file not found', () => (
      nfsUtils.modifyFileMeta(authToken, rootPath, newFilePath, { name: newFileName })
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(404);
        })
    ));

    it('Should return 400 if either name or metadata are not found', () => (
      nfsUtils.modifyFileMeta(authToken, rootPath, filePath, {})
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description).be.equal(MESSAGES.REQUIRED_PARAMS_MISSING);
        })
    ));

    it('Should be able to modify file metadata', () => {
      const reqMetadata = 'some metadata info';
      return nfsUtils.modifyFileMeta(authToken, rootPath, filePath, { metadata: reqMetadata })
        .should.be.fulfilled()
        .then(res => {
          should(res.status).be.equal(200);
        })
        .then(() => nfsUtils.getFileMeta(authToken, rootPath, filePath))
        .then(res => {
          should(res.status).be.equal(200);
          should(res.headers.metadata).be.equal(reqMetadata);
        });
    });

    it('Should be able to modify file name', () => (
      nfsUtils.modifyFileMeta(authToken, rootPath, filePath, { name: newFileName })
        .should.be.fulfilled()
        .then(res => {
          should(res.status).be.equal(200);
        })
        .then(() => nfsUtils.modifyFileMeta(authToken, rootPath, newFilePath, { name: fileName }))
    ));
  });

  describe('Move file', () => {
    const destDir = 'new_test_app';
    const destFilePath = `${destDir}/${fileName}`;
    before(() => (
      nfsUtils.createFile(authToken, rootPath, filePath, fileContent,
        { headers: { 'content-type': 'text/plain' } })
        .then(() => nfsUtils.createDir(authToken, rootPath, destDir))
    ));
    after(() => (
      nfsUtils.deleteDir(authToken, rootPath, destDir)
        .then(() => nfsUtils.deleteFile(authToken, rootPath, filePath))
    ));

    it('Should return 401 if authorisation token is not valid', () => (
      nfsUtils.moveOrCopyFile(null, null, null, {})
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(401);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description).be.equal(MESSAGES.UNAUTHORISED);
        })
    ));

    it('Should return 400 if srcRootPath is not found', () => (
      nfsUtils.moveOrCopyFile(authToken, null)
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description).be.equal(MESSAGES.REQUIRED_PARAMS_MISSING);
        })
    ));

    it('Should return 400 if destRootPath is not found', () => (
      nfsUtils.moveOrCopyFile(authToken, rootPath)
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description).be.equal(MESSAGES.REQUIRED_PARAMS_MISSING);
        })
    ));

    it('Should return 400 if srcPath is not found', () => (
      nfsUtils.moveOrCopyFile(authToken, rootPath, rootPath)
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description).be.equal(MESSAGES.REQUIRED_PARAMS_MISSING);
        })
    ));

    it('Should return 400 if destPath is not found', () => (
      nfsUtils.moveOrCopyFile(authToken, rootPath, rootPath, filePath)
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description).be.equal(MESSAGES.REQUIRED_PARAMS_MISSING);
        })
    ));

    it('Should return 400 if srcRootPath is not valid', () => (
      nfsUtils.moveOrCopyFile(authToken, 'test', rootPath, filePath, filePath)
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description.indexOf('srcRootPath')).be.not.equal(-1);
        })
    ));

    it('Should return 400 if destRootPath is not valid', () => (
      nfsUtils.moveOrCopyFile(authToken, rootPath, 'test', filePath, filePath)
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description.indexOf('destRootPath')).be.not.equal(-1);
        })
    ));

    it('Should return 400 if action is not valid', () => (
      nfsUtils.moveOrCopyFile(authToken, rootPath, rootPath, filePath, filePath, 'test')
        .should.be.rejectedWith(Error)
        .then(err => {
          should(err.response.status).be.equal(400);
          should(err.response.data.errorCode).be.equal(400);
          should(err.response.data.description.indexOf('action')).be.not.equal(-1);
        })
    ));

    it('Should return 404 if file not found', () => (
      nfsUtils.moveOrCopyFile(authToken, rootPath, rootPath, `${dirPath}/test.html`, destDir,
        nfsUtils.FILE_OR_DIR_ACTION.MOVE)
          .should.be.rejectedWith(Error)
          .then(err => should(err.response.status).be.equal(404))
    ));

    it('Should be able to move file', () => (
      nfsUtils.moveOrCopyFile(authToken, rootPath, rootPath, filePath, destDir,
        nfsUtils.FILE_OR_DIR_ACTION.MOVE)
          .should.be.fulfilled()
          .then(res => should(res.status).be.equal(200))
          .then(() => nfsUtils.getFile(authToken, rootPath, destFilePath))
          .then(res => {
            should(res.status).be.equal(200);
            should(res.data).be.equal(fileContent);
          })
          .then(() => nfsUtils.moveOrCopyFile(authToken, rootPath, rootPath, destFilePath, dirPath,
            nfsUtils.FILE_OR_DIR_ACTION.MOVE))
    ));

    it('Should be able to move directory by default', () => (
      nfsUtils.moveOrCopyFile(authToken, rootPath, rootPath, filePath, destDir)
        .should.be.fulfilled()
        .then(res => should(res.status).be.equal(200))
        .then(() => nfsUtils.getFile(authToken, rootPath, destFilePath))
        .then(res => {
          should(res.status).be.equal(200);
          should(res.data).be.equal(fileContent);
        })
        .then(() => nfsUtils.moveOrCopyFile(authToken, rootPath, rootPath, destFilePath, dirPath,
          nfsUtils.FILE_OR_DIR_ACTION.MOVE))
    ));

    it('Should be able to copy file', () => (
      nfsUtils.moveOrCopyFile(authToken, rootPath, rootPath, filePath, destDir,
        nfsUtils.FILE_OR_DIR_ACTION.COPY)
          .should.be.fulfilled()
          .then(res => should(res.status).be.equal(200))
          .then(() => nfsUtils.getFile(authToken, rootPath, destFilePath))
          .then(res => {
            should(res.status).be.equal(200);
            should(res.data).be.equal(fileContent);
          })
          .then(() => nfsUtils.getFile(authToken, rootPath, filePath))
          .then(res => {
            should(res.status).be.equal(200);
            should(res.data).be.equal(fileContent);
          })
    ));
  });
});
