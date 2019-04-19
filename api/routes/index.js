const express = require('express');
const errorHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const multer = require('../config/multer');
const authCtrl = require('../controllers/auth.controller');
const fileCtrl = require('../controllers/file.controller');
const userCtrl = require('../controllers/user.controller');
const adminCtrl = require('../controllers/admin.controller');
const commonCtrl = require('../controllers/common.controller');

const router = express.Router();

const isAuthenticated = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({
      error: null,
      msg: 'Please login first to access our services',
      data: null,
    });
  }
  jwt.verify(token, req.app.get('secret'), (err, decodedToken) => {
    if (err) {
      return res.status(401).json({
        error: err,
        msg: 'Login timed out, please login again.',
        data: null,
      });
    }
    req.decodedToken = decodedToken;
    next();
  });
};

const isNotAuthenticated = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    next();
  } else {
    jwt.verify(token, req.app.get('secret'), (err, decodedToken) => {
      if (!err) {
        return res.status(401).json({
          error: err,
          msg: 'You are already logged in.',
          data: null,
        });
      }
      next();
    });
  }
};

const isAdmin = (req, res, next) => {
  if (req.decodedToken.admin) {
    next();
  } else {
    res.status(403).json({
      error: null,
      msg: 'You are not authorized to do this action.',
      data: null,
    });
  }
};

const upload_profile = (folder, allowedTypes) => (req, res, next) =>
  multer(`${req.decodedToken.user.username}/${folder}`, allowedTypes).single(
    'file',
  )(req, res, next);


  const upload_question = (folder, allowedTypes) => (req, res, next) =>
  multer(`${folder}`, allowedTypes).single(
    'file',
  )(req, res, next);
// -------------------------------Auth------------------------------------------
router.post('/auth/signup', isNotAuthenticated, errorHandler(authCtrl.signup));
router.post(
  '/auth/userlogin',
  isNotAuthenticated,
  errorHandler(authCtrl.userLogin),
);
router.post(
  '/auth/adminLogin',
  isNotAuthenticated,
  errorHandler(authCtrl.adminLogin),
);
router.patch(
  '/auth/verifyAccount/:verificationToken',
  errorHandler(authCtrl.verifyAccount),
);
router.patch(
  '/auth/forgotPassword',
  isNotAuthenticated,
  errorHandler(authCtrl.forgotPassword),
);
router.get(
  '/auth/checkResetPasswordToken/:resetPasswordToken',
  isNotAuthenticated,
  errorHandler(authCtrl.checkResetPasswordToken),
);
router.patch(
  '/auth/resetPassword/:userId/:resetPasswordToken',
  isNotAuthenticated,
  errorHandler(authCtrl.resetPassword),
);
router.patch(
  '/auth/changePassword',
  isAuthenticated,
  errorHandler(authCtrl.changePassword),
);

// ----------------------------------Admin-------------------------------------
// ------------User------------
router.post(
  '/admin/createUser',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.createUser),
);
router.get(
  '/admin/getMembers',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.getMembers)
);
router.patch(
  '/admin/updateUser/:userId',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.updateUser),
);
router.post(
  '/admin/deleteMembers',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.deleteMembers),
);
// ------------Question------------
router.get(
  '/admin/getQuestions',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.getQuestions)
);
router.patch(
  '/admin/updateQuestion/:questionId',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.updateQuestion),
);
router.post(
  '/admin/deleteQuestions',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.deleteQuestions),
);
router.delete(
  '/admin/deleteQuestion/:questionId',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.deleteQuestion),
);
router.post(
  '/admin/changeQuestionsRole/:roleType',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.changeQuestionsRole),
);
// ------------Answer------------
router.get(
	'/admin/getAnswers',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getAnswers)
);
router.patch(
  '/admin/updateAnswer/:questionId/:answerId',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.updateAnswer),
);
router.delete(
  '/admin/deleteAnswer/:questionId/:answerId',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.deleteAnswer),
);
// ------------Flag------------
router.get(
  '/admin/getFlags',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.getFlags)
);
router.post(
  '/admin/changeFlagsRole/:roleType',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.changeFlagsRole),
);
// ------------User------------
router.get(
  '/admin/getUser/:userId',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.getUser),
);
router.patch(
  '/admin/resetUserPassword/:userId',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.resetUserPassword),
);
router.post(
  '/admin/changeMembersRole/:roleType',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.changeMembersRole),
);
router.post(
  '/admin/sendMessage',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.sendMessage),
);
router.get(
  '/admin/getDefaultCredits',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.getDefaultCredits),
);
router.post(
  '/admin/changeDefaultCredits',
  isAuthenticated,
  isAdmin,
  errorHandler(adminCtrl.changeDefaultCredits),
);
// ----------------------------------User-------------------------------------
router.patch(
  '/user/updateProfile',
  isAuthenticated,
  errorHandler(userCtrl.updateProfile),
);
router.patch(
  '/user/changeProfilePicture',
  isAuthenticated,
  upload_profile('profilePictures', ['image']),
  errorHandler(userCtrl.changeProfilePicture),
);

