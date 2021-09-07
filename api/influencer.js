'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk');
const R = require('ramda');

AWS.config.setPromisesDependency(require('bluebird'));

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.submit = (event, context, callback) => {
    console.log("Receieved request submit Influencer details. Event is", event);
    const requestBody = JSON.parse(event.body);
	const NATIONALITY = requestBody.NATIONALITY;
    const EMAIL_ADDRESS = requestBody.EMAIL_ADDRESS;
	const LANGUAGE = requestBody.LANGUAGE;
    const BIRTH_DATE = requestBody.BIRTH_DATE;
    const GENDER = requestBody.GENDER;
	const NAME = requestBody.NAME;

    if (typeof NATIONALITY !== 'string' || typeof EMAIL_ADDRESS !== 'string' || typeof LANGUAGE !== 'string' || typeof BIRTH_DATE !== 'string' || typeof GENDER !== 'string' || typeof NAME !== 'string') {
        console.error('Validation Failed');
        callback(new Error('Couldn\'t submit Influencer because of validation errors.'));
        return;
    }

    const Influencer = influencerInfo(NATIONALITY, EMAIL_ADDRESS, LANGUAGE, BIRTH_DATE, GENDER, NAME);
    const influencerSubmissionFx = R.composeP(submitInfluencerEmailP, submitInfluencerP, checkInfluencerExistsP);

    influencerSubmissionFx(Influencer)
        .then(res => {
            console.log(`Successfully submitted ${NAME}(${EMAIL_ADDRESS}) Influencer to system`);
            callback(null, successResponseBuilder(
                JSON.stringify({
                    message: `Sucessfully submitted Influencer with email ${EMAIL_ADDRESS}`,
                    INFLUENCERS_ID: res.INFLUENCERS_ID
                }))
            );
        })
        .catch(err => {
            console.error('Failed to submit Influencer to system', err);
            callback(null, failureResponseBuilder(
                409,
                JSON.stringify({
                    message: `Unable to submit Influencer with email ${EMAIL_ADDRESS}`
                })
            ))
        });
};


module.exports.list = (event, context, callback) => {
    console.log("Receieved request to list all influencers. Event is", event);
    var params = {
        TableName: process.env.TB_INFLUENCERS,
        ProjectionExpression: "INFLUENCERS_ID, NAME, EMAIL_ADDRESS"
    };
    const onScan = (err, data) => {
        if (err) {
            console.log('Scan failed to load data. Error JSON:', JSON.stringify(err, null, 2));
            callback(err);
        } else {
            console.log("Scan succeeded.");
            return callback(null, successResponseBuilder(JSON.stringify({
                influencers: data.Items
            })
            ));
        }
    };
    dynamoDb.scan(params, onScan);
};

module.exports.get = (event, context, callback) => {
    const params = {
        TableName: process.env.TB_INFLUENCERS,
        Key: {
            INFLUENCERS_ID: event.pathParameters.INFLUENCERS_ID,
        },
    };
    dynamoDb.get(params)
        .promise()
        .then(result => {
            callback(null, successResponseBuilder(JSON.stringify(result.Item)));
        })
        .catch(error => {
            console.error(error);
            callback(new Error('Couldn\'t fetch Influencer.'));
            return;
        });
};

const checkInfluencerExistsP = (Influencer) => {
    console.log('Checking if Influencer already exists...');
    const query = {
        TableName: process.env.TB_INFLUENCERS,
        Key: {
            "EMAIL_ADDRESS": Influencer.EMAIL_ADDRESS
        }
    };
    return dynamoDb.get(query)
        .promise()
        .then(res => {
            if (R.not(R.isEmpty(res))) {
                return Promise.reject(new Error('Influencer already exists with email ' + EMAIL_ADDRESS));
            }
            return Influencer;
        });
}

const submitInfluencerP = Influencer => {
    console.log('submitInfluencerP() Submitting Influencer to system');
    const influencerItem = {
        TableName: process.env.TB_INFLUENCERS,
        Item: Influencer,
    };
    return dynamoDb.put(influencerItem)
        .promise()
        .then(res => Influencer);
};


const successResponseBuilder = (body) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: body
    };
};

const failureResponseBuilder = (statusCode, body) => {
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        body: body
    };
};


const submitInfluencerEmailP = Influencer => {
    console.log('Submitting Influencer email');
    const influencerEmailInfo = {
        TableName: process.env.TB_INFLUENCERS,
        Item: {
            INFLUENCERS_ID: Influencer.INFLUENCERS_ID,
            EMAIL_ADDRESS: Influencer.EMAIL_ADDRESS
        },
    };
    return dynamoDb.put(influencerEmailInfo)
        .promise();
}

const influencerInfo = (NATIONALITY, EMAIL_ADDRESS, LANGUAGE, BIRTH_DATE, GENDER, NAME) => {
  //const timestamp = new Date().getTime();
    return {
        INFLUENCERS_ID: uuid.v1(),
		NATIONALITY: NATIONALITY,
		EMAIL_ADDRESS: EMAIL_ADDRESS,
		LANGUAGE: LANGUAGE,
		BIRTH_DATE: BIRTH_DATE,
		GENDER: GENDER,
		NAME: NAME,
    };
};
