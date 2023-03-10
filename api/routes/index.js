const express = require('express');
const errorHandler = require('express-async-handler');
const jwt = require('jsonwebtoken');
const multer = require('../config/multer');
const authCtrl = require('../controllers/auth.controller');
const fileCtrl = require('../controllers/file.controller');
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

const upload_auction = (folder, allowedTypes) => (req, res, next) =>
	multer(`${folder}`, allowedTypes).array(
		'files[]'
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
router.post(
	'/auth/adminChangePassword',
	isAuthenticated,
	isAdmin,
	errorHandler(authCtrl.adminChangePassword),
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
router.post(
	'/auth/updateProfile',
	isAuthenticated,
	errorHandler(authCtrl.updateProfile),
);
router.patch(
	'/auth/changeProfilePicture',
	isAuthenticated,
	upload_profile('profilePictures', ['image']),
	errorHandler(authCtrl.changeProfilePicture),
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
router.patch(
	'/admin/addQuestion',
	isAuthenticated,
	isAdmin,
	upload_question('questionPictures', ['image']),
	errorHandler(adminCtrl.addQuestion),
);
router.get(
	'/admin/getQuestions',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getQuestions)
);
router.patch(
	'/common/updateQuestion',
	isAuthenticated,
	isAdmin,
	upload_question('questionPictures', ['image']),
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
router.post(
	'/admin/deleteAnswers',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.deleteAnswers),
);
router.post(
	'/admin/changeAnswersRole/:roleType',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.changeAnswersRole),
);
// ------------Tags------------
router.get(
	'/admin/getTags',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getTags)
);
router.post(
	'/admin/addTag',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.addTag),
);
router.post(
	'/admin/updateTag/:tagId',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.updateTag),
);
router.post(
	'/admin/deleteTags',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.deleteTags),
);
// ------------Interests------------
router.get(
	'/admin/getInterests',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getInterests)
);
router.post(
	'/admin/addInterest',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.addInterest),
);
router.post(
	'/admin/updateInterest/:interestId',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.updateInterest),
);
router.post(
	'/admin/deleteInterests',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.deleteInterests),
);
// ------------Flag------------
router.get(
	'/admin/getFlags',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getFlags)
);
router.post(
	'/admin/deleteFlags',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.deleteFlags),
);
router.post(
	'/admin/changeFlagsRole/:roleType',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.changeFlagsRole),
);
// ------------Auction------------
router.patch(
	'/admin/addAuction',
	isAuthenticated,
	isAdmin,
	upload_auction('auctionPictures', ['image']),
	errorHandler(adminCtrl.addAuction),
);
router.get(
	'/admin/getPendingAuctions',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getPendingAuctions)
);
router.get(
	'/admin/getProcessAuctions',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getProcessAuctions)
);
router.get(
	'/admin/getClosedAuctions',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getClosedAuctions)
);
router.patch(
	'/admin/updateAuction',
	isAuthenticated,
	isAdmin,
	upload_auction('auctionPictures', ['image']),
	errorHandler(adminCtrl.updateAuction),
);
router.post(
	'/admin/deleteAuctions',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.deleteAuctions),
);
router.post(
	'/admin/changeAuctionsRole/:roleType',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.changeAuctionsRole),
);
router.get(
	'/admin/getDataForAddAuction',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getDataForAddAuction),
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
	'/admin/changeDefaultCredits',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.changeDefaultCredits),
);
router.get(
	'/admin/getLogins/:userId',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getLogins),
);
router.post(
	'/admin/sendVerifylink',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.sendVerifylink),
);
// ------------Mail------------
router.get(
	'/admin/getMails',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.getMails)
);
router.post(
	'/admin/applyRoleOfMails/:roleType/:apply',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.applyRoleOfMails),
);
router.post(
	'/admin/sendMessage',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.sendMessage),
);
router.post(
	'/admin/archiveMessage',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.archiveMessage),
);
// ------------Site manage------------
router.post(
	'/admin/saveAbout',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.saveAbout),
);
router.post(
	'/admin/saveHow',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.saveHow),
);
router.post(
	'/admin/saveTerms',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.saveTerms),
);
router.post(
	'/admin/saveCookie',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.saveCookie),
);
router.post(
	'/admin/savePrivacy',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.savePrivacy),
);
router.post(
	'/admin/saveInvestor',
	isAuthenticated,
	isAdmin,
	errorHandler(adminCtrl.saveInvestor),
);
// --------------------------------Common-------------------------------------
router.get('/common/getQuestions', errorHandler(commonCtrl.getQuestions));
router.get(
	'/common/getQuestionsCanAnswer',
	isAuthenticated,
	errorHandler(commonCtrl.getQuestionsCanAnswer));