// --------------------------------Common-------------------------------------
router.get('/common/getQuestions', errorHandler(commonCtrl.getQuestions));
router.get(
  '/common/getQuestionsCanAnswer',
  isAuthenticated,
  errorHandler(commonCtrl.getQuestionsCanAnswer));
router.get(
  '/common/getQuestionByQuestionId/:questionId',
  isAuthenticated,
  errorHandler(commonCtrl.getQuestionByQuestionId),
);
router.get(
  '/common/getUserDataByuserId/:userId',
  isAuthenticated,
  errorHandler(commonCtrl.getUserDataByuserId),
);
router.get(
  '/common/getUserAnswerByuserId',
  isAuthenticated,
  errorHandler(commonCtrl.getUserAnswerByuserId),
);
router.get(
  '/common/getUserQuestionByuserId',
  isAuthenticated,
  errorHandler(commonCtrl.getUserQuestionByuserId),
);
router.get(
  '/common/getQuestionsByAskerId/',
  isAuthenticated,
  errorHandler(commonCtrl.getQuestionsByAskerId),
);
router.get(
  '/common/getQuestionsFollowing/',
  isAuthenticated,
  errorHandler(commonCtrl.getQuestionsFollowing),
);
router.get(
  '/common/getUsersFollowing/',
  isAuthenticated,
  errorHandler(commonCtrl.getUsersFollowing),
);
router.get(
  '/common/getMyCredits/',
  isAuthenticated,
  errorHandler(commonCtrl.getMyCredits),
);
router.get(
  '/common/getQuestionsWithYourAnswers/',
  isAuthenticated,
  errorHandler(commonCtrl.getQuestionsWithYourAnswers),
);
router.post(
  '/common/addQuestion',
  isAuthenticated,
  errorHandler(commonCtrl.addQuestion),
);
router.post(
  '/common/addAnswer/:questionId/:answertype',
  isAuthenticated,
  errorHandler(commonCtrl.addAnswer),
);
router.patch(
  '/common/changeQuestionPicture',
  isAuthenticated,
  upload_question('questionPictures', ['image']),
  errorHandler(commonCtrl.changeQuestionPicture),
);

router.get(
  '/common/addFollow/:followType/:objectId',
  isAuthenticated,
  errorHandler(commonCtrl.addFollow),
);
router.get(
  '/common/deleteFollow/:followType/:objectId',
  isAuthenticated,
  errorHandler(commonCtrl.deleteFollow),
);
router.get(
  '/common/addThumb/:questionId/:answerId/:thumbType',
  isAuthenticated,
  errorHandler(commonCtrl.addThumb),
);
router.post(
  '/common/addReport/:questionId/:answerId',
  isAuthenticated,
  errorHandler(commonCtrl.addReport),
);
router.get(
  '/common/getStandardInterests',
  errorHandler(commonCtrl.getStandardInterests),
);
router.get(
  '/common/getDefaultCredits',
  isAuthenticated,
  errorHandler(commonCtrl.getDefaultCredits),
);
router.get('/common/getAuctions', 
  isAuthenticated,
  errorHandler(commonCtrl.getAuctions)
);
router.post(
  '/common/addBid/:auctionId',
  isAuthenticated,
  errorHandler(commonCtrl.addBid),
);
// -----------------------------------File-------------------------------------
router.get(
  '/file/:parentFolder/:subFolder/:fileName',
  isAuthenticated,
  errorHandler(fileCtrl.getFile),
);

module.exports = router;
