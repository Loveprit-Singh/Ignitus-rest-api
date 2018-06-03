'use strict';
const mongoose=require('mongoose');

const Users=require('../models/user').Users;
const bcrypt=require('bcrypt');
const jwt=require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require("nodemailer");

//mailing credentials
const smtpTransport = nodemailer.createTransport({
    service: "Gmail",
    auth: {
        user: "",
        pass: ""
    }
});
const Linkedin = require('node-linkedin')('', '');
const scope = ['r_basicprofile','r_emailaddress'];
var rand,mailOptions,host,link;
const secret='secret';

//check if a registering user is already registered using social login
function socialLoginCheck(req,res,user_role,data){
    if((user_role==data[0].user_role) && data[0].linkedin.profile_url&& data[0].linkedin.access_token){
        bcrypt.hash(req.body.password, 10, (err, hash) => {
           if(err){
               return res.status(500).json({
                   success: false,
                   message: 'sorry! something happened, please try again'
               });
           }
           Users.update({email:req.body.email},{ $set : {'password':hash}}, (err,result)=> {
               if(err){
                   return res.status(500).json({
                       success: false,
                       message: 'sorry! something happened, please try again'
                   });
               }
               res.status(200).json({
                   success: true,
                   message: 'sucessfully registered. Please login to continue'
               });
           });
        });
    }
}

//register function

function register(req,res,user_role) {
    Users.find({email: req.body.email})
        .exec()
        .then(data => {
            if (data.length >= 1 && data[0].verified==1) {
                return res.status(409).json({
                    success: false,
                    message: 'user already exists'
                });
            }
            else if (data.length>=1 && data[0].verified==0){
                return res.status(409).json({
                    success:false,
                    message: 'please verify your email address by clicking the link sent on your mail'
                });
            }
            else {
                bcrypt.hash(req.body.password, 10, (err, hash) => {
                    if (err) {
                        return res.status(500).json({
                            success: false,
                            message: 'sorry! something happened, please try again'
                        });
                    } else {
                        var rand=Math.floor((Math.random() * 100) + 54);
                        rand= rand.toString();
                        var val = crypto.createHash('md5').update(rand).digest('hex');

                        const user = new Users({
                            _id: new mongoose.Types.ObjectId(),
                            email: req.body.email,
                            password: hash,
                            user_role:user_role,
                            verified : 0,
                            verifytoken : val

                        });
                        user.save()
                            .then(result => {

                                rand=Math.floor((Math.random() * 100) + 54);
                                host=req.get('host');
                                link="http://"+req.get('host')+"/verify?id="+val+"&email="+req.body.email;
                                mailOptions={
                                    to : req.body.email,
                                    subject : "Please confirm your Email account",
                                    html : "Hello,<br> Please Click on the link to verify your email.<br><a href="+link+">Click here to verify</a>"
                                }

                                smtpTransport.sendMail(mailOptions, (error, response) =>{
                                    if(error){
                                        Users.findOneAndRemove({email: req.body.email}).exec()
                                            .then(result=> {
                                                console.log(error);
                                                //res.end("error unable to send verification email.");
                                                res.status(500).json({
                                                    success: false,
                                                    message: 'registered but UNABLE to send verification email'
                                                });
                                            });

                                    }
                                    else{
                                        res.status(200).json({
                                            success: true,
                                            message: 'sucessfully registered. Verify your email id.'
                                        });
                                    }
                                });
                            })
                            .catch(err => {
                                res.status(500).json({
                                    success: false,
                                    message: 'sorry! something happened, please try again'
                                });
                            });
                    }
                });
            }
        });
}
//student register controller
exports.studentRegister=function (req,res) {
    register(req,res,'student');
};
//professor register controller
exports.professorRegister=function (req,res) {
    register(req,res,'professor');
};
// normal login controller

