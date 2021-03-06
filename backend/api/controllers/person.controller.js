// all validation, sanitation and authorization should be done before this point! (in permission.js and/or validator.js)

'use strict';

var models = require('../models/index');
var settings = require('../../config/settings');
var logger = require('../../config/logger');

var getStream = require('./getstream.controller');

// error handler
function handleError(res, err) {
  logger.debug('Error: ', err);
  return res.status(500).json({status:'error', msg:err});
}


// person index
exports.index = function(req,res) {

  var limit = parseInt(req.query.limit) || 50;
  if (limit > 50) { limit = 50; }
  var offset = parseInt(req.query.offset) || 0;
  var order = req.query.order || 'created_at, DESC';
  var filter = {};

  models.person.findAndCountAll({
    where: filter,
    limit: limit,
    offset: offset,
    // order: [[order]]
  }).then(function(result) {
    return res.json(result);
  }).catch(function(err){
    return res.json({err:err});
  });
};

// Search for a name
exports.query = function(req,res) {
  var limit = parseInt(req.query.limit) || 10;
  if (limit > 50) { limit = 50; }
  var offset = parseInt(req.query.offset) || 0;
  var order = req.query.order || 'created_at, DESC';
  var filter = {
    lastname: {
      $like: '%' + String(req.query.term) + '%'
    }
  };
  models.person.findAndCountAll({
    where: filter,
    limit: limit,
    offset: offset,
    // order: [[order]],
    // include: [
    //   { model: models.identifier, as: 'identifiers', attributes: ['scheme', 'identifier'] }
    // ]
  }).then(function(result) {
    return res.json(result);
  }).catch(function(err) {
    return handleError(res,err);
  });
};

// Show a single person
exports.show = function(req,res) {
  models.person.find({
    where: {
      id: req.params.personId
    },
    include: [{
      // Person's identifiers
      model: models.identifier,
      as: 'identifiers',
      // foreignKey: 'person_id',
      attributes: ['id', 'value'],
      include: [{
        // Identifier type
        model: models.identifier_type,
        as: 'type',
        attributes: ['id', 'value']
      }]
    }, {
      // Person's othernames
      model: models.person_othername,
      as: 'othernames',
      // foreignKey: 'person_id',
      attributes: ['id', 'name'],
      include: [{
        // Othername type
        model: models.person_othername_type,
        as: 'type',
        attributes: ['id', 'value']
      }]
    }, {
      // Person's contacts
      model: models.person_contact,
      as: 'contacts',
      // foreignKey: 'person_id',
      attributes: ['id', 'value'],
      include: [{
        // Othername type
        model: models.person_contact_type,
        as: 'type',
        attributes: ['id', 'value']
      }]
    }, {
      // Person's contacts
      model: models.link,
      as: 'links',
      attributes: ['id', 'value', 'title', 'description', 'category'],
    },
    {
      // Person's jobs
      model: models.person_job,
      as: 'jobs',
      // attributes: ['id', 'value', 'title', 'description', 'category'],
    }
  ]
  }).then(function(event){
    return res.json(event);
  }).catch(function(error) {
    return handleError(res,error);
  });
};

// Create a person
exports.create = function(req,res) {
  // Validate input

  models.person.create(req.body).then(function(result) {
    return res.json(result);
  }).catch(function(err) {
    return handleError(res,err);
  });
};

// Update a person record
exports.update = function(req,res) {
  logger.info('Updating person with id: ' + req.params.personId, req.body);
  models.person.update(req.body, {
    where: { id: req.params.personId }
  }).then(function(result) {

    // create a getStream activity
    var FeedManager = require('../../config/stream').feedManager;
    var feed = FeedManager.getFeed('person', req.params.personId);
    var activity = {
        actor: 'user:' + req.user.id,
        verb: 'updated',
        object: req.params.personId,
        message: 'Profile was updated!'
    };
    console.log('[person.controller] creating new activity', activity);
    feed.addActivity(activity);

    return res.json(result);
  }).catch(function(err){
    return handleError(res,err);
  });
};

// Delete a person record
exports.delete = function(req,res){
  models.person.destroy({
    where: { id: req.params.personId }
  }).then(function(result){
    return res.json(result);
  }).catch(function(err){
    return handleError(res,err);
  });
};










exports.follow = function(req,res) {
  logger.info('Person controller: Follow person.');
  logger.info(req.body);
  if (!req.body.person_id) { return handleError(res,{msg: 'person_id is required. '}); }
  // First find the person
  models.person.findById(req.body.person_id).then(function(person) {
    if (!person) { return handleError(res, {msg: 'person not found. '}); }
    // then find the account
    models.account.findById(req.user.id).then(function(account) {
      if (!account) { return handleError(res,'Account not found'); }
      person.addFollower(account).then(function(result) {

        // if success create getstream follow
        getStream.follow(req.user.id, 'person', req.body.person_id);


        return res.json(result);
      }).catch(function(error){
        return handleError(res,error);
      });
    });
  }).catch(function(error) {
    return handleError(error);
  });
};

exports.unfollow = function(req,res) {
  if (!req.body.person_id) { return handleError(res,{msg: 'person_id is required. '}); }
  models.person.findById(req.body.person_id).then(function(person) {
    if (!person) { return handleError(res, {msg: 'person not found. '}); }
    models.account.findById(req.user.id).then(function(account) {
      if (!account) { return handleError(res,'Account not found'); }
        person.removeFollower(account).then(function(result) {

          // if success create getstream unfollow
          getStream.unfollow(req.user.id, 'person', req.body.person_id);

          return res.json(result);
        }).catch(function(error){
          return handleError(res, error);
        });
    });
  }).catch(function(error) {
    return handleError(error);
  });
};
//
//
// // person editors
// exports.addEditor = function(req,res) {
//   logger.info('adding editor');
//   models.person.findById(req.params.id).then(function(person) {
//     if (!person) { return res.json(person); }
//     // If role is owner, check if one does not exist already
//     // person.getEditors().then(function(result) {
//     //   logger.info(result);
//     //
//     // });
//     models.account.findById(req.body.account_id).then(function(account) {
//       if (!account) { return res.json(account); }
//       person.addEditor(account, {role: req.body.role}).then(function(result) {
//         //logger.debug(result);
//         return res.json(result);
//       }).catch(function(error) {
//         return handleError(res,error);
//       });
//     }).catch(function(error) {
//       return handleError(res,error);
//     });
//   }).catch(function(error) {
//     return handleError(res,error);
//   });
// };