router.get(
	'/common/getQuestionByQuestionId/:questionId/:userId',
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
	'/common/getUserData/',
	isAuthenticated,
	errorHandler(commonCtrl.getUserData),
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
	'/common/addAnswer/:questionId/:answertype',
	isAuthenticated,
	errorHandler(commonCtrl.addAnswer),
);
router.get(
	'/common/skipAnswer/:questionId',
	isAuthenticated,
	errorHandler(commonCtrl.skipAnswer),
);
router.patch(
	'/common/addQuestion',
	isAuthenticated,
	upload_question('questionPictures', ['image']),
	errorHandler(commonCtrl.addQuestion),
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
	'/common/addReport',
	isAuthenticated,
	errorHandler(commonCtrl.addReport),
);
router.get(
	'/common/getAllTags',
	errorHandler(commonCtrl.getAllTags),
);
router.get(
	'/common/getAllInterests',
	errorHandler(commonCtrl.getAllInterests),
);
router.get(
	'/common/getDefaultCredits',
	errorHandler(commonCtrl.getDefaultCredits),
);
router.get('/common/getAuctions',
	errorHandler(commonCtrl.getAuctions)
);
router.get('/common/getAuctionsAfterLogin',
	isAuthenticated,
	errorHandler(commonCtrl.getAuctionsAfterLogin)
);
router.get('/common/getBiddingAuctions',
	isAuthenticated,
	errorHandler(commonCtrl.getBiddingAuctions)
);
router.get('/common/getAuctionById/:auctionId',
	isAuthenticated,
	errorHandler(commonCtrl.getAuctionById)
);
router.post(
	'/common/addBid/:auctionId',
	isAuthenticated,
	errorHandler(commonCtrl.addBid),
);
router.get(
	'/common/getAboutPageContent',
	errorHandler(commonCtrl.getAboutPageContent),
);
router.get(
	'/common/getHowPageContent',
	errorHandler(commonCtrl.getHowPageContent),
);
router.get(
	'/common/getTermsPageContent',
	errorHandler(commonCtrl.getTermsPageContent),
);
router.get(
	'/common/getCookiePageContent',
	errorHandler(commonCtrl.getCookiePageContent),
);
router.get(
	'/common/getPrivacyPageContent',
	errorHandler(commonCtrl.getPrivacyPageContent),
);
router.get(
	'/common/getInvestorPageContent',
	errorHandler(commonCtrl.getInvestorPageContent),
);
// ------------Mail------------
router.get(
	'/common/getMails',
	isAuthenticated,
	errorHandler(commonCtrl.getMails)
);
router.post(
	'/common/applyRoleOfMails/:roleType/:apply',
	isAuthenticated,
	errorHandler(commonCtrl.applyRoleOfMails),
);
router.post(
	'/common/sendMessage',
	isAuthenticated,
	errorHandler(commonCtrl.sendMessage),
);
router.post(
	'/common/archiveMessage',
	isAuthenticated,
	errorHandler(commonCtrl.archiveMessage),
);
router.post(
	'/common/invite',
	isAuthenticated,
	errorHandler(commonCtrl.invite),
);
router.post(
	'/common/squarePay',
	isAuthenticated,
	errorHandler(commonCtrl.squarePay),
);
// -----------------------------------File-------------------------------------
router.get(
	'/file/:parentFolder/:subFolder/:fileName',
	isAuthenticated,
	errorHandler(fileCtrl.getFile),
);

module.exports = router;