exports.login= function (req,res) {
    Users.find({email: req.body.email})
        .exec()
        .then(data => {
            if (data.length < 1) {
                return res.status(401).json({
                    success: false,
                    message: 'invalid user'
                });
            }
            else if (data.length==1 && data[0].verified==0){
                return res.status(401).json({
                    success: false,
                    message: 'verify your email by clicking on link sent on your mail before logging in with this email id.'
                });
            }
            else {
                bcrypt.compare(req.body.password, data[0].password, (err, result) => {
                    if (err) {
                        return res.status(401).json({
                            success: false,
                            message: 'invalid user'
                        });
                    }
                    if (result) {
                        const token = jwt.sign({
                                email: data[0].email,
                                userId: data[0]._id
                            },
                            secret,
                            {expiresIn: "1h"}
                        );
                        return res.status(200).json({
                            success: 'successfully logged in',
                            token: token
                        });
                    } else {
                        return res.status(401).json({
                            success: false,
                            message: 'invalid user'
                        });
                    }
                });
            }
        })
        .catch(err => {
            return res.status(500).json({
                success: false,
                message: 'something happened! please try again'
            });
        });
};

exports.verify= function (req,res) {

    if((req.protocol+"://"+req.get('host'))==("http://"+host))
    {
        console.log("Domain is matched. Information is from Authentic email");
        Users.find({"email": req.body.email , "verifytoken" : req.body.id},(err,data)=> {
            if(!err)
            {
                console.log("email is verified and token verified");
               //console.log(req.query.email);
                var query = {'email' : req.query.email};
                //console.log(query);

                var newvalues = { $set : {'verified':1}};
                //console.log(newvalues);
                Users.update(query,newvalues, (err,result)=>{
                    if(err){
                        res.status(500).json({
                            success: false,
                            message: 'email not verified .try again'
                        });
                    }
                    else{
                        res.status(200).json({
                            success: true,
                            message: 'sucessfully verified your email id.'
                        });
                    }
                });

            }
            else{
                res.status(500).json({
                    success: false,
                    message: 'email not verified bcz of wrong token'
                });
            }
        });
    }
    else{
        res.status(500).json({
            success: false,
            message: 'req from unknown source'
        });
    }

};

//linkedin student login controller
exports.studentlinkedlogin= function (req,res) {
    Linkedin.setCallback("http://localhost:3000/student/oauth/linkedin/callback");
    Linkedin.auth.authorize(res, scope);
};

//linked login callback
function linkedinlogin(req,res,user_role) {
    Linkedin.auth.getAccessToken(res, req.query.code, req.query.state, (err, results)=> {
        if ( err )
            return console.error(err);

        const token=results.access_token;
        const linkedin_user=Linkedin.init(token);
        linkedin_user.people.me((err,data)=> {
            let user_email=data.emailAddress;
            let user_linked_profile=data.publicProfileUrl;
            let access_token=results.access_token;

            //finding if the user already exists
            Users.find({email:user_email})
                .exec()
                .then(result =>{
                    if(result.length>0){
                        const token = jwt.sign({
                                email: result[0].email,
                                userId: result[0]._id
                            },
                            secret,
                            {expiresIn: "1h"}
                        );
                        return res.status(200).json({
                            success: 'successfully logged in',
                            token: token
                        });
                    }
            });
            //creating a new user if not found
            const user = new Users({
                _id: new mongoose.Types.ObjectId(),
                email: user_email,
                user_role:user_role,
                verified : 1,
                linkedin: {
                    profile_url: user_linked_profile,
                    access_token: access_token
                }
            });
            //saving the user
            user.save()
                .then(result =>{
                    //logging in the new user
                    Users.find({email:user_email})
                        .exec()
                        .then(result =>{
                            if(result.length>0){
                                const token = jwt.sign({
                                        email: result[0].email,
                                        userId: result[0]._id
                                    },
                                    secret,
                                    {expiresIn: "1h"}
                                );
                                return res.status(200).json({
                                    success: 'successfully logged in',
                                    token: token
                                });
                            }
                        });
                });
        });
        // console.log(results.access_token);

    });
}
//linkedin student login callback
exports.studentlinkedlogincallback= function(req,res){
    linkedinlogin(req,res,'student');
};

//linkedin professor login controller
exports.professorlinkedlogin= function (req,res) {
    Linkedin.setCallback("http://localhost:3000/professor/oauth/linkedin/callback");
    Linkedin.auth.authorize(res, scope);
};
//linkedin professor login callback
exports.professorlinkedlogincallback= function(req,res){
    linkedinlogin(req,res,'professor');
};