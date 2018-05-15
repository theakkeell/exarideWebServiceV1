const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const config = require('config');
const _ = require('lodash');
var multer  = require('multer')
var upload = multer({ dest: './public/images/profileImages' });
//package for making HTTP Request
var request=require("request");
//package to generate a random number
var randomize = require('randomatic');
const {User, validate} = require('../models/user');
const { Driver } = require('../models/driver');
const Location = require('../models/location');
const Rider  = require('../models/rider');
const ShiftRider = require('../models/shiftRider');
const mongoose = require('mongoose');
const geolib = require('geolib');
const express = require('express');
const logger = require('../startup/logging');
const regController = require('../controller/registrationController');

var userExists = function(email, callback){
    logger.info('UserExists Method Called');
    var query = { email };
    User.findOne(query).exec(function(err, email){
        if (err){
            logger.error('Some Error while finding user' + err );
            res.status(400).send({status:"failure", message:err, object:[] });
        }
        else{
            if (email){
                console.log('Fpund a user ', email);
                logger.info('User Found with Email. :'+email);                
                console.log("user found with Email. :"+email);
                callback (email);
            }
            else{
                logger.info('User Not Found with Email. :'+email);
                console.log("user not found with EMail. :"+email);
                callback( email);
            }
       }
     });
    logger.info(' Exit UserExists Method');
}
var locationExists = function(id,callback){

    logger.info('markerExists Method Called');
    var query = { _id : id };
    Location.findOne(query).exec(function(err, location){
        if (err){
            logger.error('Some Error while finding Location' + err );
            res.status(400).send({status:"failure", message:err, object:[] });
        }
        else{
            if (location){                
                logger.info('Marker Found with id :'+id);
                callback (location);
            }
            else{                
                 logger.info('Marker Not Found with id :'+id);
                callback( location);                
            }
       }
    });
    
    logger.info(' Exit MarkerExists Method');
}

exports.updateDriverLocation = function(reqData, res){
    try {
        var email = reqData.email;
        var longitude = reqData.longitude;
        var latitude = reqData.latitude;
        var userLoc = new Object({ latitude: latitude, longitude: longitude }); 
        regController.userExists(email, function (user) {
            if (user) {
                user.loc = [longitude, latitude];
                user.last_shared_loc_time = new Date();
                user.save(function (err, user) {
                    if (err) {
                        logger.error('Some Error while updating user' + err);
                    }
                    else {
                        logger.info('User Location With email ' + email);
                        console.log('Save user ###############', user)
                        
                        res.jsonp({
                            status: "success",
                            message: "Location Updated!",
                            object: user
                        });
                    }
                });

                logger.info('location : ' + user.loc);
            }
            else {
                res.jsonp({
                    status: "failure",
                    message: "Failed To update Location!",
                    object: []
                });
            }
        });

    } catch (err) {
        logger.info('An Exception Has occured in updateUserLocation method' + err);
    }
}

exports.updateRiderLocation = async function (reqData, res) {
    logger.info('updateRiderLocation method called', reqData);
    try {
        let riderRsponseObject;
        let userObj, stopResObj;
        let listOfStops = [];
        let userResObj;
        let listOfDrivers = [];
        let phone = reqData.phoneNo;
        let longitude = reqData.longitude;
        let latitude = reqData.latitude;
        let userLoc = new Object({ latitude: latitude, longitude: longitude }); 

        // finding list of drivers
        let driver = await Driver.find({});
        if(!driver) return res.jsonp({ status: "failure", message: "Failed To update Location!", object: [] });
        // console.log('LIST OF DRIVERS ', driver );

        for(let i = 0; i < driver.length; i++){
            userObj = await User.find({ _id: driver[i]._userId });

            for(let j = 0; j < userObj.length; j++){
                userResObj = {
                    profile_photo_url: userObj[j].profile_photo_url,
                    loc: userObj[j].loc,
                    name: userObj[j].name
                }
                listOfDrivers.push(userResObj);
            }
        }
        // finding list of stops
        // list of stops
        let shiftRider = await ShiftRider.find({});
        if(!shiftRider) return res.jsonp({ status: "failure", message: "Failed To findind stops!", object: [] });
        for(let i = 0; i < shiftRider.length; i++){
            let stopRes = {
                pickUpLocName: shiftRider[i].pickUpLocName,
                pickUploc: shiftRider[i].pickUploc
            }
            listOfStops.push(stopRes);
        }


        riderRsponseObject = {
            listOfDrivers: listOfDrivers,
            listOfStops: listOfStops
        };
        
        regController.userExists(phone, function (user) {
            if (user) {
                user.loc = [longitude, latitude];
                user.last_shared_loc_time = new Date();
                user.save(function (err, user) {
                    if (err) {
                        logger.error('Some Error while updating user' + err);
                    }
                    else {
                        logger.info('User Location With Phone Num ' + phone);
                        console.log('Save user ###############', user)
                        
                        res.jsonp({
                            status: "success",
                            message: "Location Updated!",
                            object: riderRsponseObject
                        });
                    }
                });

                logger.info('location : ' + user.loc);
            }
            else {
                res.jsonp({
                    status: "failure",
                    message: "Failed To update Location!",
                    object: []
                });
            }
        });
    } catch (err) {
        logger.info('An Exception Has occured in updateUserLocation method' + err);
    }
}

exports.riderPickUPLocation = async function(reqData, res){
    try {
        let userObj;
        let userResObj;
        let listOfDrivers = [];

        logger.info("IN Riderpickuploaction");
        let pickupLocName = reqData.pickupLocName;
        let phone = reqData.phoneNo;
        let longitude = reqData.longitude;
        let latitude = reqData.latitude;
        let radius = reqData.radius;
        let userLoc = new Object({ latitude: latitude, longitude: longitude }); 

        let user = await User.findOne({ phone });
        if(!user) return res.jsonp({ status: "failure", message: "Failed To Finding rider!", object: [] });
        console.log('Found a user', user);

        let location = new Location({
            loc: [longitude, latitude],
            radius: radius
        });
        await location.save();
        console.log('Location saved', location);

        let rider = new Rider({
            _pickUpLocationId: location._id,
            pickupLocName: pickupLocName 
        });
        await rider.save();
        console.log('Rider saved!', rider);

        // finding list of drivers
        let driver = await Driver.find({});
        if(!driver) return res.jsonp({ status: "failure", message: "Failed To update Location!", object: [] });
        // console.log('LIST OF DRIVERS ', driver );
 
        for(let i = 0; i < driver.length; i++){
            userObj = await User.find({ _id: driver[i]._userId });
 
            for(let j = 0; j < userObj.length; j++){
                userResObj = {
                    profile_photo_url: userObj[j].profile_photo_url,
                    loc: userObj[j].loc,
                    name: userObj[j].name
                }
                listOfDrivers.push(userResObj);
            }
        }

        let pickUpResObj =  {
            listOfDrivers: listOfDrivers
        }

        res.jsonp({
            status: "success",
            message: "riderPickUPLocation Updated!",
            object: listOfDrivers
        });
        
    } catch (err) {
        logger.info('An Exception Has occured in RiderPickUpLocation method' + err);
    }
}

